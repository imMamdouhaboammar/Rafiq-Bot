import {
  analyzeChatAndGeneratePersona,
} from './whatsappImporter.server.js';
import {
  getParticipantsFromChat,
  synthesizeSoulFromChat,
} from './soulSynthesizer.server.js';
import { analyzeProgressiveCloneBatch } from './progressiveCloneAnalysis.server.js';

export type CloneActionStage = 'participants' | 'analysis';

export class CloneActionError extends Error {
  readonly stage: CloneActionStage;
  readonly statusCode: number;

  constructor(stage: CloneActionStage, message: string, options?: { cause?: unknown; statusCode?: number }) {
    super(message, { cause: options?.cause });
    this.name = 'CloneActionError';
    this.stage = stage;
    this.statusCode = options?.statusCode || 500;
  }
}

const readStatusCode = (error: unknown): number => {
  if (!error || typeof error !== 'object' || !('statusCode' in error)) return 500;
  const statusCode = Number((error as { statusCode?: unknown }).statusCode);
  return Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599
    ? statusCode
    : 500;
};

const readErrorMessage = (error: unknown): string => (
  error instanceof Error && error.message.trim()
    ? error.message.trim()
    : 'حصل خطأ غير متوقع. جرّب تاني.'
);

const withCloneStage = <Args extends unknown[], Result>(
  stage: CloneActionStage,
  action: (...args: Args) => Promise<Result>,
) => async (...args: Args): Promise<Result> => {
  try {
    return await action(...args);
  } catch (error) {
    if (error instanceof CloneActionError) throw error;
    throw new CloneActionError(stage, readErrorMessage(error), {
      cause: error,
      statusCode: readStatusCode(error),
    });
  }
};

/**
 * Clone RPC actions shared by the Express and Vercel entrypoints.
 * Keeping this allow-list in one module prevents local/production drift.
 */
export const CLONE_ACTIONS = {
  analyzeChatAndGeneratePersona: withCloneStage('analysis', analyzeChatAndGeneratePersona),
  analyzeProgressiveCloneBatch: withCloneStage('analysis', analyzeProgressiveCloneBatch),
  getParticipantsFromChat: withCloneStage('participants', getParticipantsFromChat),
  synthesizeSoulFromChat: withCloneStage('analysis', synthesizeSoulFromChat),
} as const;

export const CLONE_ACTION_NAMES = Object.freeze(
  Object.keys(CLONE_ACTIONS) as Array<keyof typeof CLONE_ACTIONS>,
);

export const getCloneActionStage = (error: unknown): CloneActionStage | undefined => (
  error instanceof CloneActionError ? error.stage : undefined
);
