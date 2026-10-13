/**
 * RAFIQ COMPANION TRANSFER ENGINE
 * Export & Import companions as structured, portable .rafiq / .rafiq.json files.
 * Supports:
 * - With conversation (without media): text, replies, timestamps, reactions, and memories.
 * - Settings only (without conversation): personality, soul, voice, traits, and clone blueprints.
 */

import { z } from 'zod';
import {
  ChatSession,
  ChatMessage,
  MemoryEntry,
  UserProfile,
  BotMood,
  SoulMemorySeed,
} from '../types.js';
import * as DB from './db.js';
import { buildBlueprintMemoryRecords } from './memoryEngine.js';

// --- Format Constants ---
export const COMPANION_PACKAGE_FORMAT = 'rafiq-companion-package' as const;
export const COMPANION_PACKAGE_VERSION = 2 as const;
export const LEGACY_FORMAT_ID = 'rafiq-chat-export' as const;
export const LEGACY_FORMAT_VERSION = 1 as const;

export type CompanionExportMode = 'with_messages' | 'settings_only';

// --- Zod Validation Schemas ---

export const CompanionExportModeSchema = z.enum(['with_messages', 'settings_only']);

export const CompanionPackageMetadataSchema = z.object({
  companionName: z.string(),
  companionGender: z.enum(['male', 'female']).optional(),
  soulId: z.string().optional(),
  isCloned: z.boolean().default(false),
  counts: z.object({
    messages: z.number().int().nonnegative(),
    memories: z.number().int().nonnegative(),
  }),
  features: z.object({
    includesConversation: z.boolean(),
    includesMedia: z.literal(false),
  }),
  appVersion: z.string().default('0.1.0'),
});

export const RafiqCompanionPackageSchema = z.object({
  format: z.literal(COMPANION_PACKAGE_FORMAT),
  version: z.literal(COMPANION_PACKAGE_VERSION),
  exportedAt: z.string(),
  exportMode: CompanionExportModeSchema,
  source: z.enum(['desktop', 'mobile', 'unknown']).default('unknown'),
  metadata: CompanionPackageMetadataSchema,
  data: z.object({
    chatSession: z.any(),
    messages: z.array(z.any()).default([]),
    memoryEntries: z.array(z.any()).default([]),
    userProfile: z.any().nullable().optional(),
  }),
});

export type RafiqCompanionPackage = z.infer<typeof RafiqCompanionPackageSchema>;

export interface LegacyRafiqExportFile {
  format: typeof LEGACY_FORMAT_ID;
  version: number;
  exportedAt: string;
  source: 'desktop' | 'mobile' | 'unknown';
  data: {
    chatSession: ChatSession;
    messages: ChatMessage[];
    memoryEntries: MemoryEntry[];
    userProfile: UserProfile | null;
  };
}

// --- Sanitization & Cleaning ---

/**
 * Strips all binary, base64, and temporary blob/opfs URLs from attachments.
 * Preserves safe metadata (fileName, mimeType, category) so chat structure remains intact.
 */
export const sanitizeMessagesWithoutMedia = (messages: ChatMessage[]): ChatMessage[] => {
  return messages.map(msg => {
    if (!msg.attachments || msg.attachments.length === 0) {
      return { ...msg };
    }

    const cleanedAttachments = msg.attachments.map(att => {
      const { file: _file, base64: _base64, previewUrl: _previewUrl, ...rest } = att as any;
      return {
        ...rest,
        // Preview URL is emptied since media binary data is stripped
        previewUrl: '',
      };
    });

    return {
      ...msg,
      attachments: cleanedAttachments,
    };
  });
};

/**
 * Validates whether an object is a modern companion package v2.
 */
export const validateCompanionPackage = (content: unknown): content is RafiqCompanionPackage => {
  const result = RafiqCompanionPackageSchema.safeParse(content);
  return result.success;
};

/**
 * Validates whether an object is a legacy v1 export file.
 */
export const validateLegacyExportFile = (content: unknown): content is LegacyRafiqExportFile => {
  if (!content || typeof content !== 'object') return false;
  const obj = content as Record<string, unknown>;
  if (obj.format !== LEGACY_FORMAT_ID) return false;
  if (typeof obj.version !== 'number' || obj.version < 1) return false;
  if (!obj.data || typeof obj.data !== 'object') return false;

  const data = obj.data as Record<string, unknown>;
  if (!data.chatSession || typeof data.chatSession !== 'object') return false;
  if (!Array.isArray(data.messages)) return false;

  return true;
};

// --- Export Functionality ---

export interface ExportCompanionDbAdapter {
  getChatSession: (id: string) => Promise<ChatSession | undefined>;
  getMessagesForChat: (id: string, limit?: number, isGroup?: boolean) => Promise<ChatMessage[]>;
  getMemoryEntriesForChat: (id: string) => Promise<MemoryEntry[]>;
  getUserProfile: () => Promise<UserProfile | null>;
}

