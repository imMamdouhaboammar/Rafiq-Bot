import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { MemoryRecord } from '../contracts/rafiqV6.js';
import {
  isCloneSeededLegacyMemory,
  isCloneSeededMemoryRecord,
} from '../services/db.js';
import { MessageRole, type MemoryEntry } from '../types.js';

const now = new Date('2026-07-17T12:00:00.000Z');
const legacyMemory = (id: string, chatId = 'clone-chat'): MemoryEntry => ({
  id,
  chatId,
  sourceMessageId: id.split(':').at(-1) || id,
  sourceRole: MessageRole.MODEL,
  text: 'ذكرى للاختبار',
  summary: 'ذكرى للاختبار',
  normalizedText: 'ذكرى للاختبار',
  keywords: ['ذكرى'],
  category: 'memory',
  salience: 0.8,
  createdAt: now,
  updatedAt: now,
});

assert.equal(isCloneSeededLegacyMemory('clone-chat', legacyMemory('clone-chat:seed_0')), true);
assert.equal(isCloneSeededLegacyMemory('clone-chat', legacyMemory('clone-chat:progressive_seed_12')), true);
assert.equal(
  isCloneSeededLegacyMemory('clone-chat', legacyMemory('clone-chat:message-123')),
  false,
  'ordinary message-derived memories must not be classified as clone seeds',
);
assert.equal(isCloneSeededLegacyMemory('clone-chat', legacyMemory('clone-chat:seed_notes')), false);
assert.equal(isCloneSeededLegacyMemory('clone-chat', legacyMemory('other-chat:seed_0', 'other-chat')), false);

const v6Memory = (id: string, scopeId = 'clone-chat'): MemoryRecord => ({
  id,
  ownerUserId: 'main_user',
  scope: 'chat',
  scopeId,
  text: 'ذكرى للاختبار',
  summary: 'ذكرى للاختبار',
  category: 'memory',
  provenance: {
    kind: 'bot_message',
    sourceIds: ['source-1'],
    observedAt: now,
  },
  confidence: 0.8,
  salience: 0.8,
  sensitivity: 'normal',
  retention: 'durable',
  status: 'active',
  createdAt: now,
  updatedAt: now,
});

assert.equal(isCloneSeededMemoryRecord('clone-chat', v6Memory('clone:clone-chat:seed_0')), true);
assert.equal(isCloneSeededMemoryRecord('clone-chat', v6Memory('clone:clone-chat:progressive_seed_2')), true);
assert.equal(
  isCloneSeededMemoryRecord('clone-chat', v6Memory('legacy:clone-chat:seed_4')),
  true,
  'V6 copies migrated from legacy clone seeds must be replaced too',
);
assert.equal(isCloneSeededMemoryRecord('clone-chat', v6Memory('legacy:clone-chat:message-123')), false);
assert.equal(isCloneSeededMemoryRecord('clone-chat', v6Memory('clone:other-chat:seed_0', 'other-chat')), false);

const dbSource = await readFile(new URL('../services/db.ts', import.meta.url), 'utf8');
assert.match(dbSource, /patchChatAndReplaceCloneMemories/);
assert.match(
  dbSource,
  /db\.transaction\('rw', db\.chats, db\.memoryEntries, memoryRecordsTable/,
  'chat settings and both memory stores must update in one transaction',
);
assert.match(dbSource, /filter\(entry => isCloneSeededLegacyMemory\(chatId, entry\)\)/);
assert.match(dbSource, /filter\(record => isCloneSeededMemoryRecord\(chatId, record\)\)/);
assert.match(
  dbSource,
  /getCloneMemorySeedsForChat/,
  'legacy clone seeds must remain available to hydrate the profile editor',
);

console.log('Clone memory replacement tests passed.');
