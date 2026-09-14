import {
  CapabilityHealthSchema,
  type CapabilityHealth,
} from '../contracts/rafiqV6.js';

export interface CapabilityRequirement {
  name: string;
  present: boolean;
}

export interface CapabilityTestResult {
  ok: boolean;
  checkedAt: Date;
  kind: CapabilityHealth['testKind'];
  reason: string;
}

export const deriveCapabilityHealth = ({
  capability,
  requirements,
  testResult,
  lastSuccessAt,
}: {
  capability: CapabilityHealth['capability'];
  requirements: CapabilityRequirement[];
  testResult?: CapabilityTestResult;
  lastSuccessAt?: Date;
}): CapabilityHealth => {
  const missingRequirements = requirements
    .filter(requirement => !requirement.present)
    .map(requirement => requirement.name);
  const checkedAt = testResult?.checkedAt ?? new Date();

  if (missingRequirements.length > 0) {
    return CapabilityHealthSchema.parse({
      capability,
      status: 'misconfigured',
      checkedAt,
      lastSuccessAt,
      reason: `Missing required configuration: ${missingRequirements.join(', ')}`,
      missingRequirements,
      testKind: 'configuration',
    });
  }

  if (!testResult) {
    return CapabilityHealthSchema.parse({
      capability,
      status: 'degraded',
      checkedAt,
      lastSuccessAt,
      reason: 'Configured but not verified by a real capability test.',
      missingRequirements: [],
      testKind: 'configuration',
    });
  }

  if (testResult.ok) {
    return CapabilityHealthSchema.parse({
      capability,
      status: 'healthy',
      checkedAt,
      lastSuccessAt: testResult.checkedAt,
      reason: testResult.reason,
      missingRequirements: [],
      testKind: testResult.kind,
    });
  }

  return CapabilityHealthSchema.parse({
    capability,
    status: lastSuccessAt ? 'degraded' : 'unavailable',
    checkedAt,
    lastSuccessAt,
    reason: testResult.reason,
    missingRequirements: [],
    testKind: testResult.kind,
  });
};

export const canClaimCapabilityWorks = (health: CapabilityHealth): boolean => (
  health.status === 'healthy' &&
  (health.testKind === 'staging' || health.testKind === 'real_provider') &&
  Boolean(health.lastSuccessAt)
);
