import assert from 'node:assert/strict';
import type { MemoryRecord } from '../contracts/rafiqV6.js';
import {
  MemoryRepository,
  type MemoryStore,
} from '../services/memoryRepository.js';

const values = new Map<string, MemoryRecord>();
const store: MemoryStore = {
  get: async id => values.get(id),
  put: async record => { values.set(record.id, structuredClone(record)); },
  bulkPut: async records => {
    for (const record of records) values.set(record.id, structuredClone(record));
  },
  list: async () => Array.from(values.values()).map(record => structuredClone(record)),
};

let idCounter = 0;
let now = new Date('2026-07-13T12:00:00.000Z');
const repository = new MemoryRepository(
  store,
  () => new Date(now),
  () => `memory-${++idCounter}`,
);

const botMemory = await repository.create({
  scope: 'bot',
  scopeId: 'bot-a',
  text: 'المستخدم يفضل الاجتماعات مساءً',
  category: 'preference',
  provenance: {
    kind: 'user_message',
    sourceIds: ['source-1'],
    observedAt: now,
  },
  confidence: 0.7,
  salience: 0.8,
});
const chatMemory = await repository.create({
  scope: 'chat',
  scopeId: 'chat-a',
  text: 'المستخدم يفضل الاجتماعات مساءً',
  category: 'preference',
  provenance: {
    kind: 'user_message',
    sourceIds: ['source-1'],
    observedAt: now,
  },
  confidence: 0.7,
  salience: 0.8,
});
assert.equal((await repository.list({ sourceId: 'source-1' })).length, 2);

now = new Date('2026-07-13T13:00:00.000Z');
const corrections = await repository.correctEverywhere({
  sourceIds: ['source-1'],
  replacement: {
    text: 'المستخدم يفضل الاجتماعات صباحًا',
    summary: 'يفضل الاجتماعات صباحًا',
    category: 'preference',
    provenanceSourceIds: ['correction-message'],
    confidence: 1,
    salience: 1,
  },
});
assert.equal(corrections.length, 2, 'correction must propagate to every affected scope');
assert.deepEqual(
  new Set(corrections.map(record => `${record.scope}:${record.scopeId}`)),
  new Set(['bot:bot-a', 'chat:chat-a']),
);
assert.equal((await store.get(botMemory.id))?.status, 'superseded');
assert.equal((await store.get(chatMemory.id))?.status, 'superseded');
assert.equal((await store.get(botMemory.id))?.text, botMemory.text);
assert.equal((await store.get(chatMemory.id))?.text, chatMemory.text);
assert.equal(
  corrections.find(record => record.scope === 'bot')?.supersedesId,
  botMemory.id,
);
assert.equal(
  corrections.find(record => record.scope === 'chat')?.supersedesId,
  chatMemory.id,
);
assert.equal(corrections.every(record => record.provenance.kind === 'correction'), true);
assert.equal(corrections.every(record => record.confidence === 1), true);

const forgottenCount = await repository.forgetEverywhere({
  ids: [botMemory.id, chatMemory.id],
});
assert.equal(forgottenCount, 4, 'forgetting original records must also forget their replacements');
for (const record of await store.list()) {
  assert.equal(record.status, 'forgotten');
  assert.match(record.text, /^\[/, 'forgotten records must have their content scrubbed');
}

values.clear();
idCounter = 0;
now = new Date('2026-07-13T14:00:00.000Z');
const fallbackCorrection = await repository.correctEverywhere({
  text: 'غير موجود',
  replacement: {
    text: 'معلومة مصححة جديدة',
    category: 'fact',
    provenanceSourceIds: ['correction-new'],
    confidence: 1,
    salience: 0.9,
    fallbackScope: { scope: 'bot', scopeId: 'bot-a' },
  },
});
assert.equal(fallbackCorrection.length, 1);
assert.equal(fallbackCorrection[0].scopeId, 'bot-a');

await assert.rejects(
  repository.correctEverywhere({
    text: 'لا يوجد تطابق',
    replacement: {
      text: 'بدون نطاق',
      category: 'fact',
      provenanceSourceIds: ['correction-fail'],
      confidence: 1,
      salience: 1,
    },
  }),
  /no fallback scope/,
);

values.clear();
idCounter = 0;
for (let index = 0; index < 252; index++) {
  await repository.create({
    scope: 'chat',
    scopeId: 'long-chat',
    text: `معلومة طويلة للاختبار رقم ${index}`,
    category: 'general',
    provenance: {
      kind: 'user_message',
      sourceIds: [`message-${index}`],
      observedAt: now,
    },
    confidence: 0.6,
    salience: index / 252,
  });
}
const active = (await repository.list({ scopeId: 'long-chat', status: 'active' }));
assert.equal(active.length, 250, 'compaction must keep at most 250 active records per scope');
assert.equal((await repository.list({ scopeId: 'long-chat', status: 'forgotten' })).length, 2);

console.log('Memory repository tests passed.');
