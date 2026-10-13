import { z } from 'zod';

export const FactPolaritySchema = z.enum(['positive', 'negative']);
export type FactPolarity = z.infer<typeof FactPolaritySchema>;

export const FactCertaintySchema = z.enum(['explicit', 'inferred', 'uncertain']);
export type FactCertainty = z.infer<typeof FactCertaintySchema>;

export const FactStatusSchema = z.enum(['candidate', 'active', 'disputed', 'superseded', 'retracted']);
export type FactStatus = z.infer<typeof FactStatusSchema>;

export const MemorySensitivitySchema = z.enum(['normal', 'sensitive', 'restricted']);
export type MemorySensitivity = z.infer<typeof MemorySensitivitySchema>;

/**
 * Atomic Fact Representation:
 * Sourced, versioned, temporal claim rather than a single monolithic message engram.
 */
export const MemoryFactSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().default('main_user'),
  companionId: z.string().min(1),
  subjectId: z.string().min(1),
  predicate: z.string().min(1).max(120),
  objectValue: z.string().min(1).max(500),
  polarity: FactPolaritySchema.default('positive'),
  certainty: FactCertaintySchema.default('explicit'),
  confidence: z.number().min(0).max(1).default(0.8),
  sensitivity: MemorySensitivitySchema.default('normal'),
  sourceEventIds: z.array(z.string().min(1)).min(1),
  observedAt: z.coerce.date(),
  validFrom: z.coerce.date().optional(),
  validTo: z.coerce.date().optional(),
  supersedesId: z.string().optional(),
  status: FactStatusSchema.default('active'),
  version: z.number().int().min(1).default(1),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type MemoryFact = z.infer<typeof MemoryFactSchema>;

/**
 * Directed Typed Relationship between entities with temporal validity.
 */
export const MemoryRelationSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().default('main_user'),
  companionId: z.string().min(1),
  fromEntityId: z.string().min(1),
  toEntityId: z.string().min(1),
  relationType: z.string().min(1).max(100),
  validFrom: z.coerce.date().optional(),
  validTo: z.coerce.date().optional(),
  sourceFactIds: z.array(z.string().min(1)).default([]),
  status: z.enum(['active', 'superseded', 'disputed']).default('active'),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type MemoryRelation = z.infer<typeof MemoryRelationSchema>;

/**
 * Append-only Event Ledger entry for traceability and idempotency.
 */
export const MemoryEventSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().default('main_user'),
  companionId: z.string().min(1),
  eventType: z.enum(['message_observed', 'user_correction', 'fact_extracted', 'fact_superseded', 'fact_retracted', 'reflection_created', 'grant_revoked']),
  eventTime: z.coerce.date(),
  payload: z.record(z.any()).default({}),
  idempotencyKey: z.string().min(1),
});
export type MemoryEvent = z.infer<typeof MemoryEventSchema>;

/**
 * Durable background job ledger to recover unfinished work across tab closes.
 */
export const MemoryJobSchema = z.object({
  id: z.string().min(1),
  companionId: z.string().min(1),
  jobType: z.enum(['extract_facts', 'reconcile_conflicts', 'reflect', 'prune_expired']),
  status: z.enum(['pending', 'leased', 'completed', 'failed', 'dead_letter']).default('pending'),
  attempts: z.number().int().min(0).default(0),
  maxAttempts: z.number().int().min(1).default(3),
  leaseUntil: z.coerce.date().optional(),
  retryAfter: z.coerce.date().optional(),
  payload: z.record(z.any()).default({}),
  error: z.string().optional(),
  idempotencyKey: z.string().min(1),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type MemoryJob = z.infer<typeof MemoryJobSchema>;

/**
 * Private Reflection Journal entry:
 * Sourced hypotheses and open questions. Strictly isolated per companion, user-inspectable and deletable.
 */
export const ReflectionEntrySchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().default('main_user'),
  companionId: z.string().min(1),
  topic: z.string().min(1).max(200),
  hypothesis: z.string().min(1).max(600),
  evidenceEventIds: z.array(z.string().min(1)).default([]),
  openQuestion: z.string().max(400).optional(),
  confidence: z.number().min(0).max(1).default(0.7),
  sensitivity: MemorySensitivitySchema.default('normal'),
  expiresAt: z.coerce.date(),
  status: z.enum(['active', 'resolved', 'dismissed']).default('active'),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type ReflectionEntry = z.infer<typeof ReflectionEntrySchema>;

/**
 * Deterministic Synthetic Affect State:
 * Explainable conversational disposition (valence, arousal, security, tension).
 * No pseudoscientific sentience or suffering claims.
 */
export const AffectStateSchema = z.object({
  companionId: z.string().min(1),
  valence: z.number().min(-1).max(1).default(0.2),       // -1 (reserved/cold) to +1 (warm/delighted)
  arousal: z.number().min(0).max(1).default(0.4),        // 0 (calm/placid) to 1 (high energy/urgency)
  security: z.number().min(0).max(1).default(0.7),       // 0 (hesitant/uncertain) to 1 (grounded/trusting)
  tension: z.number().min(0).max(1).default(0.1),        // 0 (peaceful) to 1 (unresolved interpersonal friction)
  lastEventAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date(),
  modelVersion: z.number().int().min(1).default(1),
});
export type AffectState = z.infer<typeof AffectStateSchema>;

/**
 * Cross-Companion Memory Grant:
 * Unambiguous, one-way, read-only, non-transitive, user-authorized bridge.
 */
export const MemoryGrantSchema = z.object({
  grantId: z.string().min(1),
  ownerId: z.string().default('main_user'),
  sourceCompanionId: z.string().min(1),
  targetCompanionId: z.string().min(1),
  direction: z.literal('source_to_target').default('source_to_target'),
  categories: z.array(z.enum(['facts', 'preferences', 'experiences'])).min(1),
  sensitivityMax: z.enum(['normal', 'sensitive']).default('normal'),
  approvedAt: z.coerce.date(),
  expiresAt: z.coerce.date().optional(),
  revokedAt: z.coerce.date().optional(),
});
export type MemoryGrant = z.infer<typeof MemoryGrantSchema>;
