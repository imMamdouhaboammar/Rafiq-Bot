import test from 'node:test';
import assert from 'node:assert/strict';
import { planRelationalMove } from '../src/relationalMovePlanner.ts';

const calibration = {
  teasingAllowed: true,
  teasingStrength: 1 as const,
  nicknameAllowed: true,
  codeSwitchMirroringAllowed: true,
  sharedReferenceAllowed: true,
  directDisagreementAllowed: true,
};
const base = {
  messageTextLength: 10,
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

test('prioritizes practical help over generic emotional behavior', () => {
  assert.equal(planRelationalMove({ ...base, requestsPracticalHelp: true }, calibration), 'practical_help');
});

test('maps explicit correction to micro repair', () => {
  assert.equal(planRelationalMove({ ...base, containsCorrection: true }, calibration), 'repair');
});

test('uses minimal presence for low-content social ping', () => {
  assert.equal(planRelationalMove({ ...base, isSocialPing: true, messageTextLength: 4 }, calibration), 'minimal_presence');
});

test('only selects teasing when invited and earned', () => {
  assert.equal(planRelationalMove({ ...base, userInvitesPlayfulness: true }, calibration), 'tease');
  assert.equal(planRelationalMove({ ...base, userInvitesPlayfulness: true }, { ...calibration, teasingAllowed: false, teasingStrength: 0 }), 'acknowledge');
});

test('can select stable disagreement without treating it as conflict', () => {
  assert.equal(planRelationalMove({ ...base, userExpressesOpinion: true, assistantHasDifferentStableOpinion: true }, calibration), 'disagree');
});
