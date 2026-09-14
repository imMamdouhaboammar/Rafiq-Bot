import assert from 'node:assert/strict';
import { MessageRole } from '../types.js';
import {
  adaptLegacyRafiqV1,
  parseLegacyRafiqV1Text,
} from '../services/legacyTransferAdapter.js';
import { validateRafiqTransferV2 } from '../services/transferV2.js';

let counter = 0;
const createId = () => `generated-${++counter}`;
const legacy = {
  format: 'rafiq-chat-export',
  version: 1,
  exportedAt: '2026-06-01T12:00:00.000Z',
  bot: {
    botName: 'سارة',
    botGender: 'female',
    botBio: 'زميلة عملية.',
    chattiness: 'balanced',
    fragmentedMessages: true,
    soulId: 'amira_default',
  },
  messages: [
    {
      id: 'old-message-1',
      chatId: 'old-chat',
      role: MessageRole.USER,
      text: 'أهلا',
      timestamp: '2026-06-01T12:00:00.000Z',
    },
    {
      id: 'old-message-2',
      chatId: 'old-chat',
      role: MessageRole.MODEL,
      text: 'أهلا بيك',
      timestamp: '2026-06-01T12:01:00.000Z',
      rootMessageId: 'old-message-1',
      replyToMessageId: 'old-message-1',
      attachments: [{
        mimeType: 'image/png',
        previewUrl: 'data:image/png;base64,legacy',
        base64: 'legacy',
        fileName: 'legacy.png',
      }],
    },
  ],
  memorySeeds: [
    {
      role: 'user',
      text: 'المستخدم يفضل الاجتماعات الصباحية',
      category: 'preference',
      timestamp: '2026-06-01T12:00:00.000Z',
    },
    {
      role: 'model',
      text: 'تفصيل قديم غير مصنف',
      category: 'legacy-custom',
    },
  ],
};

const transfer = adaptLegacyRafiqV1(legacy, {
  appVersion: '0.0.0-test',
  createId,
  createdAt: new Date('2026-07-13T12:00:00.000Z'),
});
validateRafiqTransferV2(transfer);

const chat = transfer.chats[0] as any;
assert.equal(chat.id, 'generated-1');
assert.equal(chat.settings.botName, 'سارة');
assert.equal(transfer.messages.length, 2);
assert.equal((transfer.messages[0] as any).chatId, 'generated-1');
assert.equal((transfer.messages[0] as any).id, 'generated-2');
assert.equal((transfer.messages[1] as any).id, 'generated-3');
assert.equal((transfer.messages[1] as any).rootMessageId, 'generated-2');
assert.equal((transfer.messages[1] as any).replyToMessageId, 'generated-2');
assert.equal((transfer.messages[1] as any).attachments[0].base64, undefined);
assert.equal((transfer.messages[1] as any).attachments[0].previewUrl, '');

assert.equal(transfer.memories.length, 2);
assert.equal(transfer.memories[0].scope, 'chat');
assert.equal(transfer.memories[0].scopeId, 'generated-1');
assert.equal(transfer.memories[0].category, 'preference');
assert.equal(transfer.memories[0].confidence, 0.7);
assert.equal(transfer.memories[1].category, 'general');
assert.equal(transfer.memories[1].confidence, 0.5);
assert.equal(transfer.manifest.version, 2);
assert.equal(transfer.manifest.includesBinaryMedia, false);

counter = 0;
const parsed = parseLegacyRafiqV1Text(JSON.stringify(legacy), {
  appVersion: '0.0.0-test',
  createId,
  createdAt: new Date('2026-07-13T12:00:00.000Z'),
});
assert.equal(parsed.manifest.version, 2);
assert.throws(
  () => parseLegacyRafiqV1Text('{invalid', { appVersion: 'test' }),
  /not valid JSON/,
);
assert.throws(
  () => adaptLegacyRafiqV1({ format: 'wrong' }, { appVersion: 'test' }),
  /Legacy v1 validation failed/,
);

console.log('Legacy transfer adapter tests passed.');
