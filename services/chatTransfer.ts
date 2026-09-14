/**
 * RAFIQ CHAT TRANSFER ENGINE
 * Export & Import conversations as portable .rafiq files.
 * Preserves full context: messages, psychology, memories, and settings.
 */

import { ChatSession, ChatMessage, MemoryEntry, UserProfile } from '../types.js';
import * as DB from './db.js';

// --- Format Constants ---
const FORMAT_ID = 'rafiq-chat-export' as const;
const FORMAT_VERSION = 1;

// --- Types ---
export interface RafiqExportFile {
  format: typeof FORMAT_ID;
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

// --- Validation ---

export const validateExportFile = (content: unknown): content is RafiqExportFile => {
  if (!content || typeof content !== 'object') return false;
  const obj = content as Record<string, unknown>;
  if (obj.format !== FORMAT_ID) return false;
  if (typeof obj.version !== 'number' || obj.version < 1) return false;
  if (!obj.data || typeof obj.data !== 'object') return false;

  const data = obj.data as Record<string, unknown>;
  if (!data.chatSession || typeof data.chatSession !== 'object') return false;
  if (!Array.isArray(data.messages)) return false;

  return true;
};

// --- Export ---

export const exportChat = async (chatId: string): Promise<{ blob: Blob; fileName: string }> => {
  // 1. Gather all data from IndexedDB
  const chatSession = await DB.getChatSession(chatId);
  if (!chatSession) {
    throw new Error(`Chat session not found: ${chatId}`);
  }

  const isGroup = !!chatSession.isGroup;
  const messages = await DB.getMessagesForChat(chatId, undefined, isGroup);
  const memoryEntries = await DB.getMemoryEntriesForChat(chatId);
  const userProfile = await DB.getUserProfile();

  // 2. Clean attachments — strip blob: URLs but keep base64 data
  const cleanedMessages = messages.map(msg => ({
    ...msg,
    attachments: msg.attachments?.map(att => {
      const { file, ...rest } = att as any;
      return {
        ...rest,
        previewUrl: rest.base64 ? '' : rest.previewUrl, // will be regenerated on import
      };
    }),
  }));

  // 3. Build export payload
  const exportData: RafiqExportFile = {
    format: FORMAT_ID,
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    source: detectPlatform(),
    data: {
      chatSession: JSON.parse(JSON.stringify(chatSession)),
      messages: cleanedMessages,
      memoryEntries: memoryEntries.map(e => JSON.parse(JSON.stringify(e))),
      userProfile,
    },
  };

  // 4. Create downloadable blob
  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });

  // 5. Build filename
  const botName = chatSession.isGroup
    ? (chatSession.groupName || 'group')
    : chatSession.settings.botName;
  const safeName = botName.replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_').slice(0, 30);
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `${safeName}_${dateStr}.rafiq`;

  return { blob, fileName };
};

// --- Import ---

export const importChat = async (
  file: File
): Promise<{ chatSession: ChatSession; messageCount: number }> => {
  // 1. Read file contents
  const text = await file.text();
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('الملف مش صيغة JSON صالحة');
  }

  // 2. Validate structure
  if (!validateExportFile(parsed)) {
    throw new Error('الملف مش بصيغة .rafiq صالحة');
  }

  const exportData = parsed as RafiqExportFile;

  // 3. Generate new chat ID to avoid conflicts
  const newChatId = crypto.randomUUID();
  const oldChatId = exportData.data.chatSession.id;

  // 4. Remap chat session
  const chatSession: ChatSession = {
    ...exportData.data.chatSession,
    id: newChatId,
    // Reset unread count on import
    unreadCount: 0,
    // Update last interaction time
    psychology: exportData.data.chatSession.psychology
      ? {
          ...exportData.data.chatSession.psychology,
          lastInteractionTime: new Date(),
        }
      : undefined,
  };

  // Parse date fields back
  if (chatSession.lastMessageTimestamp) {
    chatSession.lastMessageTimestamp = new Date(chatSession.lastMessageTimestamp);
  }

  // 5. Remap messages
  const messages: ChatMessage[] = exportData.data.messages.map(msg => ({
    ...msg,
    chatId: newChatId,
    timestamp: new Date(msg.timestamp),
    // Regenerate previewUrl from base64 for attachments
    attachments: msg.attachments?.map(att => ({
      ...att,
      previewUrl:
        !att.previewUrl && att.base64
          ? `data:${att.mimeType};base64,${att.base64}`
          : att.previewUrl,
    })),
  }));

  // 6. Remap memory entries
  const memoryEntries: MemoryEntry[] = (exportData.data.memoryEntries || []).map(entry => ({
    ...entry,
    id: entry.id.replace(oldChatId, newChatId),
    chatId: newChatId,
    createdAt: new Date(entry.createdAt),
    updatedAt: new Date(entry.updatedAt),
  }));

  // 7. Persist everything to IndexedDB
  await DB.saveChatSession(chatSession);

  // Save messages in batches to avoid overwhelming IndexedDB
  const isGroup = !!chatSession.isGroup;
  for (const msg of messages) {
    if (isGroup) {
      await DB.saveGroupMessage(msg);
    } else {
      await DB.saveMessage(msg);
    }
  }

  // Save memory entries
  if (memoryEntries.length > 0) {
    await DB.bulkUpsertMemoryEntries(memoryEntries);
  }

  return {
    chatSession,
    messageCount: messages.length,
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

const detectPlatform = (): RafiqExportFile['source'] => {
  if (typeof window === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (/mobile|android|iphone|ipad/.test(ua)) return 'mobile';
  return 'desktop';
};
