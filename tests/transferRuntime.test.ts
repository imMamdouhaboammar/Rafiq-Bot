import assert from 'node:assert/strict';
import { MessageRole } from '../types.js';
import { buildRafiqTransferV2, serializeRafiqTransferV2 } from '../services/transferV2.js';
import {
  encryptTextualTransfer,
  serializeEncryptedTransfer,
} from '../services/encryptedTransfer.js';
import {
  decodeRuntimeTransfer,
  detectTransferFileKind,
} from '../services/transferRuntime.js';

const createdAt = new Date('2026-07-13T12:00:00.000Z');
const v2 = buildRafiqTransferV2({
  appVersion: 'test',
  chats: [{ id: 'chat-a' }],
  messages: [],
  lifeStoryEvents: [],
  botStoryEvents: [],
  memories: [],
  attachments: [],
}, { createdAt });

assert.equal(detectTransferFileKind(v2), 'v2');
assert.equal(detectTransferFileKind({ format: 'rafiq-transfer', version: 2 }), 'unknown');
assert.equal(detectTransferFileKind({ format: 'rafiq-encrypted-transfer', version: 1 }), 'encrypted');
assert.equal(detectTransferFileKind({ format: 'rafiq-chat-export', version: 1 }), 'legacy-v1');
assert.equal(detectTransferFileKind({ format: 'unknown' }), 'unknown');
assert.equal((await decodeRuntimeTransfer(serializeRafiqTransferV2(v2))).manifest.version, 2);

const passphrase = 'runtime transfer passphrase';
const encrypted = await encryptTextualTransfer(serializeRafiqTransferV2(v2), passphrase, {
  iterations: 100_000,
  createdAt,
  salt: new Uint8Array(16).fill(7),
  iv: new Uint8Array(12).fill(9),
});
const encryptedText = serializeEncryptedTransfer(encrypted);
assert.equal((await decodeRuntimeTransfer(encryptedText, { passphrase })).manifest.version, 2);
await assert.rejects(
  decodeRuntimeTransfer(encryptedText),
  /تحتاج كلمة مرور/,
);

const legacyText = JSON.stringify({
  format: 'rafiq-chat-export',
  version: 1,
  exportedAt: createdAt.toISOString(),
  bot: {
    botName: 'Legacy Bot',
    botGender: 'male',
    chattiness: 'balanced',
    fragmentedMessages: true,
    soulId: 'amira_default',
  },
  messages: [{
    id: 'legacy-message',
    chatId: 'legacy-chat',
    role: MessageRole.USER,
    text: 'hello',
    timestamp: createdAt.toISOString(),
  }],
  memorySeeds: [],
});
const legacyDecoded = await decodeRuntimeTransfer(legacyText, {
  appVersion: 'test',
  createdAt,
});
assert.equal(legacyDecoded.manifest.version, 2);
assert.equal(legacyDecoded.chats.length, 1);
assert.equal(legacyDecoded.messages.length, 1);

await assert.rejects(
  decodeRuntimeTransfer(JSON.stringify({ format: 'unknown', version: 99 })),
  /صيغة الملف غير مدعومة/,
);
await assert.rejects(
  decodeRuntimeTransfer('{invalid'),
  /ليس JSON صالحًا/,
);

console.log('Transfer runtime tests passed.');
