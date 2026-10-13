import type { PsychologicalState } from '../../types.js';
import {
  CompanionContinuityState,
  ContinuityThread,
  applyContinuityProposal,
  ContinuityProposal,
  ContinuityEvidence,
} from '../companionContinuity.js';

export interface SalienceDecayOptions {
  lambdaDecay?: number; // default 0.05
  omegaArousal?: number; // default 2.0
}

/**
 * Computes exponential salience decay:
 * S(t) = S_0 * exp( - lambda * delta_t / (1 + omega * Arousal) )
 */
export function computeSalienceDecay(
  initialSalience: number,
  elapsedHours: number,
  arousal: number = 0.5,
  options: SalienceDecayOptions = {}
): number {
  const { lambdaDecay = 0.05, omegaArousal = 2.0 } = options;
  if (elapsedHours <= 0) return initialSalience;

  const effectiveDecay = (lambdaDecay * elapsedHours) / (1.0 + omegaArousal * arousal);
  const newSalience = initialSalience * Math.exp(-effectiveDecay);
  return Math.max(0.0, Math.min(1.0, Math.round(newSalience * 1000) / 1000));
}

/**
 * Applies natural temporal decay across all continuity threads.
 * Threads whose salience drops below threshold (0.15) transition to 'dormant' or 'expired'.
 */
export function decayContinuityThreads(
  state: CompanionContinuityState,
  elapsedHours: number
): CompanionContinuityState {
  if (elapsedHours <= 0 || !state.threads.length) return state;

  const updatedThreads: ContinuityThread[] = state.threads.map(thread => {
    if (thread.status === 'resolved' || thread.status === 'expired') {
      return thread;
    }

    const decayedSalience = computeSalienceDecay(thread.salience, elapsedHours);
    let nextStatus = thread.status;

    if (decayedSalience < 0.15 && thread.status === 'active') {
      nextStatus = 'dormant';
    }

    return {
      ...thread,
      salience: decayedSalience,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };
  });

  return {
    ...state,
    threads: updatedThreads,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Deterministic reducer for cognitive proposals.
 * - Rejects any proposal with confidence < 0.60.
 * - Prevents romantic promotion from a single affectionate turn.
 * - Preserves Rafiq state ownership without parallel stores.
 */
export function reduceCognitiveProposal(
  currentState: CompanionContinuityState,
  proposal: ContinuityProposal,
  now: Date = new Date()
): { nextState: CompanionContinuityState; applied: boolean; reason: string } {
  // 1. Invariant: Proposals below confidence 0.60 are dropped
  const confidence = (proposal as any).confidence;
  if (typeof confidence === 'number' && confidence < 0.60) {
    return {
      nextState: currentState,
      applied: false,
      reason: `Proposal rejected: confidence ${confidence} is below threshold 0.60`,
    };
  }

  // 2. Safeguard: Prevent sudden unearned expectation escalation
  if (proposal.type === 'expectation_upsert') {
    const keyLower = proposal.key.toLowerCase();
    if (keyLower.includes('romantic') || keyLower.includes('حب') || keyLower.includes('عشق')) {
      // Must have at least 3 pieces of historical evidence
      const evidenceCount = proposal.sourceMessageIds ? proposal.sourceMessageIds.length : 0;
      if (evidenceCount < 3) {
        return {
          nextState: currentState,
          applied: false,
          reason: 'Romantic expectation rejected: requires minimum 3 corroborated evidence counts.',
        };
      }
    }
  }

  // 3. Delegate to Rafiq's canonical continuity applier
  const effectiveEvidence: ContinuityEvidence = {
    messageIds: proposal.sourceMessageIds || [],
  };
  const nextState = applyContinuityProposal(currentState, proposal, effectiveEvidence, now);
  return {
    nextState,
    applied: true,
    reason: 'Proposal reduced and committed to continuity state.',
  };
}
