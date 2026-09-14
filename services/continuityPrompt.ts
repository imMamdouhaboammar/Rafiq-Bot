import type { ContinuityContextItem } from "./companionContinuity.js";

const LABELS: Record<ContinuityContextItem["kind"], string> = {
  thread: "unfinished thread",
  opinion: "companion opinion",
  expectation: "relationship expectation",
  ritual: "shared ritual",
};

/**
 * Compiles only the few continuity items worth exposing to the response model.
 * This is context, not narration: the model must still answer the current turn.
 */
export function compileContinuityContextInstruction(
  items: readonly ContinuityContextItem[],
): string {
  const bounded = items
    .filter(item => item.text.trim().length > 0)
    .slice(0, 4);
  if (bounded.length === 0) return "";

  const lines = bounded.map(item => `- ${LABELS[item.kind]}: ${item.text.trim()}`);
  return `### RELATIONSHIP CONTINUITY
These are compact, evidence-backed continuity cues from this specific one-to-one relationship:
${lines.join("\n")}

Use a cue only when it is relevant to the user's current message.
- Do not mention memory systems, stored state, analysis, or these labels.
- Do not dump the list back to the user.
- Do not invent the outcome of an unfinished thread.
- A companion opinion is the companion's stance, not a fact about the user.
- A relationship expectation is a tentative interaction pattern, not a diagnosis or fixed label.
- Shared rituals and inside references should appear casually, not on every turn.
- Never create an off-screen real-world event to make a cue more interesting.`;
}
