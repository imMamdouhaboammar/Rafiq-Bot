import type { Table } from 'dexie';
import {
  AttachmentRecordSchema,
  BotStoryEventSchema,
  LifeStoryEventSchema,
  MemoryRecordSchema,
  type AttachmentRecord,
  type RafiqTransferV2,
} from '../contracts/rafiqV6.js';
import {
  ChatMessageSchema,
  ChatSessionSchema,
  type ChatMessage,
  type ChatSession,
} from '../types.js';
import { db } from './db.js';
import type {
  TransactionalTransferStore,
  TransferDataset,
  TransferStageRecord,
} from './transactionalTransferImport.js';
import { v6Tables, type TransferStagingRecord } from './v6Tables.js';

const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) throw new DOMException('Transfer import cancelled.', 'AbortError');
};

const readChatId = (message: ChatMessage): string => message.chatId;

export const splitTransferMessages = (
  messages: ChatMessage[],
  chats: ChatSession[],
): { direct: ChatMessage[]; groups: ChatMessage[] } => {
  const groupIds = new Set(chats.filter(chat => chat.isGroup).map(chat => chat.id));
  return messages.reduce<{ direct: ChatMessage[]; groups: ChatMessage[] }>((result, message) => {
    (groupIds.has(readChatId(message)) ? result.groups : result.direct).push(message);
    return result;
  }, { direct: [], groups: [] });
};

const parseChats = (values: unknown[]): ChatSession[] => values.map((value, index) => {
  const parsed = ChatSessionSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Imported chat at index ${index} is invalid: ${parsed.error.issues[0]?.message || 'unknown error'}`);
  }
  return parsed.data;
});

const parseMessages = (values: unknown[]): ChatMessage[] => values.map((value, index) => {
  const parsed = ChatMessageSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Imported message at index ${index} is invalid: ${parsed.error.issues[0]?.message || 'unknown error'}`);
  }
  return {
    ...parsed.data,
    isThinking: false,
    attachments: parsed.data.attachments?.map(attachment => ({
      ...attachment,
      previewUrl: '',
      base64: undefined,
      file: undefined,
    })),
  };
});

const materializeMissingAttachment = (
  value: RafiqTransferV2['attachments'][number] | AttachmentRecord,
): AttachmentRecord => AttachmentRecordSchema.parse({
  ...value,
  opfsKey: `missing-${value.id}`,
  availability: 'missing',
  processingProgress: 0,
  updatedAt: new Date(),
});

const clearAndPut = async <T, TKey>(table: Table<T, TKey>, values: T[]): Promise<void> => {
  await table.clear();
  if (values.length > 0) await table.bulkPut(values);
};

export class DexieTransactionalTransferStore implements TransactionalTransferStore {
  async snapshot(): Promise<TransferDataset> {
    const [
      chats,
      directMessages,
      groupMessages,
      lifeStoryEvents,
      botStoryEvents,
      memories,
      attachments,
    ] = await Promise.all([
      db.chats.toArray(),
      db.messages.toArray(),
      db.groupMessages.toArray(),
      v6Tables.lifeStoryEvents().toArray(),
      v6Tables.botStoryEvents().toArray(),
      v6Tables.memoryRecords().toArray(),
      v6Tables.attachmentRecords().toArray(),
    ]);
    return {
      chats,
      messages: [...directMessages, ...groupMessages],
      lifeStoryEvents,
      botStoryEvents,
      memories,
      attachments,
    };
  }

  async apply(
    transfer: RafiqTransferV2,
    context: {
      signal?: AbortSignal;
      onProgress?: (completedUnits: number, totalUnits: number) => void;
    },
  ): Promise<void> {
    const importedChats = parseChats(transfer.chats);
    const importedMessages = parseMessages(transfer.messages);
    const splitMessages = splitTransferMessages(importedMessages, importedChats);
    const lifeStoryEvents = transfer.lifeStoryEvents.map(value => LifeStoryEventSchema.parse(value));
    const botStoryEvents = transfer.botStoryEvents.map(value => BotStoryEventSchema.parse(value));
    const memories = transfer.memories.map(value => MemoryRecordSchema.parse(value));
    const attachments = transfer.attachments.map(materializeMissingAttachment);
    const totalUnits = 7;
    let completedUnits = 0;
    const report = () => context.onProgress?.(++completedUnits, totalUnits);

    throwIfAborted(context.signal);
    await db.transaction(
      'rw',
      [
        db.chats,
        db.messages,
        db.groupMessages,
        v6Tables.lifeStoryEvents(),
        v6Tables.botStoryEvents(),
        v6Tables.memoryRecords(),
        v6Tables.attachmentRecords(),
      ],
      async () => {
        throwIfAborted(context.signal);
        if (importedChats.length > 0) await db.chats.bulkPut(importedChats);
        report();

        throwIfAborted(context.signal);
        if (splitMessages.direct.length > 0) await db.messages.bulkPut(splitMessages.direct);
        report();

        throwIfAborted(context.signal);
        if (splitMessages.groups.length > 0) await db.groupMessages.bulkPut(splitMessages.groups);
        report();

        throwIfAborted(context.signal);
        if (lifeStoryEvents.length > 0) await v6Tables.lifeStoryEvents().bulkPut(lifeStoryEvents);
        report();

        throwIfAborted(context.signal);
        if (botStoryEvents.length > 0) await v6Tables.botStoryEvents().bulkPut(botStoryEvents);
        report();

        throwIfAborted(context.signal);
        if (memories.length > 0) await v6Tables.memoryRecords().bulkPut(memories);
        report();

        throwIfAborted(context.signal);
        if (attachments.length > 0) await v6Tables.attachmentRecords().bulkPut(attachments);
        report();
      },
    );
  }

  async restore(snapshot: TransferDataset): Promise<void> {
    const chats = parseChats(snapshot.chats);
    const messages = parseMessages(snapshot.messages);
    const splitMessages = splitTransferMessages(messages, chats);
    const lifeStoryEvents = snapshot.lifeStoryEvents.map(value => LifeStoryEventSchema.parse(value));
    const botStoryEvents = snapshot.botStoryEvents.map(value => BotStoryEventSchema.parse(value));
    const memories = snapshot.memories.map(value => MemoryRecordSchema.parse(value));
    const attachments = snapshot.attachments.map(materializeMissingAttachment);

    await db.transaction(
      'rw',
      [
        db.chats,
        db.messages,
        db.groupMessages,
        v6Tables.lifeStoryEvents(),
        v6Tables.botStoryEvents(),
        v6Tables.memoryRecords(),
        v6Tables.attachmentRecords(),
      ],
      async () => {
        await clearAndPut(db.chats, chats);
        await clearAndPut(db.messages, splitMessages.direct);
        await clearAndPut(db.groupMessages, splitMessages.groups);
        await clearAndPut(v6Tables.lifeStoryEvents(), lifeStoryEvents);
        await clearAndPut(v6Tables.botStoryEvents(), botStoryEvents);
        await clearAndPut(v6Tables.memoryRecords(), memories);
        await clearAndPut(v6Tables.attachmentRecords(), attachments);
      },
    );
  }

  async saveStage(record: TransferStageRecord): Promise<void> {
    const stagingRecord: TransferStagingRecord = {
      id: record.id,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      error: record.error,
      payload: {
        warnings: record.warnings,
        counts: record.counts,
      },
    };
    await v6Tables.transferStaging().put(stagingRecord);
  }
}

export const dexieTransactionalTransferStore = new DexieTransactionalTransferStore();
