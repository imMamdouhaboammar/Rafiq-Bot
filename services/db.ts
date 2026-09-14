
import Dexie, { Table } from 'dexie';
import { ChatSession, ChatMessage, UserProfile, MemoryEntry, RandomPrompt, Reaction, AdaptivePersonalityState, BotSettings, ChatSessionSchema, ChatMessageSchema, UserProfileSchema, RandomPromptSchema, MessageRole, type SoulMemorySeed, type SoulSynthesisResult, type ActiveStoryState, ActiveStoryStateSchema } from "../types.js";
import type { MemoryRecord } from '../contracts/rafiqV6.js';
import { applyAdaptivePersonalityMutation, type AdaptivePersonalityMutation } from "./livingPersonaCore.js";

// --- Backup Snapshot Types & Helpers (for local backup/restore) ---
export type BackupSnapshot = {
  chats: ChatSession[];
  messagesByChat: Record<string, ChatMessage[]>;
  updatedAt?: string;
};

export type ProgressiveCloneJobStatus = 'initializing' | 'analyzing' | 'ready' | 'partial' | 'error';

export interface ProgressiveCloneSnapshotRecord {
  settingsPatch: Partial<BotSettings>;
  memorySeeds: SoulMemorySeed[];
  preview?: SoulSynthesisResult;
  /** Opaque cumulative server snapshot passed back on the next batch. */
  serverSnapshot?: unknown;
}

export interface ProgressiveCloneJobRecord {
  version: 1;
  id: string;
  chatId: string;
  targetName: string;
  status: ProgressiveCloneJobStatus;
  processedBatches: number;
  totalBatches: number;
  nextBatchIndex: number;
  batches: string[];
  snapshot: ProgressiveCloneSnapshotRecord;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ProgressiveCloneStagingRecord {
  id: string;
  status: 'staging' | 'committing' | 'committed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  error?: string;
  payload: ProgressiveCloneJobRecord;
}

const toTime = (value: unknown): number => {
  if (!value) return 0;
  const time = new Date(value as string | number | Date).getTime();
  return Number.isFinite(time) ? time : 0;
};

const cleanBackupMessage = (message: ChatMessage): ChatMessage => {
  const clean: ChatMessage = { ...message };
  if (Array.isArray(clean.attachments)) {
    clean.attachments = clean.attachments.map((attachment: any) => {
      const { file, ...rest } = attachment;
      if (typeof rest.previewUrl === "string" && rest.previewUrl.startsWith("blob:")) {
        rest.previewUrl = "";
      }
      return rest;
    });
  }
  return clean;
};

const sanitizeBackupSnapshot = (snapshot: Partial<BackupSnapshot> | null | undefined): BackupSnapshot => {
  const chats = Array.isArray(snapshot?.chats)
    ? snapshot!.chats
        .map(chat => ChatSessionSchema.safeParse(chat))
        .filter((result): result is { success: true; data: ChatSession } => result.success)
        .map(result => result.data)
    : [];

  const messagesByChat: Record<string, ChatMessage[]> = {};
  const rawMessagesByChat = snapshot?.messagesByChat || {};

  for (const [chatId, messages] of Object.entries(rawMessagesByChat)) {
    if (!Array.isArray(messages)) continue;
    const parsedMessages = messages
      .map(message => ChatMessageSchema.safeParse(message))
      .filter((result): result is { success: true; data: ChatMessage } => result.success)
      .map(result => cleanBackupMessage(result.data))
      .sort((a, b) => toTime(a.timestamp) - toTime(b.timestamp));

    if (parsedMessages.length > 0) {
      messagesByChat[chatId] = parsedMessages;
    }
  }

  return {
    chats,
    messagesByChat,
    updatedAt: snapshot?.updatedAt || new Date().toISOString(),
  };
};

const mergeBackupSnapshots = (
  localSnapshot: Partial<BackupSnapshot> | null | undefined,
  remoteSnapshot: Partial<BackupSnapshot> | null | undefined,
): BackupSnapshot => {
  const local = sanitizeBackupSnapshot(localSnapshot);
  const remote = sanitizeBackupSnapshot(remoteSnapshot);
  const chatsById = new Map<string, ChatSession>();

  for (const chat of [...remote.chats, ...local.chats]) {
    const existing = chatsById.get(chat.id);
    if (!existing || toTime(chat.lastMessageTimestamp) >= toTime(existing.lastMessageTimestamp)) {
      chatsById.set(chat.id, chat);
    }
  }

  const messagesByChat: Record<string, ChatMessage[]> = {};
  const allChatIds = new Set([
    ...Object.keys(remote.messagesByChat),
    ...Object.keys(local.messagesByChat),
    ...Array.from(chatsById.keys()),
  ]);

  for (const chatId of allChatIds) {
    const messagesById = new Map<string, ChatMessage>();
    for (const message of [...(remote.messagesByChat[chatId] || []), ...(local.messagesByChat[chatId] || [])]) {
      const existing = messagesById.get(message.id);
      if (!existing || toTime(message.timestamp) >= toTime(existing.timestamp)) {
        messagesById.set(message.id, message);
      }
    }
    const mergedMessages = Array.from(messagesById.values()).sort((a, b) => toTime(a.timestamp) - toTime(b.timestamp));
    if (mergedMessages.length > 0) {
      messagesByChat[chatId] = mergedMessages;
    }
  }

  return {
    chats: Array.from(chatsById.values()).sort((a, b) => toTime(b.lastMessageTimestamp) - toTime(a.lastMessageTimestamp)),
    messagesByChat,
    updatedAt: new Date().toISOString(),
  };
};

// --- Database Definition ---
class RafiqDatabase extends Dexie {
  chats!: Table<ChatSession>;
  messages!: Table<ChatMessage>;
  userProfile!: Table<UserProfile & { id: string }>;
  groupMessages!: Table<ChatMessage>; 
  memoryEntries!: Table<MemoryEntry>;
  randomPrompts!: Table<RandomPrompt>;

