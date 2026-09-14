import assert from 'node:assert/strict';
import type {
  AttachmentRecord,
  BotStoryEvent,
  LifeStoryEvent,
  MemoryRecord,
} from '../contracts/rafiqV6.js';
import {
  buildRafiqTransferV2,
  canonicalJson,
  parseRafiqTransferV2,
  serializeRafiqTransferV2,
  validateRafiqTransferV2,
} from '../services/transferV2.js';

const now = new Date('2026-07-13T12:00:00.000Z');
const lifeEvents: LifeStoryEvent[] = [
  {
    id: 'life-public',
    userId: 'main_user',
    title: 'حدث مشترك',
    summary: 'حدث يمكن للبوتات المختارة معرفته.',
    happenedAt: now,
    createdAt: now,
    updatedAt: now,
    acl: { visibility: 'selected_bots', botIds: ['bot-a'] },
    sensitivity: 'normal',
    source: 'user_entered',
  },
  {
    id: 'life-private',
    userId: 'main_user',
    title: 'حدث خاص',
    summary: 'لا يدخل النسخة العادية.',
    happenedAt: now,
    createdAt: now,
    updatedAt: now,
    acl: { visibility: 'private', botIds: [] },
    sensitivity: 'private',
    source: 'user_entered',
  },
];
const botEvents: BotStoryEvent[] = [{
  id: 'bot-event',
  botId: 'bot-a',
  title: 'قرار مرصود',
  summary: 'قرار شاهده البوت في المحادثة.',
  kind: 'observed',
  sourceMessageIds: ['message-1'],
  confidence: 0.9,
  status: 'active',
  acl: { visibility: 'selected_bots', botIds: ['bot-a'] },
  createdAt: now,
  updatedAt: now,
}];
const makeMemory = (
  id: string,
  sensitivity: MemoryRecord['sensitivity'],
): MemoryRecord => ({
  id,
  ownerUserId: 'main_user',
  scope: 'chat',
  scopeId: 'chat-a',
  text: `memory ${id}`,
  summary: `summary ${id}`,
  category: 'fact',
  provenance: {
    kind: 'user_message',
    sourceIds: ['message-1'],
    observedAt: now,
  },
  confidence: 0.9,
  salience: 0.8,
  sensitivity,
  retention: 'general_30d',
  expiresAt: new Date('2026-08-12T12:00:00.000Z'),
  status: 'active',
  createdAt: now,
  updatedAt: now,
});
const attachments: AttachmentRecord[] = [{
  id: 'attachment-a',
  chatId: 'chat-a',
  messageId: 'message-1',
  fileName: 'large-video.mp4',
  mimeType: 'video/mp4',
  sizeBytes: 500_000_000,
  sha256: 'a'.repeat(64),
  opfsKey: 'attachment-a.bin',
  availability: 'available',
  processingProgress: 1,
  derivedText: 'DOCUMENT-DERIVED-TEXT-MUST-NOT-LEAVE',
  createdAt: now,
  updatedAt: now,
}];

const transfer = buildRafiqTransferV2({
  appVersion: '0.0.0-test',
  chats: [{ id: 'chat-a', name: 'Chat A' }],
  messages: [{
    id: 'message-1',
    chatId: 'chat-a',
    text: 'ملف كبير',
    attachments: [{
      id: 'attachment-a',
      fileName: 'large-video.mp4',
      mimeType: 'video/mp4',
      base64: 'THIS-MUST-NOT-LEAVE',
      previewUrl: 'blob:local-object-url',
      file: { local: true },
      data: new Uint8Array([1, 2, 3]),
      extractedText: 'MESSAGE-EXTRACTED-TEXT-MUST-NOT-LEAVE',
    }],
  }],
  lifeStoryEvents: lifeEvents,
  botStoryEvents: botEvents,
  memories: [makeMemory('normal', 'normal'), makeMemory('sensitive', 'sensitive')],
  attachments,
}, {
  createdAt: now,
});

assert.equal(transfer.manifest.version, 2);
assert.equal(transfer.manifest.includesBinaryMedia, false);
assert.equal(transfer.manifest.includesPrivateStory, false);
assert.equal(transfer.manifest.includesSensitiveMemory, false);
assert.deepEqual(transfer.lifeStoryEvents.map(event => event.id), ['life-public']);
assert.deepEqual(transfer.memories.map(memory => memory.id), ['normal']);
assert.equal(transfer.attachments[0].availability, 'local-only');
assert.equal('opfsKey' in transfer.attachments[0], false);

const serialized = serializeRafiqTransferV2(transfer);
assert.doesNotMatch(serialized, /THIS-MUST-NOT-LEAVE/);
assert.doesNotMatch(serialized, /blob:local-object-url/);
assert.doesNotMatch(serialized, /attachment-a\.bin/);
assert.doesNotMatch(serialized, /DOCUMENT-DERIVED-TEXT-MUST-NOT-LEAVE/);
assert.doesNotMatch(serialized, /MESSAGE-EXTRACTED-TEXT-MUST-NOT-LEAVE/);
assert.doesNotMatch(serialized, /life-private/);
assert.doesNotMatch(serialized, /memory sensitive/);
assert.equal(parseRafiqTransferV2(serialized).manifest.version, 2);

const fullTextualTransfer = buildRafiqTransferV2({
  appVersion: '0.0.0-test',
  chats: [],
  messages: [],
  lifeStoryEvents: lifeEvents,
  botStoryEvents: botEvents,
  memories: [makeMemory('normal', 'normal'), makeMemory('private', 'private')],
  attachments,
}, {
  createdAt: now,
  includePrivateStory: true,
  includeSensitiveMemory: true,
  encrypted: true,
});
assert.equal(fullTextualTransfer.lifeStoryEvents.length, 2);
assert.equal(fullTextualTransfer.memories.length, 2);
assert.equal(fullTextualTransfer.manifest.encrypted, true);
assert.equal(fullTextualTransfer.manifest.includesBinaryMedia, false);

const tampered = structuredClone(transfer);
tampered.messages[0] = { id: 'tampered-message' };
assert.throws(
  () => validateRafiqTransferV2(tampered),
  /Checksum mismatch for transfer section messages/,
);

const wrongCount = structuredClone(transfer);
wrongCount.manifest.counts.messages = 99;
assert.throws(
  () => validateRafiqTransferV2(wrongCount),
  /Transfer count mismatch for messages/,
);

assert.throws(() => parseRafiqTransferV2('{invalid'), /not valid JSON/);
assert.equal(
  canonicalJson({ z: 1, a: { y: 2, x: now } }),
  canonicalJson({ a: { x: now.toISOString(), y: 2 }, z: 1 }),
  'canonical JSON must be stable across key order and Date serialization',
);

console.log('Transfer v2 tests passed.');
