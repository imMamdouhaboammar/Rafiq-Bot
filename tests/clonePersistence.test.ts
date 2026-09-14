import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildBlueprintMemoryRecords } from '../services/memoryEngine.js';
import { MessageRole, type SoulMemorySeed } from '../types.js';

const now = new Date('2026-07-17T12:00:00.000Z');
const seeds: SoulMemorySeed[] = [
  { text: ' ', category: 'fact', salience: 0.5, subject: 'persona' },
  { text: 'المستخدم بيحب القهوة السادة.', category: 'preference', salience: 0.9, subject: 'user' },
  { text: 'سارة بتواجه الخلاف بهدوء.', category: 'identity', salience: 0.85, subject: 'persona' },
  { text: 'بينهم عادة إنهم يتطمنوا على بعض بالليل.', category: 'memory', salience: 0.8, subject: 'relationship' },
];

const built = buildBlueprintMemoryRecords('clone-chat', seeds, now);
assert.equal(built.legacyEntries.length, 3);
assert.equal(built.memoryRecords.length, 3, 'legacy and V6 memory stores must receive the same clone seeds');
assert.equal(built.legacyEntries[0]?.sourceRole, MessageRole.USER);
assert.equal(built.legacyEntries[1]?.sourceRole, MessageRole.MODEL);
assert.equal(built.legacyEntries[2]?.sourceRole, MessageRole.MODEL);
assert.equal(built.memoryRecords[0]?.provenance.kind, 'user_message');
assert.equal(built.memoryRecords[1]?.provenance.kind, 'bot_message');
assert.equal(built.memoryRecords[2]?.provenance.kind, 'bot_message');
assert.ok(built.memoryRecords.every(record => record.scope === 'chat' && record.scopeId === 'clone-chat'));
assert.ok(built.memoryRecords.every(record => record.status === 'active'));

const dbSource = await readFile(new URL('../services/db.ts', import.meta.url), 'utf8');
assert.match(dbSource, /saveClonedChatSession/);
assert.match(
  dbSource,
  /db\.transaction\('rw', db\.chats, db\.memoryEntries, memoryRecordsTable/,
  'chat, legacy memories, and V6 memories must commit in one Dexie transaction',
);

const appSource = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');
assert.match(appSource, /await DB\.saveClonedChatSession/);
assert.doesNotMatch(appSource, /import:seed_memories/);

console.log('Clone persistence tests passed.');
