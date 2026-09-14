import {
  ContinuityProposalSchema,
  type ContinuityProposal,
} from "./companionContinuity.js";

/**
 * Accepts only schema-valid continuity proposals whose provenance points to
 * messages available in the reflection window. Invalid model output is dropped
 * rather than repaired or guessed.
 */
export function validateContinuityProposals(
  raw: unknown,
  allowedMessageIds: readonly string[],
): ContinuityProposal[] {
  if (!Array.isArray(raw)) return [];

  const allowed = new Set(allowedMessageIds);
  const validated: ContinuityProposal[] = [];

  for (const candidate of raw) {
    const parsed = ContinuityProposalSchema.safeParse(candidate);
    if (!parsed.success) continue;
    if (parsed.data.sourceMessageIds.some(id => !allowed.has(id))) continue;
    validated.push(parsed.data);
    if (validated.length >= 10) break;
  }

  return validated;
}
