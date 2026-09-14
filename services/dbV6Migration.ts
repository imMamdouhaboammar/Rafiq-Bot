import { BotMood, MessageRole, type ChatSession, type MemoryEntry } from '../types.js';
import {
  MemoryRecordSchema,
  SocialAgencySchema,
  type MemoryRecord,
  type SocialAgency,
} from '../contracts/rafiqV6.js';
import {
  calculateMemoryExpiry,
  inferMemoryRetention,
} from './memoryPolicy.js';

export interface SocialAgencyRecord extends SocialAgency {
  botId: string;
  updatedAt: Date;
}

const normalizeSalience = (value: number | undefined): number => {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value! > 1 ? value! / 10 : value!));
};

export const migrateLegacyMemoryEntry = (
  entry: MemoryEntry,
): MemoryRecord | null => {
  const text = entry.text?.trim();
  if (!text || !entry.chatId || entry.chatId === 'global_shared_pool') return null;

  const category = entry.category || 'general';
  const retention = inferMemoryRetention(category);
  const createdAt = new Date(entry.createdAt || Date.now());
  const updatedAt = new Date(entry.updatedAt || createdAt);
  const record = {
    id: `legacy:${entry.id}`,
    ownerUserId: 'main_user' as const,
    scope: 'chat' as const,
    scopeId: entry.chatId,
    text,
    summary: (entry.summary || text).slice(0, 600),
    category,
    provenance: {
      kind: entry.sourceRole === MessageRole.USER ? 'user_message' as const : 'bot_message' as const,
      sourceIds: [entry.sourceMessageId || entry.id],
      observedAt: createdAt,
    },
    confidence: entry.sourceRole === MessageRole.USER ? 0.75 : 0.55,
    salience: normalizeSalience(entry.salience),
    sensitivity: 'normal' as const,
    retention,
    expiresAt: calculateMemoryExpiry(retention, createdAt),
    status: 'active' as const,
    createdAt,
    updatedAt,
  };

  const parsed = MemoryRecordSchema.safeParse(record);
  return parsed.success ? parsed.data : null;
};

export const normalizeLegacyChatForV6 = (chat: ChatSession): ChatSession => {
  if (!chat.psychology) return chat;
  const mood = chat.psychology.mood === BotMood.HANGRY || chat.psychology.mood === BotMood.BROKE
    ? BotMood.NEUTRAL
    : chat.psychology.mood;

  return {
    ...chat,
    psychology: {
      ...chat.psychology,
      mood,
      lastMoodChangeReason: mood !== chat.psychology.mood
        ? 'Legacy physical-state mood normalized during v6 migration.'
        : chat.psychology.lastMoodChangeReason,
    },
  };
};

export const buildDefaultSocialAgencyRecord = (
  botId: string,
  now = new Date(),
): SocialAgencyRecord => ({
  botId,
  ...SocialAgencySchema.parse({
    boldness: 50,
    proactivity: 50,
    quietHours: {
      enabled: true,
      startHour: 23,
      endHour: 8,
      timezone: 'Africa/Cairo',
    },
  }),
  updatedAt: now,
});
