import {
  AttachmentRecordSchema,
  type AttachmentRecord,
} from '../contracts/rafiqV6.js';
import {
  opfsAttachmentStore,
  type OpfsAttachmentStore,
  type SavedAttachmentObject,
} from './opfsAttachmentStore.js';
import { v6Tables } from './v6Tables.js';

export interface AttachmentMetadataStore {
  get(id: string): Promise<AttachmentRecord | undefined>;
  put(record: AttachmentRecord): Promise<void>;
  delete(id: string): Promise<void>;
  list(): Promise<AttachmentRecord[]>;
}

const dexieStore: AttachmentMetadataStore = {
  get: id => v6Tables.attachmentRecords().get(id),
  put: async record => { await v6Tables.attachmentRecords().put(record); },
  delete: id => v6Tables.attachmentRecords().delete(id),
  list: () => v6Tables.attachmentRecords().toArray(),
};

export interface LocalAttachmentFile extends Blob {
  name: string;
  type: string;
}

export interface SaveLocalAttachmentInput {
  chatId: string;
  messageId?: string;
  file: LocalAttachmentFile;
  attachmentId?: string;
  resume?: boolean;
  signal?: AbortSignal;
  onProgress?: (ratio: number) => void;
}

export class AttachmentRepository {
  constructor(
    private readonly metadata: AttachmentMetadataStore = dexieStore,
    private readonly bytes: Pick<OpfsAttachmentStore, 'save' | 'getBlob' | 'createObjectUrl' | 'remove'> = opfsAttachmentStore,
    private readonly now: () => Date = () => new Date(),
    private readonly createId: () => string = () => crypto.randomUUID(),
  ) {}

  async listForChat(chatId: string): Promise<AttachmentRecord[]> {
    return (await this.metadata.list())
      .filter(record => record.chatId === chatId)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  }

  async get(id: string): Promise<AttachmentRecord | undefined> {
    return this.metadata.get(id);
  }

  async saveLocalFile(input: SaveLocalAttachmentInput): Promise<AttachmentRecord> {
    const id = input.attachmentId || this.createId();
    const existing = await this.metadata.get(id);
    if (existing && existing.chatId !== input.chatId) {
      throw new Error('Attachment ID already belongs to another chat.');
    }
    const now = this.now();
    const opfsKey = existing?.opfsKey || `${id}.bin`;
    const processing = AttachmentRecordSchema.parse({
      id,
      chatId: input.chatId,
      messageId: input.messageId || existing?.messageId,
      fileName: input.file.name,
      mimeType: input.file.type || 'application/octet-stream',
      sizeBytes: input.file.size,
      sha256: existing?.sha256,
      opfsKey,
      availability: 'processing',
      processingProgress: existing?.processingProgress || 0,
      derivedText: existing?.derivedText,
      thumbnailOpfsKey: existing?.thumbnailOpfsKey,
      codecError: existing?.codecError,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    });
    await this.metadata.put(processing);

    try {
      const saved: SavedAttachmentObject = await this.bytes.save({
        key: opfsKey,
        blob: input.file,
        resume: input.resume,
        signal: input.signal,
        onProgress: progress => {
          input.onProgress?.(progress.ratio);
          void this.metadata.put(AttachmentRecordSchema.parse({
            ...processing,
            processingProgress: progress.ratio,
            updatedAt: this.now(),
          })).catch(() => undefined);
        },
      });
      const available = AttachmentRecordSchema.parse({
        ...processing,
        sizeBytes: saved.sizeBytes,
        sha256: saved.sha256,
        availability: 'available',
        processingProgress: 1,
        updatedAt: this.now(),
      });
      await this.metadata.put(available);
      return available;
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === 'AbortError';
      const failed = AttachmentRecordSchema.parse({
        ...processing,
        availability: cancelled ? 'processing' : 'failed',
        codecError: cancelled
          ? undefined
          : error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000),
        updatedAt: this.now(),
      });
      await this.metadata.put(failed);
      throw error;
    }
  }

  async attachToMessage(id: string, messageId: string): Promise<AttachmentRecord> {
    const current = await this.metadata.get(id);
    if (!current) throw new Error('Attachment record not found.');
    const updated = AttachmentRecordSchema.parse({
      ...current,
      messageId,
      updatedAt: this.now(),
    });
    await this.metadata.put(updated);
    return updated;
  }

  async updateDerivedData(
    id: string,
    patch: Pick<AttachmentRecord, 'derivedText' | 'thumbnailOpfsKey' | 'codecError'>,
  ): Promise<AttachmentRecord> {
    const current = await this.metadata.get(id);
    if (!current) throw new Error('Attachment record not found.');
    const updated = AttachmentRecordSchema.parse({
      ...current,
      ...patch,
      updatedAt: this.now(),
    });
    await this.metadata.put(updated);
    return updated;
  }

  async getBlob(id: string, expectedChatId: string): Promise<Blob> {
    const record = await this.metadata.get(id);
    if (!record) throw new Error('Attachment record not found.');
    if (record.chatId !== expectedChatId) {
      throw new Error('Attachment does not belong to the expected chat.');
    }
    if (record.availability !== 'available') {
      throw new Error('Attachment bytes are not available on this device.');
    }
    return this.bytes.getBlob(record.opfsKey);
  }

  async createObjectUrl(id: string): Promise<{ url: string; revoke: () => void }> {
    const record = await this.metadata.get(id);
    if (!record || record.availability !== 'available') {
      throw new Error('Attachment bytes are not available on this device.');
    }
    return this.bytes.createObjectUrl(record.opfsKey);
  }

  async markImportedWithoutBinary(record: Omit<AttachmentRecord, 'opfsKey' | 'availability'>): Promise<AttachmentRecord> {
    const imported = AttachmentRecordSchema.parse({
      ...record,
      opfsKey: `missing-${record.id}`,
      availability: 'missing',
      processingProgress: 0,
      updatedAt: this.now(),
    });
    await this.metadata.put(imported);
    return imported;
  }

  async remove(id: string): Promise<void> {
    const record = await this.metadata.get(id);
    if (!record) return;
    await this.bytes.remove(record.opfsKey).catch(() => undefined);
    if (record.thumbnailOpfsKey) {
      await this.bytes.remove(record.thumbnailOpfsKey).catch(() => undefined);
    }
    await this.metadata.delete(id);
  }

  async removeForMessage(messageId: string): Promise<number> {
    const normalizedMessageId = messageId.trim();
    if (!normalizedMessageId) return 0;
    const records = (await this.metadata.list()).filter(
      record => record.messageId === normalizedMessageId,
    );
    for (const record of records) await this.remove(record.id);
    return records.length;
  }
}

export const attachmentRepository = new AttachmentRepository();
