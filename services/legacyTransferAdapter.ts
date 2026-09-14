import { z } from 'zod';
import {
  BotSettingsSchema,
  ChatMessageSchema,
  type ChatMessage,
} from '../types.js';
import type { MemoryRecord } from '../contracts/rafiqV6.js';
import { buildRafiqTransferV2 } from './transferV2.js';

const LegacyMemorySeedSchema = z.object({
  role: z.enum(['user', 'model']),
  text: z.string().trim().min(1).max(4000),
  category: z.string().trim().min(1).max(80),
  timestamp: z.coerce.date().optional(),
});

const LegacyRafiqV1Schema = z.object({
  format: z.literal('rafiq-chat-export'),
  version: z.literal(1),
  exportedAt: z.coerce.date(),
  bot: BotSettingsSchema,
  messages: z.array(ChatMessageSchema).max(100_000),
  memorySeeds: z.array(LegacyMemorySeedSchema).max(1000).default([]),
});

export class LegacyTransferError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LegacyTransferError';
  }
}

const normalizeLegacyCategory = (category: string): MemoryRecord['category'] => {
  const normalized = category.toLowerCase();
  if (['identity', 'preference', 'memory', 'goal', 'fact', 'emotion', 'general'].includes(normalized)) {
    return normalized as MemoryRecord['category'];
  }
  return 'general';
};

export const adaptLegacyRafiqV1 = (
  input: unknown,
  options: {
    appVersion: string;
    createId?: () => string;
    createdAt?: Date;
  },
) => {
  const parsed = LegacyRafiqV1Schema.safeParse(input);
  if (!parsed.success) {
    throw new LegacyTransferError(
      `Legacy v1 validation failed: ${parsed.error.issues[0]?.message || 'unknown error'}`,
    );
  }

  const createId = options.createId || (() => crypto.randomUUID());
  const chatId = createId();
  const messageIdMap = new Map<string, string>();
  for (const message of parsed.data.messages) messageIdMap.set(message.id, createId());

  const messages: ChatMessage[] = parsed.data.messages.map(message => ({
    ...message,
    id: messageIdMap.get(message.id)!,
    chatId,
    rootMessageId: message.rootMessageId
      ? messageIdMap.get(message.rootMessageId) || message.rootMessageId
      : undefined,
    replyToMessageId: message.replyToMessageId
      ? messageIdMap.get(message.replyToMessageId) || message.replyToMessageId
      : undefined,
    replyTo: message.replyTo ? {
      ...message.replyTo,
      id: messageIdMap.get(message.replyTo.id) || message.replyTo.id,
    } : undefined,
    isThinking: false,
  }));

  const memories: MemoryRecord[] = parsed.data.memorySeeds.map((seed, index) => {
    const createdAt = seed.timestamp || parsed.data.exportedAt;
    const category = normalizeLegacyCategory(seed.category);
    const retention = category === 'identity' || category === 'goal'
      ? 'durable' as const
      : category === 'emotion'
        ? 'transient_7d' as const
        : 'general_30d' as const;
    const expiresAt = retention === 'durable'
      ? undefined
      : new Date(createdAt.getTime() + (retention === 'transient_7d' ? 7 : 30) * 86_400_000);
    return {
      id: createId(),
      ownerUserId: 'main_user',
      scope: 'chat',
      scopeId: chatId,
      text: seed.text,
      summary: seed.text.slice(0, 600),
      category,
      provenance: {
        kind: 'knowledge',
        sourceIds: [`legacy-v1-seed-${index}`],
        observedAt: createdAt,
      },
      confidence: seed.role === 'user' ? 0.7 : 0.5,
      salience: category === 'identity' || category === 'goal' ? 0.8 : 0.55,
      sensitivity: 'normal',
      retention,
      expiresAt,
      status: 'active',
      createdAt,
      updatedAt: createdAt,
    };
  });

  return buildRafiqTransferV2({
    appVersion: options.appVersion,
    chats: [{
      id: chatId,
      isGroup: false,
      settings: parsed.data.bot,
      lastMessage: messages.at(-1)?.text,
      lastMessageTimestamp: messages.at(-1)?.timestamp,
      unreadCount: 0,
    }],
    messages,
    lifeStoryEvents: [],
    botStoryEvents: [],
    memories,
    attachments: [],
  }, {
    createdAt: options.createdAt || new Date(),
  });
};

export const parseLegacyRafiqV1Text = (
  text: string,
  options: Parameters<typeof adaptLegacyRafiqV1>[1],
) => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new LegacyTransferError('Legacy .rafiq file is not valid JSON.');
  }
  return adaptLegacyRafiqV1(value, options);
};
