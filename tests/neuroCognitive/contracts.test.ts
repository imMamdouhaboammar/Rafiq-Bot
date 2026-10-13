import assert from 'node:assert/strict';
import {
  MemoryFactSchema,
  MemoryRelationSchema,
  MemoryEventSchema,
  MemoryJobSchema,
  ReflectionEntrySchema,
  AffectStateSchema,
  MemoryGrantSchema,
  type MemoryFact,
  type AffectState,
  type MemoryGrant,
} from '../../contracts/neuroCognitive.js';

// 1. Verify MemoryFact schema validation & defaults
const testFact = MemoryFactSchema.parse({
  id: 'fact-1',
  companionId: 'amira-1',
  subjectId: 'user',
  predicate: 'prefers_work_hours',
  objectValue: 'evening',
  polarity: 'positive',
  certainty: 'explicit',
  confidence: 0.95,
  sourceEventIds: ['evt-1', 'evt-2'],
  observedAt: new Date('2026-10-09T08:00:00Z'),
  createdAt: new Date('2026-10-09T08:00:00Z'),
  updatedAt: new Date('2026-10-09T08:00:00Z'),
});

assert.equal(testFact.version, 1);
assert.equal(testFact.status, 'active');
assert.equal(testFact.ownerId, 'main_user');

// 2. Verify AffectState schema
const testAffect: AffectState = AffectStateSchema.parse({
  companionId: 'amira-1',
  valence: 0.4,
  arousal: 0.5,
  security: 0.8,
  tension: 0.05,
  updatedAt: new Date(),
});
assert.equal(testAffect.modelVersion, 1);
assert.equal(testAffect.security, 0.8);

// 3. Verify MemoryGrant schema
const testGrant: MemoryGrant = MemoryGrantSchema.parse({
  grantId: 'grant-amira-to-kimo',
  sourceCompanionId: 'amira-1',
  targetCompanionId: 'kimo-1',
  direction: 'source_to_target',
  categories: ['facts', 'preferences'],
  sensitivityMax: 'normal',
  approvedAt: new Date(),
});
assert.equal(testGrant.direction, 'source_to_target');
assert.equal(testGrant.revokedAt, undefined);

// 4. Verify invalid grant direction throws error
assert.throws(() => {
  MemoryGrantSchema.parse({
    grantId: 'invalid-grant',
    sourceCompanionId: 'amira-1',
    targetCompanionId: 'kimo-1',
    direction: 'bidirectional', // invalid
    categories: ['facts'],
    approvedAt: new Date(),
  });
});

console.log('✓ Neuro-Cognitive contract tests passed successfully.');
