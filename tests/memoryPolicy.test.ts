import assert from 'node:assert/strict';
import type { MemoryRecord } from '../contracts/rafiqV6.js';
import {
  buildMemoryScopeKey,
  calculateMemoryExpiry,
  canReadMemory,
  inferMemoryRetention,
  planMemoryCompaction,
  selectPromptMemories,
} from '../services/memoryPolicy.js';

const now = new Date('2026-07-13T12:00:00.000Z');

const makeRecord = (overrides: Partial<MemoryRecord> = {}): MemoryRecord => ({
  id: overrides.id ?? crypto.randomUUID(),
  ownerUserId: 'main_user',
  scope: overrides.scope ?? 'bot',
  scopeId: overrides.scopeId ?? 'bot-a',
  text: overrides.text ?? 'A scoped memory.',
  summary: overrides.summary ?? 'Scoped memory',
  category: overrides.category ?? 'general',
  provenance: overrides.provenance ?? {
    kind: 'user_message',
    sourceIds: ['message-1'],
    observedAt: now,
  },
  confidence: overrides.confidence ?? 0.8,
  salience: overrides.salience ?? 0.7,
  sensitivity: overrides.sensitivity ?? 'normal',
  retention: overrides.retention ?? 'general_30d',
  expiresAt: overrides.expiresAt,
  status: overrides.status ?? 'active',
  supersedesId: overrides.supersedesId,
  createdAt: overrides.createdAt ?? now,
  updatedAt: overrides.updatedAt ?? now,
});

assert.equal(buildMemoryScopeKey('bot', 'bot-a'), 'bot:bot-a');
assert.throws(() => buildMemoryScopeKey('bot', 'global_shared_pool'), /forbidden/);

const botAMemory = makeRecord({ scope: 'bot', scopeId: 'bot-a' });
assert.equal(canReadMemory(botAMemory, { botId: 'bot-a' }), true);
assert.equal(canReadMemory(botAMemory, { botId: 'bot-b' }), false, 'bot B must not read bot A memory');

const chatMemory = makeRecord({ scope: 'chat', scopeId: 'chat-a' });
assert.equal(canReadMemory(chatMemory, { botId: 'bot-a', chatId: 'chat-a' }), true);
assert.equal(canReadMemory(chatMemory, { botId: 'bot-a', chatId: 'chat-b' }), false);

const privateStory = makeRecord({ scope: 'user_story', scopeId: 'main_user', sensitivity: 'private' });
assert.equal(canReadMemory(privateStory, { botId: 'bot-a', allowUserStory: true }), false);

assert.equal(inferMemoryRetention('identity'), 'durable');
assert.equal(inferMemoryRetention('goal'), 'durable');
assert.equal(inferMemoryRetention('emotion'), 'transient_7d');
assert.equal(inferMemoryRetention('general'), 'general_30d');
assert.equal(calculateMemoryExpiry('durable', now), undefined);
assert.equal(calculateMemoryExpiry('transient_7d', now)?.toISOString(), '2026-07-20T12:00:00.000Z');
assert.equal(calculateMemoryExpiry('general_30d', now)?.toISOString(), '2026-08-12T12:00:00.000Z');

const selected = selectPromptMemories(
  [
    makeRecord({ id: 'a', scopeId: 'bot-a', salience: 0.9 }),
    makeRecord({ id: 'b', scopeId: 'bot-b', salience: 1 }),
    makeRecord({ id: 'c', scopeId: 'bot-a', expiresAt: new Date('2026-07-12T00:00:00.000Z') }),
  ],
  { botId: 'bot-a' },
  { now, limit: 8 },
);
assert.deepEqual(selected.map(record => record.id), ['a']);

const compactionRecords = Array.from({ length: 252 }, (_, index) => makeRecord({
  id: `record-${index}`,
  scopeId: 'bot-a',
  retention: index === 251 ? 'durable' : 'general_30d',
  salience: index / 252,
}));
const plan = planMemoryCompaction(compactionRecords, now, 250);
assert.equal(plan.keepIds.length, 250);
assert.equal(plan.removeIds.length, 2);
assert.equal(plan.keepIds.includes('record-251'), true, 'durable records must survive compaction');

const predecessor = makeRecord({ id: 'predecessor', status: 'superseded' });
const correction = makeRecord({ id: 'correction', supersedesId: predecessor.id });
const correctionPlan = planMemoryCompaction([predecessor, correction], now, 250);
assert.equal(correctionPlan.keepIds.includes(predecessor.id), true);
assert.equal(correctionPlan.removeIds.includes(predecessor.id), false);

console.log('Memory policy tests passed.');
