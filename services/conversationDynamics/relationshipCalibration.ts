import type { RelationshipCalibration, RelationshipEvidence } from './types.js';

export function calibrateRelationship(evidence: RelationshipEvidence): RelationshipCalibration {
  const teasingSuppressed = evidence.teasingNegativeCorrections > 0;
  const teasingAllowed = !teasingSuppressed && evidence.teasingPositiveReciprocations >= 3;
  const teasingStrength: 0 | 1 | 2 = !teasingAllowed
    ? 0
    : evidence.teasingPositiveReciprocations >= 5
      ? 2
      : 1;

  return {
    teasingAllowed,
    teasingStrength,
    nicknameAllowed: evidence.nicknameReciprocatedUses >= 3 && evidence.nicknameSessions >= 2,
    codeSwitchMirroringAllowed: evidence.codeSwitchUserExamples >= 4 && evidence.codeSwitchSessions >= 2,
    sharedReferenceAllowed: evidence.sharedReferenceReciprocations >= 2,
    directDisagreementAllowed: evidence.directnessPositiveEvidence >= 2,
  };
}
