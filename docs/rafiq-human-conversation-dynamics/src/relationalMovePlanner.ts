import type { ConversationMove, DynamicsInput, RelationshipCalibration } from './types.ts';

export function planRelationalMove(
  input: DynamicsInput,
  calibration: RelationshipCalibration,
): ConversationMove {
  if (input.containsCorrection) return 'repair';
  if (input.requestsPracticalHelp) return 'practical_help';
  if (input.expressesDistress) return input.sensitivity === 'high' ? 'micro_care' : 'probe';
  if (
    input.userExpressesOpinion
    && input.assistantHasDifferentStableOpinion
    && calibration.directDisagreementAllowed
    && !input.activeConflict
  ) return 'disagree';
  if (
    input.userInvitesPlayfulness
    && calibration.teasingAllowed
    && !input.activeConflict
    && input.sensitivity === 'low'
  ) return 'tease';
  if (input.isSocialPing && input.messageTextLength <= 20) return 'minimal_presence';
  if (input.asksConcreteQuestion) return 'answer';
  return 'acknowledge';
}
