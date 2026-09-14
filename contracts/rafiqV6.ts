import { z } from 'zod';

export const MainUserIdSchema = z.literal('main_user');
export const StoryVisibilitySchema = z.enum(['all_bots', 'selected_bots', 'private']);
export const MemoryScopeSchema = z.enum(['user_story', 'bot', 'chat', 'group', 'knowledge']);
export const MemorySensitivitySchema = z.enum(['normal', 'sensitive', 'private']);
export const MemoryRetentionSchema = z.enum(['durable', 'transient_7d', 'general_30d', 'manual']);
export type MemoryRetention = z.infer<typeof MemoryRetentionSchema>;

export const StoryAclSchema = z.object({
  visibility: StoryVisibilitySchema,
  botIds: z.array(z.string().min(1)).max(100).default([]),
}).superRefine((value, context) => {
  if (value.visibility === 'selected_bots' && value.botIds.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['botIds'],
      message: 'selected_bots visibility requires at least one bot ID.',
    });
  }
  if (value.visibility !== 'selected_bots' && value.botIds.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['botIds'],
      message: 'botIds are only valid for selected_bots visibility.',
    });
  }
});

export const LifeStoryEventSchema = z.object({
  id: z.string().min(1),
  userId: MainUserIdSchema.default('main_user'),
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(2000),
  happenedAt: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  acl: StoryAclSchema,
  sensitivity: MemorySensitivitySchema.default('normal'),
  source: z.enum(['user_entered', 'user_correction', 'imported']),
});

export const StorySignalSchema = z.object({
  id: z.string().min(1),
  eventId: z.string().min(1),
  text: z.string().trim().min(1).max(240),
  salience: z.number().min(0).max(1),
  sensitivity: MemorySensitivitySchema.default('normal'),
  acl: StoryAclSchema,
  createdAt: z.coerce.date(),
  expiresAt: z.coerce.date().optional(),
});

export const BotStoryEventSchema = z.object({
  id: z.string().min(1),
  botId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(2000),
  kind: z.enum(['observed', 'bio', 'imaginary']),
  sourceMessageIds: z.array(z.string().min(1)).max(50).default([]),
  sourceGroupId: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1),
  status: z.enum(['active', 'superseded', 'deleted']).default('active'),
  supersedesId: z.string().min(1).optional(),
  acl: StoryAclSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
}).superRefine((value, context) => {
  if (value.kind === 'observed' && value.sourceMessageIds.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sourceMessageIds'],
      message: 'Observed bot story events require source message IDs.',
    });
  }
});

export const MemoryProvenanceSchema = z.object({
  kind: z.enum(['user_message', 'bot_message', 'user_story', 'bot_story', 'group_message', 'knowledge', 'correction']),
  sourceIds: z.array(z.string().min(1)).min(1).max(50),
  observedAt: z.coerce.date(),
});

