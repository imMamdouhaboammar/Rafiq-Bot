import { z } from 'zod';
import type { PsychologicalState } from '../../types.js';
import type { CompanionContinuityState } from '../companionContinuity.js';

export const EvidenceTierSchema = z.enum(['A', 'B', 'C']);
export type EvidenceTier = z.infer<typeof EvidenceTierSchema>;

export const EvidenceKindSchema = z.enum([
  'belief',
  'heuristic',
  'framework',
  'stance',
  'antipattern',
  'procedure',
  'reasoning',
  'anecdote',
  'prediction',
  'axiom',
  'relation',
  'preference',
  'milestone',
]);
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;

export const EvidenceStatusSchema = z.enum([
  'active',
  'superseded',
  'invalidated',
  'candidate',
]);
export type EvidenceStatus = z.infer<typeof EvidenceStatusSchema>;

export const EpistemicEvidenceSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  companionId: z.string().min(1),
  kind: EvidenceKindSchema,
  group: z.string().min(1).default('core_identity'),
  vector: z.string().min(1).default('identity'),
  subject: z.string().optional(),
  relation: z.string().optional(),
  object: z.string().optional(),
  text: z.string().min(1),
  tier: EvidenceTierSchema.default('B'),
  confidence: z.number().min(0).max(1).default(0.8),
  asOf: z.string().optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  supersedesId: z.string().optional(),
  status: EvidenceStatusSchema.default('active'),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type EpistemicEvidence = z.infer<typeof EpistemicEvidenceSchema>;

export const AssociativeRelationSchema = z.enum([
  'ASSOCIATIVE_TRIGGERS',
  'TEMPORAL_PRECEDES',
  'CONTRADICTS_SUPERSEDES',
  'DEFINES',
  'SHAPES_CADENCE',
  'PROTECTS_BOUNDARY',
  'MOTIVATES',
]);
export type AssociativeRelation = z.infer<typeof AssociativeRelationSchema>;

export const AssociativeEdgeSchema = z.object({
  sourceEpId: z.string().min(1),
  targetEpId: z.string().min(1),
  relationType: AssociativeRelationSchema.default('ASSOCIATIVE_TRIGGERS'),
  weight: z.number().min(0).max(1).default(1.0),
  lastActivatedAt: z.number().default(0),
});
export type AssociativeEdge = z.infer<typeof AssociativeEdgeSchema>;

export const LifeMilestoneSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  companionId: z.string().min(1),
  eraTitle: z.string().min(1),
  startYear: z.number().int(),
  endYear: z.number().int(),
  summaryText: z.string().min(1),
  keyThemes: z.array(z.string()).default([]),
  createdAt: z.string(),
});
export type LifeMilestone = z.infer<typeof LifeMilestoneSchema>;

export const SocialMoveSchema = z.enum([
  'answer',
  'acknowledge',
  'check_in',
  'tease',
  'disagree',
  'seek_opinion',
  'practical_help',
  'callback',
  'comfort',
  'clarify',
  'topic_shift',
  'minimal_presence',
]);
export type SocialMove = z.infer<typeof SocialMoveSchema>;

export const CognitiveModeSchema = z.enum(['off', 'shadow', 'assist', 'strict']);
export type CognitiveMode = z.infer<typeof CognitiveModeSchema>;

export const RelationalPermissionsSchema = z.object({
  teasingPermitted: z.boolean(),
  vulnerabilityPermitted: z.boolean(),
  disagreePermitted: z.boolean(),
  romanticPermitted: z.boolean(),
  trustScore: z.number().min(0).max(1),
  closenessScore: z.number().min(0).max(1),
});
export type RelationalPermissions = z.infer<typeof RelationalPermissionsSchema>;

export interface CognitiveTurnInput {
  ownerId: string;
  companionId: string;
  userMessage: string;
  replyContextText?: string;
  mode?: CognitiveMode;
  psychologicalState?: PsychologicalState;
  continuityState?: CompanionContinuityState;
  timeScopeYear?: number;
}

export interface CognitiveTurnContext {
  runId: string;
  companionId: string;
  mode: CognitiveMode;
  socialMove: SocialMove;
  bubbleBudget: number;
  deliveredEvidence: EpistemicEvidence[];
  eraMilestone?: LifeMilestone;
  activeConcerns: string[];
  activeThreads: string[];
  relationalPermissions: RelationalPermissions;
  contextPrompt: string;
  tokenEstimate: number;
}

export const ClaimTypeSchema = z.enum([
  'casual_conversational',
  'subjective_opinion',
  'hypothetical_or_fictional',
  'supported_historical',
  'unsupported_factual',
  'uncertain_or_contradictory',
]);
export type ClaimType = z.infer<typeof ClaimTypeSchema>;

export interface GroundingDecision {
  verified: boolean;
  claimType: ClaimType;
  citedEvidenceIds: string[];
  unauthorizedCitationIds: string[];
  groundingScore: number;
  reason: string;
  suggestedAction: 'deliver' | 'deflect' | 'revise' | 'log_only';
}

export interface GroundingVerificationInput {
  runId: string;
  ownerId: string;
  companionId: string;
  replyText: string;
  deliveredEvidenceIds: string[];
  checkStrictGrounding?: boolean;
}

export interface TurnObservationInput {
  turnId: string;
  ownerId: string;
  companionId: string;
  userMessage: string;
  replyText: string;
  groundingDecision?: GroundingDecision;
  deliveredEvidenceIds?: string[];
  elapsedHoursSinceLastTurn?: number;
}

export interface IngestionInput {
  ownerId: string;
  companionId: string;
  companionName: string;
  rawExportText: string;
  sourceType: 'whatsapp' | 'telegram' | 'text' | 'profile';
  targetSpeakerName?: string;
}

export interface IngestionResult {
  companionId: string;
  totalMessagesParsed: number;
  targetMessagesCount: number;
  redactedPiiCount: number;
  cadenceMetrics: {
    medianTextChars: number;
    meanTextChars: number;
    medianWords: number;
    consecutiveBurstMedian: number;
    multiBubbleBurstRatio: number;
  };
  extractedFacts: EpistemicEvidence[];
  extractedMilestones: LifeMilestone[];
}

export interface EvidenceCorrectionInput {
  ownerId: string;
  companionId: string;
  targetEvidenceId: string;
  correctedText: string;
  reason?: string;
  newConfidence?: number;
}

export interface EvidenceInvalidationInput {
  ownerId: string;
  companionId: string;
  targetEvidenceId: string;
  reason: string;
}
