import { IncrementalSha256 } from './incrementalSha256.js';

export class AttachmentQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AttachmentQuotaError';
  }
}

export interface AttachmentWriter {
  write(chunk: Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

export interface AttachmentStorageEstimate {
  usage?: number;
  quota?: number;
}

export interface AttachmentStorageBackend {
  getSize(key: string): Promise<number>;
  openWriter(key: string, options: { keepExistingData: boolean; start: number }): Promise<AttachmentWriter>;
  read(key: string): Promise<ReadableStream<Uint8Array>>;
  getBlob(key: string): Promise<Blob>;
  remove(key: string): Promise<void>;
  estimate(): Promise<AttachmentStorageEstimate>;
  requestPersistence(): Promise<boolean>;
}

type OpfsStorageManager = Omit<StorageManager, 'getDirectory'> & {
  getDirectory?: () => Promise<FileSystemDirectoryHandle>;
};

const isNotFoundError = (error: unknown): boolean => (
  error instanceof DOMException && error.name === 'NotFoundError'
);

const validateStorageKey = (key: string): string => {
  const normalized = key.trim();
  if (!/^[a-zA-Z0-9._-]{1,200}$/.test(normalized)) {
    throw new Error('Attachment storage key contains unsupported characters.');
  }
  return normalized;
};

const getAttachmentDirectory = async (): Promise<FileSystemDirectoryHandle> => {
  const storage = navigator.storage as OpfsStorageManager;
  if (!storage?.getDirectory) throw new Error('OPFS is unavailable in this browser.');
  const root = await storage.getDirectory();
  return root.getDirectoryHandle('rafiq-attachments', { create: true });
};

export const browserOpfsBackend: AttachmentStorageBackend = {
  getSize: async rawKey => {
    const key = validateStorageKey(rawKey);
    try {
      const directory = await getAttachmentDirectory();
      const file = await (await directory.getFileHandle(key)).getFile();
      return file.size;
    } catch (error) {
      if (isNotFoundError(error)) return 0;
      throw error;
    }
  },
  openWriter: async (rawKey, options) => {
    const key = validateStorageKey(rawKey);
    const directory = await getAttachmentDirectory();
    const handle = await directory.getFileHandle(key, { create: true });
    const writable = await handle.createWritable({ keepExistingData: options.keepExistingData });
    if (options.start > 0) await writable.seek(options.start);
    return {
      write: chunk => writable.write(chunk),
      close: () => writable.close(),
      abort: () => writable.abort(),
    };
  },
  read: async rawKey => {
    const key = validateStorageKey(rawKey);
    const directory = await getAttachmentDirectory();
    return (await (await directory.getFileHandle(key)).getFile()).stream();
  },
  getBlob: async rawKey => {
    const key = validateStorageKey(rawKey);
    const directory = await getAttachmentDirectory();
    return (await directory.getFileHandle(key)).getFile();
  },
  remove: async rawKey => {
    const key = validateStorageKey(rawKey);
    const directory = await getAttachmentDirectory();
    await directory.removeEntry(key).catch(error => {
      if (!isNotFoundError(error)) throw error;
    });
  },
  estimate: () => navigator.storage.estimate(),
  requestPersistence: async () => (
    typeof navigator.storage.persist === 'function'
      ? navigator.storage.persist()
      : false
  ),
};

export interface SaveAttachmentOptions {
  key: string;
  blob: Blob;
  resume?: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: {
    writtenBytes: number;
    totalBytes: number;
    ratio: number;
  }) => void;
}

export interface SavedAttachmentObject {
  key: string;
  sizeBytes: number;
  sha256: string;
  resumedFromBytes: number;
  persistentStorageGranted: boolean;
}

export const assertAttachmentQuota = (
  estimate: AttachmentStorageEstimate,
  additionalBytes: number,
  softLimitRatio = 0.7,
): void => {
  if (!Number.isFinite(estimate.quota) || !estimate.quota || estimate.quota <= 0) return;
  const usage = Number.isFinite(estimate.usage) ? Math.max(0, estimate.usage || 0) : 0;
  const projected = usage + Math.max(0, additionalBytes);
  const softLimit = estimate.quota * softLimitRatio;
  if (projected > softLimit) {
    throw new AttachmentQuotaError(
      `Saving this file would exceed the ${Math.round(softLimitRatio * 100)}% local storage safety limit.`,
    );
  }
};

const abortError = (): DOMException => new DOMException('Attachment write cancelled.', 'AbortError');
export const ATTACHMENT_WRITE_CHUNK_BYTES = 64 * 1024;

export class OpfsAttachmentStore {
  constructor(private readonly backend: AttachmentStorageBackend = browserOpfsBackend) {}

