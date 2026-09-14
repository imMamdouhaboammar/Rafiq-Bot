import type { ContinuityAffordance, ContinuityCandidate, SensitivityLevel } from './types.ts';

export interface ContinuitySelectionContext {
  sensitivity: SensitivityLevel;
  callbackBudgetAvailable: boolean;
}

const kindBoost: Record<ContinuityCandidate['kind'], number> = {
  health: 0.12,
  outcome: 0.14,
  plan: 0.08,
  practical_task: 0.13,
  shared_interest: 0.03,
  ritual: 0.02,
};

export function selectContinuityAffordance(
  candidates: readonly ContinuityCandidate[],
  context: ContinuitySelectionContext,
): ContinuityAffordance | undefined {
  if (!context.callbackBudgetAvailable) return undefined;

  const sensitivityPenalty = context.sensitivity === 'high' ? 0.2 : context.sensitivity === 'medium' ? 0.05 : 0;
  const ranked = candidates
    .filter((candidate) => candidate.due && !candidate.expired && !candidate.resolved && candidate.sourceEvidenceCount > 0)
    .map((candidate) => ({
      candidate,
      score: (candidate.salience * 0.45) + (candidate.relevance * 0.55) + kindBoost[candidate.kind] - sensitivityPenalty,
    }))
    .filter(({ score }) => score >= 0.55)
    .sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id));

  const selected = ranked[0];
  if (!selected) return undefined;
  return {
    candidateId: selected.candidate.id,
    kind: selected.candidate.kind,
    summary: selected.candidate.summary.slice(0, 220),
    score: Number(selected.score.toFixed(4)),
  };
}