  constructor() {
    super('RafiqDB_V5'); 
    
    (this as any).version(1).stores({
      chats: 'id, lastMessageTimestamp', 
      messages: 'id, chatId, timestamp',
      userProfile: 'id'
    });

    (this as any).version(2).stores({
      chats: 'id, lastMessageTimestamp',
      messages: 'id, chatId, timestamp',
      userProfile: 'id',
      groupMessages: 'id, chatId, timestamp'
    });

    // Version 3: Model Field Support (Implicit Schema Update)
    (this as any).version(3).stores({
      chats: 'id, lastMessageTimestamp',
      messages: 'id, chatId, timestamp',
      userProfile: 'id',
      groupMessages: 'id, chatId, timestamp'
    });

    (this as any).version(4).stores({
      chats: 'id, lastMessageTimestamp',
      messages: 'id, chatId, timestamp',
      userProfile: 'id',
      groupMessages: 'id, chatId, timestamp',
      memoryEntries: 'id, chatId, sourceMessageId, createdAt, updatedAt, salience, category, *keywords'
    });

    // Version 5: Random Prompts (floating trigger button)
    (this as any).version(5).stores({
      chats: 'id, lastMessageTimestamp',
      messages: 'id, chatId, timestamp',
      userProfile: 'id',
      groupMessages: 'id, chatId, timestamp',
      memoryEntries: 'id, chatId, sourceMessageId, createdAt, updatedAt, salience, category, *keywords',
      randomPrompts: 'id, userId, enabled, createdAt'
    });
  }
}

export const db = new RafiqDatabase();

const normalizeMessageForClient = (message: ChatMessage): ChatMessage => {
  const parsed = ChatMessageSchema.safeParse(message);
  const normalized = parsed.success ? parsed.data : {
    ...message,
    timestamp: new Date(message.timestamp),
  };

  if (normalized.attachments) {
    normalized.attachments = normalized.attachments.map(att => ({
      ...att,
      previewUrl: (!att.previewUrl && att.base64)
        ? `data:${att.mimeType};base64,${att.base64}`
        : att.previewUrl
    }));
  }

  return normalized;
};

// --- User Profile Management ---

export const saveUserProfile = async (profile: UserProfile): Promise<void> => {
  await db.userProfile.put({ ...profile, id: "main_user" });
};

export const getUserProfile = async (): Promise<UserProfile | null> => {
  const result = await db.userProfile.get("main_user");
  if (!result) return null;
  
  const parsed = UserProfileSchema.safeParse(result);
  if (parsed.success) return parsed.data;
  console.warn("Profile data corrupted, resetting.");
  return null;
};

// --- Chat Sessions Management ---

export const saveChatSession = async (session: ChatSession): Promise<void> => {
  const cleanSession = structuredClone(session);
  await db.chats.put(cleanSession);
};

export const saveCloneMemoryRecords = async (
  legacyEntries: MemoryEntry[],
  memoryRecords: MemoryRecord[],
): Promise<void> => {
  const memoryRecordsTable = db.table<MemoryRecord>('memoryRecords');
  await db.transaction('rw', db.memoryEntries, memoryRecordsTable, async () => {
    if (legacyEntries.length > 0) {
      await db.memoryEntries.bulkPut(legacyEntries.map(entry => structuredClone(entry)));
    }
    if (memoryRecords.length > 0) {
      await memoryRecordsTable.bulkPut(memoryRecords.map(record => structuredClone(record)));
    }
  });
};

const CLONE_SEED_SUFFIX_PATTERN = /^(?:seed|progressive_seed)_\d+$/;

const cloneSeedSuffixFromLegacyId = (chatId: string, id: string): string | null => {
  const prefix = `${chatId}:`;
  if (!id.startsWith(prefix)) return null;
  const suffix = id.slice(prefix.length);
  return CLONE_SEED_SUFFIX_PATTERN.test(suffix) ? suffix : null;
};

/** Exact ID-based guard so ordinary conversation memories are never replaced. */
export const isCloneSeededLegacyMemory = (chatId: string, entry: MemoryEntry): boolean => (
  entry.chatId === chatId && cloneSeedSuffixFromLegacyId(chatId, entry.id) !== null
);

/** Includes direct clone records and V6 records migrated from legacy clone seeds. */
export const isCloneSeededMemoryRecord = (chatId: string, record: MemoryRecord): boolean => {
  if (record.scope !== 'chat' || record.scopeId !== chatId) return false;
  const directPrefix = `clone:${chatId}:`;
  const migratedPrefix = `legacy:${chatId}:`;
  const suffix = record.id.startsWith(directPrefix)
    ? record.id.slice(directPrefix.length)
    : record.id.startsWith(migratedPrefix)
      ? record.id.slice(migratedPrefix.length)
      : '';
  return CLONE_SEED_SUFFIX_PATTERN.test(suffix);
};

const assertCloneMemoryReplacementPayload = (
  chatId: string,
  legacyEntries: MemoryEntry[],
  memoryRecords: MemoryRecord[],
): void => {
  if (legacyEntries.some(entry => !isCloneSeededLegacyMemory(chatId, entry))) {
    throw new Error(`Clone memory replacement contains a non-clone legacy entry for chat ${chatId}.`);
  }
  if (memoryRecords.some(record => !isCloneSeededMemoryRecord(chatId, record))) {
    throw new Error(`Clone memory replacement contains a non-clone V6 record for chat ${chatId}.`);
  }
};

/**
 * Atomically applies edited clone settings and replaces only generated clone
 * seed memories. Message-derived/conversational memories remain untouched.
 */
export const patchChatAndReplaceCloneMemories = async (
  chatId: string,
  patch: {
    settings: BotSettings;
    adaptiveMutation?: AdaptivePersonalityMutation;
    legacyEntries: MemoryEntry[];
    memoryRecords: MemoryRecord[];
  },
): Promise<ChatSession | undefined> => {
  assertCloneMemoryReplacementPayload(chatId, patch.legacyEntries, patch.memoryRecords);
  const memoryRecordsTable = db.table<MemoryRecord>('memoryRecords');

  return db.transaction('rw', db.chats, db.memoryEntries, memoryRecordsTable, async () => {
    const current = await db.chats.get(chatId);
    if (!current) return undefined;

    const { adaptivePersonality: _ignoredAdaptiveSnapshot, ...settingsPatch } = patch.settings;
    const adaptivePersonality = patch.adaptiveMutation
      ? applyAdaptivePersonalityMutation(
          current.settings.adaptivePersonality,
          patch.adaptiveMutation,
          new Date(),
        )
      : current.settings.adaptivePersonality;
    const updated: ChatSession = {
      ...current,
      settings: {
        ...current.settings,
        ...structuredClone(settingsPatch),
        adaptivePersonality,
      },
    };

    await db.memoryEntries
      .where('chatId')
      .equals(chatId)
      .filter(entry => isCloneSeededLegacyMemory(chatId, entry))
      .delete();
    await memoryRecordsTable
      .where('[scope+scopeId]')
      .equals(['chat', chatId])
      .filter(record => isCloneSeededMemoryRecord(chatId, record))
      .delete();

    if (patch.legacyEntries.length > 0) {
      await db.memoryEntries.bulkPut(patch.legacyEntries.map(entry => structuredClone(entry)));
    }
    if (patch.memoryRecords.length > 0) {
      await memoryRecordsTable.bulkPut(patch.memoryRecords.map(record => structuredClone(record)));
    }
    await db.chats.put(updated);
    return updated;
  });
};

const SOUL_MEMORY_CATEGORIES = new Set<SoulMemorySeed['category']>([
  'identity',
  'preference',
  'memory',
  'goal',
  'fact',
  'emotion',
]);

/** Rehydrates editable seeds for clone profiles created before memorySeeds existed. */
export const getCloneMemorySeedsForChat = async (chatId: string): Promise<SoulMemorySeed[]> => {
  const entries = await db.memoryEntries
    .where('chatId')
    .equals(chatId)
    .filter(entry => isCloneSeededLegacyMemory(chatId, entry))
    .toArray();

  return entries
    .sort((left, right) => {
      const leftSuffix = cloneSeedSuffixFromLegacyId(chatId, left.id) || '';
      const rightSuffix = cloneSeedSuffixFromLegacyId(chatId, right.id) || '';
      const leftIndex = Number(leftSuffix.match(/\d+$/)?.[0] || 0);
      const rightIndex = Number(rightSuffix.match(/\d+$/)?.[0] || 0);
      return leftIndex - rightIndex || left.id.localeCompare(right.id);
    })
    .filter(entry => entry.text.trim().length > 0 && SOUL_MEMORY_CATEGORIES.has(entry.category as SoulMemorySeed['category']))
    .map(entry => ({
      text: entry.text.trim(),
      category: entry.category as SoulMemorySeed['category'],
      salience: Math.max(0, Math.min(1, entry.salience)),
      subject: entry.sourceRole === MessageRole.USER ? 'user' as const : 'persona' as const,
    }));
};

export const saveClonedChatSession = async (
  session: ChatSession,
  legacyEntries: MemoryEntry[],
  memoryRecords: MemoryRecord[],
): Promise<void> => {
  const memoryRecordsTable = db.table<MemoryRecord>('memoryRecords');
  await db.transaction('rw', db.chats, db.memoryEntries, memoryRecordsTable, async () => {
    await db.chats.put(structuredClone(session));
    if (legacyEntries.length > 0) {
      await db.memoryEntries.bulkPut(legacyEntries.map(entry => structuredClone(entry)));
    }
    if (memoryRecords.length > 0) {
      await memoryRecordsTable.bulkPut(memoryRecords.map(record => structuredClone(record)));
    }
  });
};

const progressiveCloneStorageId = (jobId: string): string => `progressive-clone:${jobId}`;

const toProgressiveCloneStagingStatus = (
  status: ProgressiveCloneJobStatus,
): ProgressiveCloneStagingRecord['status'] => {
  if (status === 'ready') return 'committed';
  if (status === 'partial' || status === 'error') return 'failed';
  if (status === 'analyzing') return 'committing';
  return 'staging';
};

const createProgressiveCloneStagingRecord = (
  job: ProgressiveCloneJobRecord,
): ProgressiveCloneStagingRecord => ({
  id: progressiveCloneStorageId(job.id),
  status: toProgressiveCloneStagingStatus(job.status),
  createdAt: new Date(job.createdAt),
  updatedAt: new Date(job.updatedAt),
  error: job.error,
  payload: structuredClone(job),
});

const patchProgressiveCloneChat = async (
  chatId: string,
  settingsPatch: Partial<BotSettings>,
): Promise<ChatSession> => {
  const current = await db.chats.get(chatId);
  if (!current) throw new Error(`Progressive clone chat not found: ${chatId}`);
  const updated: ChatSession = {
    ...current,
    settings: {
      ...current.settings,
      ...structuredClone(settingsPatch),
    },
  };
  await db.chats.put(updated);
  return updated;
};

export const saveProgressiveCloneJob = async (
  job: ProgressiveCloneJobRecord,
  settingsPatch?: Partial<BotSettings>,
): Promise<void> => {
  const jobsTable = db.table<ProgressiveCloneStagingRecord>('transferStaging');
  const tables = settingsPatch ? [db.chats, jobsTable] : [jobsTable];
  await db.transaction('rw', tables, async () => {
    if (settingsPatch) await patchProgressiveCloneChat(job.chatId, settingsPatch);
    await jobsTable.put(createProgressiveCloneStagingRecord(job));
  });
};

export const getProgressiveCloneJob = async (
  jobId: string,
): Promise<ProgressiveCloneJobRecord | undefined> => {
  const jobsTable = db.table<ProgressiveCloneStagingRecord>('transferStaging');
  const stored = await jobsTable.get(progressiveCloneStorageId(jobId));
  const payload = stored?.payload;
  if (!payload || payload.version !== 1 || payload.id !== jobId || !Array.isArray(payload.batches)) {
    return undefined;
  }
  return {
    ...structuredClone(payload),
    createdAt: new Date(payload.createdAt),
    updatedAt: new Date(payload.updatedAt),
  };
};

export const commitProgressiveCloneBatch = async ({
  job,
  settingsPatch,
  legacyEntries,
  memoryRecords,
}: {
  job: ProgressiveCloneJobRecord;
  settingsPatch: Partial<BotSettings>;
  legacyEntries: MemoryEntry[];
  memoryRecords: MemoryRecord[];
}): Promise<void> => {
  const memoryRecordsTable = db.table<MemoryRecord>('memoryRecords');
  const jobsTable = db.table<ProgressiveCloneStagingRecord>('transferStaging');
  await db.transaction(
    'rw',
    db.chats,
    db.memoryEntries,
    memoryRecordsTable,
    jobsTable,
    async () => {
      await patchProgressiveCloneChat(job.chatId, settingsPatch);
      if (legacyEntries.length > 0) {
        await db.memoryEntries.bulkPut(legacyEntries.map(entry => structuredClone(entry)));
      }
      if (memoryRecords.length > 0) {
        await memoryRecordsTable.bulkPut(memoryRecords.map(record => structuredClone(record)));
      }
      await jobsTable.put(createProgressiveCloneStagingRecord(job));
    },
  );
};

type SafeChatSessionFields = Partial<Omit<ChatSession, "id" | "settings">>;

/**
 * Atomically patches one chat while preserving fields written by background jobs.
 * adaptivePersonality snapshots in settings are intentionally ignored; callers
 * must express pause/reset as a mutation applied to the latest stored state.
 */
export const patchChatSession = async (
  chatId: string,
  patch: {
    fields?: SafeChatSessionFields;
    settings?: Partial<BotSettings>;
    adaptiveMutation?: AdaptivePersonalityMutation;
  },
): Promise<ChatSession | undefined> => db.transaction('rw', db.chats, async () => {
  const current = await db.chats.get(chatId);
  if (!current) return undefined;

  const { adaptivePersonality: _ignoredAdaptiveSnapshot, ...settingsPatch } = patch.settings || {};
  const adaptivePersonality = patch.adaptiveMutation
    ? applyAdaptivePersonalityMutation(
        current.settings.adaptivePersonality,
        patch.adaptiveMutation,
        new Date(),
      )
    : current.settings.adaptivePersonality;
  const updated: ChatSession = {
    ...current,
    ...(patch.fields || {}),
    settings: {
      ...current.settings,
      ...settingsPatch,
      adaptivePersonality,
    },
  };
  await db.chats.put(updated);
  return updated;
});

export const commitAdaptivePersonality = async (
  chatId: string,
  expectedVersion: number,
  adaptivePersonality: AdaptivePersonalityState,
): Promise<ChatSession | undefined> => db.transaction('rw', db.chats, async () => {
  const current = await db.chats.get(chatId);
  if (!current) return undefined;
  const currentVersion = current.settings.adaptivePersonality?.version || 1;
  if (currentVersion !== expectedVersion) return undefined;

  const updated: ChatSession = {
    ...current,
    settings: {
      ...current.settings,
      adaptivePersonality: structuredClone(adaptivePersonality),
    },
  };
  await db.chats.put(updated);
  return updated;
});

export const getChatSession = async (id: string): Promise<ChatSession | undefined> => {
  const session = await db.chats.get(id);
  if (!session) return undefined;
  
  const parsed = ChatSessionSchema.safeParse(session);
  return parsed.success ? parsed.data : session as ChatSession;
};

export const getChatSessionsByIds = async (ids: string[]): Promise<ChatSession[]> => {
  const sessions = await db.chats.bulkGet(ids);
  return sessions.filter((s): s is ChatSession => !!s);
};

export const getGroupsForBot = async (botId: string): Promise<ChatSession[]> => {
  const allChats = await db.chats.toArray();
  return allChats.filter(c => c.isGroup && c.memberIds?.includes(botId));
};

export const getChatSessions = async (): Promise<ChatSession[]> => {
  const sessions = await db.chats.orderBy('lastMessageTimestamp').reverse().toArray();
  return sessions.map(s => {
      const parsed = ChatSessionSchema.safeParse(s);
      return parsed.success ? parsed.data : s as ChatSession;
  });
};

export const exportLocalBackup = async (): Promise<BackupSnapshot> => {
  const chats = await getChatSessions();
  const messagesByChat: Record<string, ChatMessage[]> = {};

  await Promise.all(chats.map(async chat => {
    const messages = await getMessagesForChat(chat.id, undefined, !!chat.isGroup);
    if (messages.length > 0) {
      messagesByChat[chat.id] = messages;
    }
  }));

  return sanitizeBackupSnapshot({
    chats,
    messagesByChat,
    updatedAt: new Date().toISOString(),
  });
};

export const importLocalBackup = async (remoteSnapshot: BackupSnapshot): Promise<BackupSnapshot> => {
  const localSnapshot = await exportLocalBackup();
  const mergedSnapshot = mergeBackupSnapshots(localSnapshot, remoteSnapshot);

  await (db as any).transaction('rw', db.chats, db.messages, db.groupMessages, async () => {
    await db.chats.bulkPut(mergedSnapshot.chats);

    for (const chat of mergedSnapshot.chats) {
      const messages = mergedSnapshot.messagesByChat[chat.id] || [];
      if (messages.length === 0) continue;
      const table = chat.isGroup ? db.groupMessages : db.messages;
      await table.bulkPut(messages.map(message => ({ ...message, isThinking: false })));
    }
  });

  return mergedSnapshot;
};

export const deleteChatSession = async (chatId: string): Promise<void> => {
  const memoryRecordsTable = db.table<MemoryRecord>('memoryRecords');
  await (db as any).transaction('rw', db.chats, db.messages, db.groupMessages, db.memoryEntries, memoryRecordsTable, async () => {
    await db.chats.delete(chatId);
    await db.messages.where('chatId').equals(chatId).delete();
    await db.groupMessages.where('chatId').equals(chatId).delete();
    await db.memoryEntries.where('chatId').equals(chatId).delete();
    await memoryRecordsTable.where('[scope+scopeId]').equals(['chat', chatId]).delete();
    await memoryRecordsTable.where('[scope+scopeId]').equals(['bot', chatId]).delete();
  });
};

export const markChatAsRead = async (chatId: string): Promise<void> => {
  await db.chats.update(chatId, { unreadCount: 0 });
};

export const updateChatUnreadCount = async (chatId: string, reset: boolean = false): Promise<void> => {
    if (reset) {
        await db.chats.update(chatId, { unreadCount: 0 });
    } else {
        const chat = await db.chats.get(chatId);
        if (chat) {
            await db.chats.update(chatId, { unreadCount: (chat.unreadCount || 0) + 1 });
        }
    }
};

// --- Messages Management ---

export const saveMessage = async (message: ChatMessage): Promise<void> => {
  await (db as any).transaction('rw', db.messages, db.chats, async () => {
    const msgToStore = { ...message, isThinking: false };
    if (msgToStore.attachments) {
        msgToStore.attachments = msgToStore.attachments.map(att => {
            const { file, ...rest } = att; 
            if (rest.previewUrl && rest.previewUrl.startsWith('blob:')) {
                rest.previewUrl = ''; 
            }
            return rest;
        });
    }

    await db.messages.put(msgToStore);

    const previewText = message.text || (message.attachments?.length ? 'Sent an attachment' : '...');
    await db.chats.update(message.chatId, {
        lastMessage: previewText,
        lastMessageTimestamp: message.timestamp
    });
  });
};

// --- Group Message Management (New) ---

export const saveGroupMessage = async (message: ChatMessage): Promise<void> => {
  await (db as any).transaction('rw', db.groupMessages, db.chats, async () => {
    const msgToStore = { ...message, isThinking: false };
    // Attachments sanitization
    if (msgToStore.attachments) {
        msgToStore.attachments = msgToStore.attachments.map(att => {
            const { file, ...rest } = att; 
            if (rest.previewUrl && rest.previewUrl.startsWith('blob:')) {
                rest.previewUrl = ''; 
            }
            return rest;
        });
    }

    await db.groupMessages.put(msgToStore);

    // Update Chat Preview
    const attachmentPreview = message.attachments?.[0]?.fileName || 'مرفق';
    const previewText = `${message.senderName || (message.senderId === 'user' ? 'أنت' : message.senderId)}: ${message.text || attachmentPreview}`;
    await db.chats.update(message.chatId, {
        lastMessage: previewText,
        lastMessageTimestamp: message.timestamp
    });
  });
};

export const saveGroupMessageReaction = async (
  groupId: string,
  messageId: string,
  reaction: Reaction,
): Promise<void> => {
  await (db as any).transaction('rw', db.groupMessages, async () => {
    const message = await db.groupMessages.get(messageId);
    if (!message || message.chatId !== groupId) return;

    const reactions = (message.reactions || []).filter(
      existing => existing.senderId !== reaction.senderId,
    );
    await db.groupMessages.update(messageId, {
      reactions: [...reactions, reaction],
    });
  });
};

export const getMessagesForChat = async (chatId: string, limit?: number, isGroup: boolean = false): Promise<ChatMessage[]> => {
  const table = isGroup ? db.groupMessages : db.messages;
  
  if (limit) {
    // Fetch all matching, sort, then take last N — Dexie doesn't support compound reverse + limit on sortBy
    const all = await table.where('chatId').equals(chatId).sortBy('timestamp');
    const sliced = all.length > limit ? all.slice(-limit) : all;
    return sliced.map(normalizeMessageForClient);
  }
  
  const messages = await table.where('chatId').equals(chatId).sortBy('timestamp');
  return messages.map(normalizeMessageForClient);
};

export const saveMemoryEntry = async (entry: MemoryEntry): Promise<void> => {
  await db.memoryEntries.put(structuredClone(entry));
};

export const bulkUpsertMemoryEntries = async (entries: MemoryEntry[]): Promise<void> => {
  await db.memoryEntries.bulkPut(entries.map(entry => structuredClone(entry)));
};

export const getMemoryEntriesForChat = async (chatId: string): Promise<MemoryEntry[]> => {
  const entries = await db.memoryEntries.where('chatId').equals(chatId).sortBy('updatedAt');
  return entries.reverse().map(entry => ({
    ...entry,
    createdAt: new Date(entry.createdAt),
    updatedAt: new Date(entry.updatedAt),
  }));
};

export const countMemoryEntriesForChat = async (chatId: string): Promise<number> => (
  db.memoryEntries.where('chatId').equals(chatId).count()
);

export const deleteMessage = async (messageId: string, chatId: string, isGroup: boolean = false): Promise<void> => {
  const table = isGroup ? db.groupMessages : db.messages;
  await table.delete(messageId);
  
  // Update chat preview to last remaining message
  const remaining = await table.where('chatId').equals(chatId).sortBy('timestamp');
  if (remaining.length > 0) {
    const lastMsg = remaining[remaining.length - 1];
    const contentPreview = lastMsg.text || (lastMsg.attachments?.length ? '📎' : '...');
    const previewText = isGroup
      ? `${lastMsg.senderName || (lastMsg.senderId === 'user' ? 'أنت' : lastMsg.senderId)}: ${contentPreview}`
      : contentPreview;
    await db.chats.update(chatId, {
      lastMessage: previewText,
      lastMessageTimestamp: lastMsg.timestamp
    });
  } else {
    await db.chats.update(chatId, {
      lastMessage: '',
      lastMessageTimestamp: new Date()
    });
  }
};

export const deleteMessageForMe = async (messageId: string, chatId: string, isGroup: boolean = false): Promise<void> => {
  // "Delete for me" - just mark the message as deleted locally without removing from DB
  // This hides it from the UI but keeps it in DB for the other party (future multi-user support)
  const table = isGroup ? db.groupMessages : db.messages;
  await table.update(messageId, { deletedForMe: true });
};

// --- Random Prompts Management (Floating Trigger Button) ---

const normalizePrompt = (prompt: RandomPrompt): RandomPrompt => {
  const parsed = RandomPromptSchema.safeParse(prompt);
  return parsed.success ? parsed.data : {
    ...prompt,
    createdAt: new Date(prompt.createdAt),
    updatedAt: new Date(prompt.updatedAt),
    lastUsedAt: prompt.lastUsedAt ? new Date(prompt.lastUsedAt) : undefined,
  };
};

export const saveRandomPrompt = async (prompt: RandomPrompt): Promise<void> => {
  const cleanPrompt = structuredClone(prompt);
  await db.randomPrompts.put(cleanPrompt);
};

export const getRandomPromptsForUser = async (userId: string): Promise<RandomPrompt[]> => {
  const prompts = await db.randomPrompts.where('userId').equals(userId).toArray();
  return prompts.map(normalizePrompt);
};

export const getEnabledRandomPrompts = async (userId: string): Promise<RandomPrompt[]> => {
  const prompts = await db.randomPrompts.where('userId').equals(userId).toArray();
  return prompts.filter(p => p.enabled).map(normalizePrompt);
};

export const pickRandomPromptForUser = async (userId: string): Promise<RandomPrompt | null> => {
  const enabled = await getEnabledRandomPrompts(userId);
  if (enabled.length === 0) return null;
  const picked = enabled[Math.floor(Math.random() * enabled.length)];
  // Update use stats (fire and forget — don't block)
  void db.randomPrompts.update(picked.id, {
    useCount: (picked.useCount || 0) + 1,
    lastUsedAt: new Date(),
  });
  return picked;
};

export const deleteRandomPrompt = async (promptId: string): Promise<void> => {
  await db.randomPrompts.delete(promptId);
};

export const toggleRandomPrompt = async (promptId: string, enabled: boolean): Promise<void> => {
  await db.randomPrompts.update(promptId, { enabled, updatedAt: new Date() });
};

export const countEnabledRandomPrompts = async (userId: string): Promise<number> => {
  return db.randomPrompts.where('userId').equals(userId).filter(p => p.enabled === true).count();
};

// --- Active Slow Burn Story State Management ---
const activeStoriesByChat = new Map<string, ActiveStoryState>();

export const saveActiveStory = async (story: ActiveStoryState): Promise<void> => {
  activeStoriesByChat.set(story.chatId, structuredClone(story));
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`rafiq_active_story_${story.chatId}`, JSON.stringify(story));
    }
  } catch {}
};

export const getActiveStory = async (chatId: string): Promise<ActiveStoryState | undefined> => {
  const cached = activeStoriesByChat.get(chatId);
  if (cached) return structuredClone(cached);
  try {
    if (typeof localStorage !== 'undefined') {
      const item = localStorage.getItem(`rafiq_active_story_${chatId}`);
      if (item) {
        const parsed = JSON.parse(item);
        const story: ActiveStoryState = {
          ...parsed,
          createdAt: new Date(parsed.createdAt),
          updatedAt: new Date(parsed.updatedAt),
        };
        activeStoriesByChat.set(chatId, story);
        return story;
      }
    }
  } catch {}
  return undefined;
};

export const clearActiveStory = async (chatId: string): Promise<void> => {
  activeStoriesByChat.delete(chatId);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(`rafiq_active_story_${chatId}`);
    }
  } catch {}
};

export const updateActiveStory = async (
  chatId: string,
  patch: Partial<ActiveStoryState>,
): Promise<ActiveStoryState | undefined> => {
  const existing = await getActiveStory(chatId);
  if (!existing) return undefined;
  const updated: ActiveStoryState = {
    ...existing,
    ...patch,
    updatedAt: new Date(),
  };
  await saveActiveStory(updated);
  return updated;
};