export const MemoryRecordSchema = z.object({
  id: z.string().min(1),
  ownerUserId: MainUserIdSchema.default('main_user'),
  scope: MemoryScopeSchema,
  scopeId: z.string().min(1),
  text: z.string().trim().min(1).max(4000),
  summary: z.string().trim().min(1).max(600),
  category: z.enum(['identity', 'preference', 'memory', 'goal', 'fact', 'emotion', 'general']),
  provenance: MemoryProvenanceSchema,
  confidence: z.number().min(0).max(1),
  salience: z.number().min(0).max(1),
  sensitivity: MemorySensitivitySchema.default('normal'),
  retention: MemoryRetentionSchema,
  expiresAt: z.coerce.date().optional(),
  status: z.enum(['active', 'superseded', 'forgotten']).default('active'),
  supersedesId: z.string().min(1).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const SocialAgencySchema = z.object({
  boldness: z.number().min(0).max(100).default(50),
  proactivity: z.number().min(0).max(100).default(50),
  unsolicitedDailyLimit: z.number().int().min(0).max(1).default(1),
  cooldownHours: z.number().min(12).max(168).default(12),
  quietHours: z.object({
    enabled: z.boolean().default(true),
    startHour: z.number().int().min(0).max(23).default(23),
    endHour: z.number().int().min(0).max(23).default(8),
    timezone: z.string().min(1).default('Africa/Cairo'),
  }),
});

export const AttachmentAvailabilitySchema = z.enum(['available', 'processing', 'missing', 'local-only', 'failed']);
export const AttachmentRecordSchema = z.object({
  id: z.string().min(1),
  chatId: z.string().min(1),
  messageId: z.string().min(1).optional(),
  fileName: z.string().min(1).max(512),
  mimeType: z.string().min(1).max(255),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  opfsKey: z.string().min(1),
  availability: AttachmentAvailabilitySchema,
  processingProgress: z.number().min(0).max(1).default(0),
  derivedText: z.string().max(200000).optional(),
  thumbnailOpfsKey: z.string().min(1).optional(),
  codecError: z.string().max(1000).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const GroupTurnJobSchema = z.object({
  id: z.string().min(1),
  groupId: z.string().min(1),
  causalMessageId: z.string().min(1),
  speakerBotId: z.string().min(1),
  status: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']),
  attempt: z.number().int().min(0).max(5).default(0),
  maxAttempts: z.number().int().min(1).max(5).default(3),
  idempotencyKey: z.string().min(1),
  modelCallBudget: z.number().int().min(1).max(3).default(1),
  estimatedCostMicros: z.number().int().nonnegative().default(0),
  actualCostMicros: z.number().int().nonnegative().default(0),
  runAfter: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  lastError: z.string().max(2000).optional(),
  rootMessageId: z.string().min(1),
  // A group conversation can continue beyond one bot-to-bot reply. Keep the
  // persisted depth bounded so a single root message cannot create an endless
  // chain of model calls.
  triggerDepth: z.number().int().min(0).max(8),
  triggerSenderId: z.string().min(1),
  triggerSenderName: z.string().min(1).optional(),
  triggerText: z.string().min(1).max(4000),
  replyToMessageId: z.string().min(1).optional(),
  attachmentIds: z.array(z.string().min(1)).max(20).default([]),
  reactionContext: z.array(z.object({
    messageId: z.string().min(1),
    senderId: z.string().min(1),
    emoji: z.string().min(1).max(32),
  })).max(50).default([]),
  outputMessageId: z.string().min(1).optional(),
  modelCallsUsed: z.number().int().nonnegative().default(0),
});

export const CapabilityStatusSchema = z.enum(['healthy', 'degraded', 'unavailable', 'misconfigured']);
export const CapabilityHealthSchema = z.object({
  capability: z.enum(['gemini', 'groups', 'web_reader', 'web_search', 'import_export', 'attachments', 'selfie']),
  status: CapabilityStatusSchema,
  checkedAt: z.coerce.date(),
  lastSuccessAt: z.coerce.date().optional(),
  reason: z.string().trim().min(1).max(1000),
  missingRequirements: z.array(z.string().min(1)).max(20).default([]),
  testKind: z.enum(['configuration', 'unit', 'staging', 'real_provider']),
});

export const RafiqTransferV2ManifestSchema = z.object({
  format: z.literal('rafiq-transfer'),
  version: z.literal(2),
  createdAt: z.coerce.date(),
  appVersion: z.string().min(1),
  encrypted: z.boolean(),
  includesPrivateStory: z.boolean().default(false),
  includesSensitiveMemory: z.boolean().default(false),
  includesBinaryMedia: z.literal(false),
  checksums: z.record(z.string().regex(/^[a-f0-9]{64}$/i)),
  counts: z.object({
    chats: z.number().int().nonnegative(),
    messages: z.number().int().nonnegative(),
    lifeStoryEvents: z.number().int().nonnegative(),
    botStoryEvents: z.number().int().nonnegative(),
    memories: z.number().int().nonnegative(),
    attachments: z.number().int().nonnegative(),
  }),
});

export const RafiqTransferV2Schema = z.object({
  manifest: RafiqTransferV2ManifestSchema,
  chats: z.array(z.unknown()),
  messages: z.array(z.unknown()),
  lifeStoryEvents: z.array(LifeStoryEventSchema),
  botStoryEvents: z.array(BotStoryEventSchema),
  memories: z.array(MemoryRecordSchema),
  attachments: z.array(AttachmentRecordSchema.omit({ opfsKey: true }).extend({
    opfsKey: z.string().optional(),
    availability: z.enum(['missing', 'local-only']),
  })),
});

export type StoryVisibility = z.infer<typeof StoryVisibilitySchema>;
export type StoryAcl = z.infer<typeof StoryAclSchema>;
export type LifeStoryEvent = z.infer<typeof LifeStoryEventSchema>;
export type StorySignal = z.infer<typeof StorySignalSchema>;
export type BotStoryEvent = z.infer<typeof BotStoryEventSchema>;
export type MemoryScope = z.infer<typeof MemoryScopeSchema>;
export type MemoryRecord = z.infer<typeof MemoryRecordSchema>;
export type SocialAgency = z.infer<typeof SocialAgencySchema>;
export type AttachmentRecord = z.infer<typeof AttachmentRecordSchema>;
type RequiredGroupTurnJob = z.infer<typeof GroupTurnJobSchema> & Required<Pick<
  z.infer<typeof GroupTurnJobSchema>,
  Exclude<
    keyof z.infer<typeof GroupTurnJobSchema>,
    'lastError' | 'triggerSenderName' | 'replyToMessageId' | 'outputMessageId' | 'reactionContext'
  >
>>;
export type GroupTurnJob = Omit<RequiredGroupTurnJob, 'reactionContext'> & {
  reactionContext: Array<{ messageId: string; senderId: string; emoji: string }>;
};
export type CapabilityHealth = z.infer<typeof CapabilityHealthSchema>;
export type RafiqTransferV2 = z.infer<typeof RafiqTransferV2Schema>;
