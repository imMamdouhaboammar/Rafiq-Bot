import assert from 'node:assert/strict';
import {
  updateWorkingMemorySnapshot,
  getWorkingMemorySnapshot,
  scoreFact,
  retrieveSmartMemory,
  formatMemoryContext,
} from '../../services/smartRetrieval.js';
import type { MemoryFact } from '../../contracts/neuroCognitive.js';

const mockFact1: MemoryFact = {
  id: 'f-1',
  ownerId: 'main_user',
  companionId: 'amira-1',
  subjectId: 'user',
  predicate: 'residence_city',
  objectValue: 'الرياض',
  polarity: 'positive',
  certainty: 'explicit',
  confidence: 0.95,
  sensitivity: 'normal',
  sourceEventIds: ['evt-1'],
  observedAt: new Date(),
  status: 'active',
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockFact2: MemoryFact = {
  id: 'f-2',
  ownerId: 'main_user',
  companionId: 'amira-1',
  subjectId: 'user',
  predicate: 'likes_food_or_thing',
  objectValue: 'الكشري',
  polarity: 'positive',
  certainty: 'explicit',
  confidence: 0.9,
  sensitivity: 'normal',
  sourceEventIds: ['evt-2'],
  observedAt: new Date(),
  status: 'active',
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// 1. Tier 0 Snapshot Pre-warming
updateWorkingMemorySnapshot('amira-1', [mockFact1]);
const snapshot = getWorkingMemorySnapshot('amira-1');
assert.ok(snapshot);
assert.equal(snapshot.pinnedFacts.length, 1);
assert.equal(snapshot.pinnedFacts[0].objectValue, 'الرياض');

// 2. Score fact against query
const score1 = scoreFact(mockFact1, ['الرياض', 'عايش']);
assert.ok(score1 > 0.4, 'Matching city should score high');

const score2 = scoreFact(mockFact2, ['الرياض', 'عايش']);
assert.ok(score2 < score1, 'Unrelated food should score lower than matching city');

// 3. Tier 1 Retrieval with factsFetcher
const res = await retrieveSmartMemory(
  'amira-1',
  'أنا رايح مشوار في الرياض',
  100,
  async () => [mockFact1, mockFact2],
);
assert.equal(res.tierUsed, 'tier1_lexical');
assert.equal(res.facts.length, 1);
assert.equal(res.facts[0].objectValue, 'الرياض');
assert.ok(res.formattedContext?.includes('الرياض'));

// 4. Timeout Fallback to Tier 0 Snapshot
const timedOutRes = await retrieveSmartMemory(
  'amira-1',
  'أنا في الرياض',
  20, // very tight timeout
  async () => {
    await new Promise(resolve => setTimeout(resolve, 50)); // artificial lag
    return [mockFact2];
  },
);
assert.equal(timedOutRes.tierUsed, 'tier0_snapshot', 'Must fallback to Tier 0 snapshot on timeout');
assert.equal(timedOutRes.facts[0].id, mockFact1.id, 'Snapshot facts returned safely');

console.log('✓ Smart retrieval tests passed successfully.');
