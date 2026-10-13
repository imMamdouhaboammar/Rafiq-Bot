import assert from 'node:assert/strict';
import {
  readBridgedMemories,
} from '../../services/companionBridge.js';
import type { MemoryGrant, MemoryFact } from '../../contracts/neuroCognitive.js';

const mockFactA: MemoryFact = {
  id: 'f-amira-1',
  ownerId: 'main_user',
  companionId: 'amira',
  subjectId: 'user',
  predicate: 'frequent_coffee_order',
  objectValue: 'سبانش لاتيه',
  polarity: 'positive',
  certainty: 'explicit',
  confidence: 0.9,
  sensitivity: 'normal',
  sourceEventIds: ['evt-1'],
  observedAt: new Date(),
  status: 'active',
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRestrictedFactA: MemoryFact = {
  id: 'f-amira-secret',
  ownerId: 'main_user',
  companionId: 'amira',
  subjectId: 'user',
  predicate: 'medical_condition',
  objectValue: 'حساسية من الفول السوداني',
  polarity: 'positive',
  certainty: 'explicit',
  confidence: 0.9,
  sensitivity: 'restricted', // restricted!
  sourceEventIds: ['evt-2'],
  observedAt: new Date(),
  status: 'active',
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

let activeGrant: MemoryGrant | undefined = {
  grantId: 'grant-amira-to-kimo',
  ownerId: 'main_user',
  sourceCompanionId: 'amira',
  targetCompanionId: 'kimo',
  direction: 'source_to_target',
  categories: ['facts', 'preferences'],
  sensitivityMax: 'normal',
  approvedAt: new Date(),
};

// 1. Successful read under active grant
const result = await readBridgedMemories(
  'kimo',
  'amira',
  ['لاتيه'],
  async () => activeGrant,
  async () => [mockFactA, mockRestrictedFactA],
  'أميرة',
);

assert.ok(result, 'Result must exist under active grant');
assert.equal(result.facts.length, 1);
assert.equal(result.facts[0].objectValue, 'سبانش لاتيه');
assert.ok(result.formattedContext?.includes('أميرة'));
assert.ok(!result.formattedContext?.includes('حساسية'), 'Restricted facts must never be bridged');

// 2. Immediate Revocation
activeGrant = {
  ...activeGrant,
  revokedAt: new Date(),
};

const resultAfterRevoke = await readBridgedMemories(
  'kimo',
  'amira',
  ['لاتيه'],
  async () => activeGrant,
  async () => [mockFactA],
  'أميرة',
);

assert.equal(resultAfterRevoke, null, 'Must return null immediately when grant is revoked');

// 3. Unauthorized reverse access (Non-transitive check)
// No grant exists for kimo -> amira
const reverseResult = await readBridgedMemories(
  'amira',
  'kimo',
  ['لاتيه'],
  async () => undefined, // no grant
  async () => [mockFactA],
);
assert.equal(reverseResult, null, 'Reverse access without explicit grant must be blocked');

console.log('✓ Cross-companion memory bridge tests passed successfully.');
