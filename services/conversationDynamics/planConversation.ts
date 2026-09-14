import { applyConversationSafetyGate } from './conversationSafetyGate.js';
import { selectContinuityAffordance } from './continuityAffordance.js';
import { calibrateRelationship } from './relationshipCalibration.js';
import { planRelationalMove } from './relationalMovePlanner.js';
import { planReplyShape } from './replyShapePlanner.js';
import type { ContinuityCandidate, ConversationPlan, DynamicsInput, RelationshipEvidence } from './types.js';

export interface PlanConversationArgs {
  input: DynamicsInput;
  evidence: RelationshipEvidence;
  continuityCandidates?: readonly ContinuityCandidate[];
  callbackBudgetAvailable?: boolean;
}

export function planConversation(args: PlanConversationArgs): ConversationPlan {
  const calibration = calibrateRelationship(args.evidence);
  const callback = selectContinuityAffordance(args.continuityCandidates ?? [], {
    sensitivity: args.input.sensitivity,
    callbackBudgetAvailable: args.callbackBudgetAvailable ?? true,
  });

  let proposedMove = planRelationalMove(args.input, calibration);
  const callbackEligibleBaseMoves = new Set(['acknowledge', 'minimal_presence', 'answer']);
  if (callback && callbackEligibleBaseMoves.has(proposedMove)) proposedMove = 'callback';

  const safety = applyConversationSafetyGate(proposedMove, {
    activeConflict: args.input.activeConflict,
    sensitivity: args.input.sensitivity,
    teasingAllowed: calibration.teasingAllowed,
    userInvitesPlayfulness: args.input.userInvitesPlayfulness,
  });

  const shape = planReplyShape(safety.move, {
    recentSameSpeakerBurst: args.input.recentSameSpeakerBurst,
    recentAssistantVerbosity: args.input.recentAssistantVerbosity,
    allowTopicShift: args.input.allowTopicShift,
    sensitivity: args.input.sensitivity,
  });

  return {
    move: safety.move,
    shape,
    callback: safety.move === 'callback' ? callback : undefined,
    safetyReasons: safety.reasons,
  };
}