export interface ExportCompanionOptions {
  mode: CompanionExportMode;
  dbAdapter?: ExportCompanionDbAdapter;
}

export const exportCompanionPackage = async (
  chatId: string,
  options: ExportCompanionOptions,
): Promise<{ blob: Blob; fileName: string; packageData: RafiqCompanionPackage }> => {
  const getSession = options.dbAdapter?.getChatSession ?? DB.getChatSession;
  const getMessages = options.dbAdapter?.getMessagesForChat ?? DB.getMessagesForChat;
  const getMemories = options.dbAdapter?.getMemoryEntriesForChat ?? DB.getMemoryEntriesForChat;
  const getProfile = options.dbAdapter?.getUserProfile ?? DB.getUserProfile;

  // 1. Gather chat session from database
  const chatSession = await getSession(chatId);
  if (!chatSession) {
    throw new Error(`الرفيق غير موجود: ${chatId}`);
  }

  const userProfile = await getProfile();
  const botName = chatSession.isGroup
    ? (chatSession.groupName || 'مجموعة')
    : chatSession.settings.botName;
  const safeName = botName.replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_').slice(0, 30);
  const dateStr = new Date().toISOString().slice(0, 10);

  // 2. Mode: Settings only (Without conversation)
  if (options.mode === 'settings_only') {
    const clonedSettings = structuredClone(chatSession.settings);

    // Clean adaptive personality message evidence
    if (clonedSettings.adaptivePersonality) {
      clonedSettings.adaptivePersonality = {
        ...clonedSettings.adaptivePersonality,
        evidence: [],
        processedMessageIds: [],
        currentSessionKey: undefined,
        lastBatchId: undefined,
        dailyDeltaBps: {},
        runsToday: 0,
        observationCount: 0,
        lastObservedUserAt: undefined,
        lastRunAt: undefined,
        observeAfter: undefined,
        updatedAt: new Date(),
      };
    }

    // Reset progressive clone runtime status if present while preserving persona traits
    if (clonedSettings.cloneProfile?.analysis) {
      clonedSettings.cloneProfile = {
        ...clonedSettings.cloneProfile,
        analysis: {
          ...clonedSettings.cloneProfile.analysis,
          status: 'ready',
          error: undefined,
          updatedAt: new Date().toISOString(),
        },
      };
    }

    const baselinePsychology = {
      mood: BotMood.NEUTRAL,
      energyLevel: 8,
      socialMeter: 5,
      emotionalLedger: 0,
      currentScenario: 'Standard Routine',
      intimacyLevel: 5,
      lastInteractionTime: new Date(),
      secretUnlocked: false,
      hungerLevel: 20,
      financialStress: 30,
      sleepiness: 0,
      tier: chatSession.psychology?.tier || 'pro',
      isPro: chatSession.psychology?.isPro ?? true,
      isBlocked: false,
    };

    const cleanSession: ChatSession = {
      ...chatSession,
      settings: clonedSettings,
      psychology: baselinePsychology,
      continuityState: undefined,
      lastMessage: undefined,
      lastMessageTimestamp: new Date(),
      unreadCount: 0,
    };

    const packageData: RafiqCompanionPackage = {
      format: COMPANION_PACKAGE_FORMAT,
      version: COMPANION_PACKAGE_VERSION,
      exportedAt: new Date().toISOString(),
      exportMode: 'settings_only',
      source: detectPlatform(),
      metadata: {
        companionName: botName,
        companionGender: chatSession.settings.botGender,
        soulId: chatSession.settings.soulId,
        isCloned: Boolean(chatSession.settings.cloneProfile),
        counts: {
          messages: 0,
          memories: 0,
        },
        features: {
          includesConversation: false,
          includesMedia: false,
        },
        appVersion: '0.1.0',
      },
      data: {
        chatSession: JSON.parse(JSON.stringify(cleanSession)),
        messages: [],
        memoryEntries: [],
        userProfile: userProfile ? JSON.parse(JSON.stringify(userProfile)) : null,
      },
    };

    const json = JSON.stringify(packageData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const fileName = `${safeName}_settings_${dateStr}.rafiq.json`;

    return { blob, fileName, packageData };
  }

  // 3. Mode: With conversation (Without media)
  const isGroup = !!chatSession.isGroup;
  const rawMessages = await getMessages(chatId, undefined, isGroup);
  const rawMemories = await getMemories(chatId);
  const cleanedMessages = sanitizeMessagesWithoutMedia(rawMessages);

  const packageData: RafiqCompanionPackage = {
    format: COMPANION_PACKAGE_FORMAT,
    version: COMPANION_PACKAGE_VERSION,
    exportedAt: new Date().toISOString(),
    exportMode: 'with_messages',
    source: detectPlatform(),
    metadata: {
      companionName: botName,
      companionGender: chatSession.settings.botGender,
      soulId: chatSession.settings.soulId,
      isCloned: Boolean(chatSession.settings.cloneProfile),
      counts: {
        messages: cleanedMessages.length,
        memories: rawMemories.length,
      },
      features: {
        includesConversation: true,
        includesMedia: false,
      },
      appVersion: '0.1.0',
    },
    data: {
      chatSession: JSON.parse(JSON.stringify(chatSession)),
      messages: cleanedMessages,
      memoryEntries: rawMemories.map(e => JSON.parse(JSON.stringify(e))),
      userProfile: userProfile ? JSON.parse(JSON.stringify(userProfile)) : null,
    },
  };

  const json = JSON.stringify(packageData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const fileName = `${safeName}_chat_no_media_${dateStr}.rafiq.json`;

  return { blob, fileName, packageData };
};

/**
 * Backward compatibility wrapper for exportChat.
 * Defaults to exporting with conversation (without media).
 */
export const exportChat = async (chatId: string): Promise<{ blob: Blob; fileName: string }> => {
  const result = await exportCompanionPackage(chatId, { mode: 'with_messages' });
  return { blob: result.blob, fileName: result.fileName };
};

// --- Import Functionality ---

export interface ImportCompanionResult {
  chatSession: ChatSession;
  messageCount: number;
  memoryCount: number;
  exportMode: CompanionExportMode;
  companionName: string;
}

export interface ImportCompanionDbAdapter {
  saveChatSession: (chat: ChatSession) => Promise<void>;
  saveClonedChatSession?: (
    chat: ChatSession,
    legacyEntries: any[],
    memoryRecords: any[],
  ) => Promise<void>;
  saveMessage?: (msg: ChatMessage) => Promise<void>;
  saveGroupMessage?: (msg: ChatMessage) => Promise<void>;
  bulkUpsertMemoryEntries?: (entries: MemoryEntry[]) => Promise<void>;
}

export const importCompanionPackage = async (
  file: File,
  dbAdapter?: ImportCompanionDbAdapter,
): Promise<ImportCompanionResult> => {
  // 1. Read file text
  const text = await file.text();
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('الملف ليس بصيغة JSON صالحة');
  }

  const isV2 = validateCompanionPackage(parsed);
  const isV1 = !isV2 && validateLegacyExportFile(parsed);

  if (!isV2 && !isV1) {
    throw new Error('الملف ليس حزمة رفيق صالحة (.rafiq أو .rafiq.json)');
  }

  const saveSession = dbAdapter?.saveChatSession ?? DB.saveChatSession;
  const saveCloned = dbAdapter?.saveClonedChatSession ?? DB.saveClonedChatSession;
  const saveMsg = dbAdapter?.saveMessage ?? DB.saveMessage;
  const saveGrpMsg = dbAdapter?.saveGroupMessage ?? DB.saveGroupMessage;
  const bulkUpsertMemories = dbAdapter?.bulkUpsertMemoryEntries ?? DB.bulkUpsertMemoryEntries;

  const newChatId = crypto.randomUUID();

  // Branch A: Modern v2 companion package
  if (isV2) {
    const pkg = parsed as RafiqCompanionPackage;
    const rawSession = pkg.data.chatSession as ChatSession;
    const exportMode = pkg.exportMode;
    const companionName = pkg.metadata.companionName;

    if (exportMode === 'settings_only') {
      const chatSession: ChatSession = {
        ...rawSession,
        id: newChatId,
        lastMessage: undefined,
        lastMessageTimestamp: new Date(),
        unreadCount: 0,
        continuityState: undefined,
        psychology: rawSession.psychology
          ? {
              ...rawSession.psychology,
              lastInteractionTime: new Date(),
            }
          : undefined,
      };

      // Check if cloned companion has blueprint memory seeds to re-index
      const cloneSeeds = chatSession.settings.cloneProfile?.memorySeeds;
      if (cloneSeeds && cloneSeeds.length > 0 && saveCloned) {
        const validSeeds = cloneSeeds.flatMap((seed): SoulMemorySeed[] => {
          if (!seed.text?.trim() || !seed.category || !Number.isFinite(seed.salience)) return [];
          return [{
            text: seed.text.trim(),
            category: seed.category,
            salience: Math.max(0, Math.min(1, seed.salience)),
            ...(seed.subject ? { subject: seed.subject } : {}),
          }];
        });

        if (validSeeds.length > 0) {
          const { legacyEntries, memoryRecords } = buildBlueprintMemoryRecords(newChatId, validSeeds);
          await saveCloned(chatSession, legacyEntries, memoryRecords);
          return {
            chatSession,
            messageCount: 0,
            memoryCount: validSeeds.length,
            exportMode: 'settings_only',
            companionName,
          };
        }
      }

      await saveSession(chatSession);
      return {
        chatSession,
        messageCount: 0,
        memoryCount: 0,
        exportMode: 'settings_only',
        companionName,
      };
    }

    // exportMode === 'with_messages'
    const chatSession: ChatSession = {
      ...rawSession,
      id: newChatId,
      unreadCount: 0,
      psychology: rawSession.psychology
        ? {
            ...rawSession.psychology,
            lastInteractionTime: new Date(),
          }
        : undefined,
    };

    if (chatSession.lastMessageTimestamp) {
      chatSession.lastMessageTimestamp = new Date(chatSession.lastMessageTimestamp);
    }

    // Remap messages and strip any residual media defensively
    const rawMessages = (pkg.data.messages || []) as ChatMessage[];
    const cleanedMessages = sanitizeMessagesWithoutMedia(rawMessages);
    const messages: ChatMessage[] = cleanedMessages.map(msg => ({
      ...msg,
      chatId: newChatId,
      timestamp: new Date(msg.timestamp),
    }));

    // Remap memory entries
    const rawMemories = (pkg.data.memoryEntries || []) as MemoryEntry[];
    const memoryEntries: MemoryEntry[] = rawMemories.map(entry => ({
      ...entry,
      id: entry.id ? entry.id.replace(rawSession.id, newChatId) : crypto.randomUUID(),
      chatId: newChatId,
      createdAt: new Date(entry.createdAt),
      updatedAt: new Date(entry.updatedAt),
    }));

    // Persist everything
    await saveSession(chatSession);

    const isGroup = !!chatSession.isGroup;
    for (const msg of messages) {
      if (isGroup && saveGrpMsg) {
        await saveGrpMsg(msg);
      } else if (saveMsg) {
        await saveMsg(msg);
      }
    }

    if (memoryEntries.length > 0 && bulkUpsertMemories) {
      await bulkUpsertMemories(memoryEntries);
    }

    return {
      chatSession,
      messageCount: messages.length,
      memoryCount: memoryEntries.length,
      exportMode: 'with_messages',
      companionName,
    };
  }

  // Branch B: Legacy v1 rafiq-chat-export
  const legacyData = parsed as LegacyRafiqExportFile;
  const oldChatId = legacyData.data.chatSession.id;
  const companionName = legacyData.data.chatSession.isGroup
    ? (legacyData.data.chatSession.groupName || 'مجموعة')
    : legacyData.data.chatSession.settings.botName;

  const chatSession: ChatSession = {
    ...legacyData.data.chatSession,
    id: newChatId,
    unreadCount: 0,
    psychology: legacyData.data.chatSession.psychology
      ? {
          ...legacyData.data.chatSession.psychology,
          lastInteractionTime: new Date(),
        }
      : undefined,
  };

  if (chatSession.lastMessageTimestamp) {
    chatSession.lastMessageTimestamp = new Date(chatSession.lastMessageTimestamp);
  }

  const rawMessages = legacyData.data.messages || [];
  const cleanedMessages = sanitizeMessagesWithoutMedia(rawMessages);
  const messages: ChatMessage[] = cleanedMessages.map(msg => ({
    ...msg,
    chatId: newChatId,
    timestamp: new Date(msg.timestamp),
  }));

  const memoryEntries: MemoryEntry[] = (legacyData.data.memoryEntries || []).map(entry => ({
    ...entry,
    id: entry.id ? entry.id.replace(oldChatId, newChatId) : crypto.randomUUID(),
    chatId: newChatId,
    createdAt: new Date(entry.createdAt),
    updatedAt: new Date(entry.updatedAt),
  }));

  await saveSession(chatSession);

  const isGroup = !!chatSession.isGroup;
  for (const msg of messages) {
    if (isGroup && saveGrpMsg) {
      await saveGrpMsg(msg);
    } else if (saveMsg) {
      await saveMsg(msg);
    }
  }

  if (memoryEntries.length > 0 && bulkUpsertMemories) {
    await bulkUpsertMemories(memoryEntries);
  }

  return {
    chatSession,
    messageCount: messages.length,
    memoryCount: memoryEntries.length,
    exportMode: 'with_messages',
    companionName,
  };
};

/**
 * Backward compatibility wrapper for importChat.
 */
export const importChat = async (
  file: File,
): Promise<{ chatSession: ChatSession; messageCount: number }> => {
  const result = await importCompanionPackage(file);
  return {
    chatSession: result.chatSession,
    messageCount: result.messageCount,
  };
};

// --- Download Helper ---

export const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

// --- Platform Detection ---

export const detectPlatform = (): RafiqCompanionPackage['source'] => {
  if (typeof window === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (/mobile|android|iphone|ipad/.test(ua)) return 'mobile';
  return 'desktop';
};
