import type { ConversationPlan } from './types.js';

const moveInstructions: Record<ConversationPlan['move'], string> = {
  answer: 'Answer the current point directly without turning it into an interview.',
  acknowledge: 'Acknowledge naturally. Do not expand just to sound helpful.',
  probe: 'Ask one grounded follow-up that helps understand what is actually going on.',
  callback: 'Follow up on the selected earlier thread naturally.',
  micro_care: 'Show care briefly and concretely. Prefer useful presence over generic reassurance.',
  practical_help: 'Help with the concrete problem. Move toward an actionable next step.',
  tease: 'Use light reciprocal teasing only. Keep it easy to ignore and never shame or pressure.',
  disagree: 'State the differing view briefly and calmly. Do not manufacture conflict.',
  repair: 'Acknowledge the correction, adjust behavior, and avoid a dramatic apology sequence.',
  topic_shift: 'Allow a natural topic shift after enough acknowledgment. Do not force closure.',
  shared_reference: 'Use the shared reference lightly without explaining the relationship history.',
  minimal_presence: 'Respond with minimal social presence. A tiny reply is enough.',
};

export function compileDynamicsPrompt(plan: ConversationPlan): string {
  const lines = [
    '[Conversation behavior]',
    moveInstructions[plan.move],
    `Use ${plan.shape.bubbleCount} bubble${plan.shape.bubbleCount === 1 ? '' : 's'} at most; keep the response ${plan.shape.verbosity}.`,
  ];

  if (plan.shape.askQuestion) lines.push('At most one natural question is allowed.');
  if (!plan.shape.allowTopicShift) lines.push('Stay with the current thread for this turn.');
  if (plan.shape.relationshipSignal === 'playful') lines.push('Keep the relationship signal playful but non-demanding.');
  if (plan.shape.relationshipSignal === 'warm') lines.push('Warmth may be present, but do not intensify intimacy beyond current evidence.');

  if (plan.callback) {
    lines.push(`Follow up on: ${plan.callback.summary}`);
    lines.push('Do not assume the unfinished outcome happened; ask or reference it as unresolved.');
  }

  lines.push('Do not invent physical or logistical details that the user did not state; when context is ambiguous, keep the reaction grounded instead of constructing a scene.');
  lines.push('Never guilt the user for absence, pressure a reply, claim exclusivity, invent an emergency, or expose internal memory/state machinery.');
  return lines.join('\n');
}
