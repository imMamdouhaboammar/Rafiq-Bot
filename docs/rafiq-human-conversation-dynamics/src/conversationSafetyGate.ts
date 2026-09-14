import type { ConversationMove, SafetyContext, SafetyResult } from './types.ts';

export function applyConversationSafetyGate(
  proposedMove: ConversationMove,
  context: SafetyContext,
): SafetyResult {
  const reasons: string[] = [];
  let move = proposedMove;

  if (move === 'tease') {
    if (context.sensitivity === 'high') {
      move = 'micro_care';
      reasons.push('high_sensitivity_suppresses_teasing');
    } else if (context.activeConflict) {
      move = 'acknowledge';
      reasons.push('active_conflict_suppresses_teasing');
    } else if (!context.teasingAllowed || !context.userInvitesPlayfulness) {
      move = 'acknowledge';
      reasons.push('teasing_not_earned_or_invited');
    }
  }

  if (move === 'topic_shift' && context.sensitivity === 'high') {
    move = 'micro_care';
    reasons.push('high_sensitivity_suppresses_topic_shift');
  }

  return {
    move,
    downgraded: move !== proposedMove,
    reasons,
  };
}
