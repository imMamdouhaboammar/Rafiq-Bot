import {
  type ReflectionEntry,
  ReflectionEntrySchema,
} from '../contracts/neuroCognitive.js';
import * as NeuroDB from './neuroDb.js';

export const REFLECTION_RETENTION_DAYS = 30;

export interface ReflectionGenerationProposal {
  topic: string;
  hypothesis: string;
  openQuestion?: string;
  confidence?: number;
  sensitivity?: 'normal' | 'sensitive';
  evidenceEventIds?: string[];
}

export const createReflectionEntry = (
  companionId: string,
  proposal: ReflectionGenerationProposal,
  now = new Date(),
): ReflectionEntry => {
  const expiresAt = new Date(now.getTime() + REFLECTION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const id = `refl_${now.getTime()}_${Math.random().toString(36).slice(2, 7)}`;

  return ReflectionEntrySchema.parse({
    id,
    ownerId: 'main_user',
    companionId,
    topic: proposal.topic.trim(),
    hypothesis: proposal.hypothesis.trim(),
    evidenceEventIds: proposal.evidenceEventIds || [],
    openQuestion: proposal.openQuestion?.trim(),
    confidence: proposal.confidence ?? 0.7,
    sensitivity: proposal.sensitivity || 'normal',
    expiresAt,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
};

/**
 * Persists a new reflection entry into the companion's private journal.
 */
export const recordReflection = async (
  companionId: string,
  proposal: ReflectionGenerationProposal,
  now = new Date(),
): Promise<ReflectionEntry> => {
  const entry = createReflectionEntry(companionId, proposal, now);
  await NeuroDB.saveReflectionEntry(entry);
  return entry;
};

/**
 * Distills active reflections into a small, respectful context block.
 * Never includes raw speculation; formats actionable conversational hypotheses.
 */
export const compileReflectionContext = (
  entries: ReflectionEntry[],
): string | undefined => {
  const active = entries.filter(e => e.status === 'active' && new Date(e.expiresAt).getTime() > Date.now());
  if (active.length === 0) return undefined;

  const lines = active.slice(0, 3).map(e => {
    const q = e.openQuestion ? ` (سؤال مفتوح في بالك: ${e.openQuestion})` : '';
    return `- [ملاحظة تقديرية عن: ${e.topic}]: ${e.hypothesis}${q}`;
  });

  return `[دفتر تأملات الرفيق الخاصة - Private Reflective Hypotheses]\n${lines.join('\n')}`;
};

/**
 * User-facing export of all reflection entries for inspection.
 */
export const exportReflectionsForUser = async (
  companionId: string,
): Promise<ReflectionEntry[]> => {
  return NeuroDB.getActiveReflections(companionId, 100);
};

/**
 * User-facing immediate erasure of a specific reflection entry.
 */
export const deleteReflection = async (id: string): Promise<void> => {
  await NeuroDB.deleteReflectionEntry(id);
};

/**
 * Prunes expired reflection records past their 30-day retention limit.
 */
export const pruneExpired = async (now = new Date()): Promise<number> => {
  return NeuroDB.pruneExpiredReflections(now);
};
