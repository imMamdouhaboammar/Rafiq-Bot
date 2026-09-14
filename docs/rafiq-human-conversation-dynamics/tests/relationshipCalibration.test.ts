import test from 'node:test';
import assert from 'node:assert/strict';
import { calibrateRelationship } from '../src/relationshipCalibration.ts';

const base = {
  teasingPositiveReciprocations: 0,
  teasingNegativeCorrections: 0,
  nicknameReciprocatedUses: 0,
  nicknameSessions: 0,
  codeSwitchUserExamples: 0,
  codeSwitchSessions: 0,
  sharedReferenceReciprocations: 0,
  directnessPositiveEvidence: 0,
};

test('keeps relationship-earned behaviors disabled before evidence thresholds', () => {
  const result = calibrateRelationship(base);
  assert.equal(result.teasingAllowed, false);
  assert.equal(result.nicknameAllowed, false);
  assert.equal(result.codeSwitchMirroringAllowed, false);
  assert.equal(result.sharedReferenceAllowed, false);
});

test('enables earned behaviors only after repeated cross-session evidence', () => {
  const result = calibrateRelationship({
    ...base,
    teasingPositiveReciprocations: 5,
    nicknameReciprocatedUses: 4,
    nicknameSessions: 2,
    codeSwitchUserExamples: 5,
    codeSwitchSessions: 2,
    sharedReferenceReciprocations: 3,
    directnessPositiveEvidence: 3,
  });
  assert.equal(result.teasingAllowed, true);
  assert.equal(result.teasingStrength, 2);
  assert.equal(result.nicknameAllowed, true);
  assert.equal(result.codeSwitchMirroringAllowed, true);
  assert.equal(result.sharedReferenceAllowed, true);
  assert.equal(result.directDisagreementAllowed, true);
});

test('explicit negative teasing correction overrides accumulated positive evidence', () => {
  const result = calibrateRelationship({
    ...base,
    teasingPositiveReciprocations: 10,
    teasingNegativeCorrections: 1,
  });
  assert.equal(result.teasingAllowed, false);
  assert.equal(result.teasingStrength, 0);
});
