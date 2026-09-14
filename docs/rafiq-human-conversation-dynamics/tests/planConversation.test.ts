import test from 'node:test';
import assert from 'node:assert/strict';
import { planConversation } from '../src/planConversation.ts';

const input = {
  messageTextLength: 8,
  isSocialPing: false,
  asksConcreteQuestion: false,
  requestsPracticalHelp: false,
  expressesDistress: false,
  containsCorrection: false,
  activeConflict: false,
  sensitivity: 'low' as const,
  userInvitesPlayfulness: false,
  userExpressesOpinion: false,
  assistantHasDifferentStableOpinion: false,
  recentAssistantVerbosity: 'short' as const,
  recentSameSpeakerBurst: 1,
  allowTopicShift: true,
};
const evidence = {
  teasingPositiveReciprocations: 5,
  teasingNegativeCorrections: 0,
  nicknameReciprocatedUses: 3,
  nicknameSessions: 2,
  codeSwitchUserExamples: 4,
  codeSwitchSessions: 2,
  sharedReferenceReciprocations: 2,
  directnessPositiveEvidence: 2,
};

test('orchestrates calibration, optional callback, safety, and shape deterministically', () => {
  const plan = planConversation({
    input,
    evidence,
    continuityCandidates: [{ id: 'follow', kind: 'outcome', summary: 'ask how the pending result went', salience: 0.9, relevance: 0.95, due: true, expired: false, resolved: false, sourceEvidenceCount: 2 }],
    callbackBudgetAvailable: true,
  });
  assert.equal(plan.move, 'callback');
  assert.equal(plan.callback?.candidateId, 'follow');
  assert.equal(plan.shape.askQuestion, true);
});