  async save(options: SaveAttachmentOptions): Promise<SavedAttachmentObject> {
    const key = validateStorageKey(options.key);
    const totalBytes = options.blob.size;
    const persistenceGranted = await this.backend.requestPersistence().catch(() => false);
    let existingSize = options.resume ? await this.backend.getSize(key) : 0;
    if (existingSize > totalBytes) existingSize = 0;

    const remainingBytes = totalBytes - existingSize;
    assertAttachmentQuota(await this.backend.estimate(), remainingBytes);
    if (options.signal?.aborted) throw abortError();

    const writer = await this.backend.openWriter(key, {
      keepExistingData: existingSize > 0,
      start: existingSize,
    });
    let writtenBytes = existingSize;
    let closed = false;

    try {
      while (writtenBytes < totalBytes) {
        if (options.signal?.aborted) throw abortError();
        const nextOffset = Math.min(totalBytes, writtenBytes + ATTACHMENT_WRITE_CHUNK_BYTES);
        const buffer = await options.blob.slice(writtenBytes, nextOffset).arrayBuffer();
        if (options.signal?.aborted) throw abortError();
        const chunk = new Uint8Array(buffer);
        if (chunk.byteLength === 0) {
          throw new Error('Attachment source returned an empty chunk before completion.');
        }
        await writer.write(chunk);
        writtenBytes = nextOffset;
        options.onProgress?.({
          writtenBytes,
          totalBytes,
          ratio: totalBytes === 0 ? 1 : writtenBytes / totalBytes,
        });
      }
      await writer.close();
      closed = true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (!closed) {
          await writer.close().catch(() => undefined);
          closed = true;
        }
      } else if (!closed) {
        await writer.abort().catch(() => undefined);
      }
      throw error;
    }

    const sizeBytes = await this.backend.getSize(key);
    if (sizeBytes !== totalBytes) {
      throw new Error(`Attachment size mismatch. Expected ${totalBytes}, stored ${sizeBytes}.`);
    }
    const sha256 = await this.hash(key, options.signal);
    options.onProgress?.({ writtenBytes: totalBytes, totalBytes, ratio: 1 });
    return {
      key,
      sizeBytes,
      sha256,
      resumedFromBytes: existingSize,
      persistentStorageGranted: persistenceGranted,
    };
  }

  async hash(key: string, signal?: AbortSignal): Promise<string> {
    const stream = await this.backend.read(validateStorageKey(key));
    const reader = stream.getReader();
    const hash = new IncrementalSha256();
    try {
      while (true) {
        if (signal?.aborted) throw abortError();
        const { value, done } = await reader.read();
        if (done) break;
        if (value?.byteLength) hash.update(value);
      }
      return hash.hexDigest();
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  }

  async getBlob(key: string): Promise<Blob> {
    return this.backend.getBlob(validateStorageKey(key));
  }

  async createObjectUrl(key: string): Promise<{ url: string; revoke: () => void }> {
    const blob = await this.getBlob(key);
    const url = URL.createObjectURL(blob);
    let revoked = false;
    return {
      url,
      revoke: () => {
        if (revoked) return;
        revoked = true;
        URL.revokeObjectURL(url);
      },
    };
  }

  async remove(key: string): Promise<void> {
    await this.backend.remove(validateStorageKey(key));
  }
}

export const opfsAttachmentStore = new OpfsAttachmentStore();
