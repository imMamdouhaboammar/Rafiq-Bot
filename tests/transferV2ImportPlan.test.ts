import assert from 'node:assert/strict';
import type {
  AttachmentRecord,
  BotStoryEvent,
  LifeStoryEvent,
  MemoryRecord,
} from '../contracts/rafiqV6.js';
import { buildRafiqTransferV2 } from '../services/transferV2.js';
import { prepareTransferV2Import } from '../services/transferV2ImportPlan.js';

const now = new Date('2026-07-13T12:00:00.000Z');
const lifeEvents: LifeStoryEvent[] = [
  {
    id: 'life-duplicate',
    userId: 'main_user',
    title: 'حدث للبوت المستورد',
    summary: 'يجب إعادة تعيين صلاحية البوت.',
    happenedAt: now,
    createdAt: now,
    updatedAt: now,
    acl: { visibility: 'selected_bots', botIds: ['bot-a'] },
    sensitivity: 'normal',
    source: 'user_entered',
  },
  {
    id: 'life-missing',
    userId: 'main_user',
    title: 'حدث لبوت مفقود',
    summary: 'يجب أن يتحول إلى خاص.',
    happenedAt: now,
    createdAt: now,
    updatedAt: now,
    acl: { visibility: 'selected_bots', botIds: ['missing-bot'] },
    sensitivity: 'normal',
    source: 'user_entered',
  },
];
const botEvents: BotStoryEvent[] = [{
  id: 'bot-story-duplicate',
  botId: 'bot-a',
  title: 'قرار مرصود',
  summary: 'قرار داخل المجموعة.',
  kind: 'observed',
  sourceMessageIds: ['message-duplicate'],
  sourceGroupId: 'group-a',
  confidence: 0.9,
  status: 'active',
  acl: { visibility: 'selected_bots', botIds: ['bot-a'] },
  createdAt: now,
  updatedAt: now,
}];
const memories: MemoryRecord[] = [{
  id: 'memory-duplicate',
  ownerUserId: 'main_user',
  scope: 'bot',
  scopeId: 'bot-a',
  text: 'ذاكرة مرتبطة بالبوت.',
  summary: 'ذاكرة بوت',
  category: 'fact',
  provenance: {
    kind: 'user_message',
    sourceIds: ['message-duplicate'],
    observedAt: now,
  },
  confidence: 0.9,
  salience: 0.8,
  sensitivity: 'normal',
  retention: 'durable',
  status: 'active',
  createdAt: now,
  updatedAt: now,
}];
const attachments: AttachmentRecord[] = [{
  id: 'attachment-duplicate',
  chatId: 'group-a',
  messageId: 'message-duplicate',
  fileName: 'video.mp4',
  mimeType: 'video/mp4',
  sizeBytes: 500,
  sha256: 'a'.repeat(64),
  opfsKey: 'local-video.bin',
  availability: 'available',
  processingProgress: 1,
  createdAt: now,
  updatedAt: now,
}];

const transfer = buildRafiqTransferV2({
  appVersion: 'test',
  chats: [
    {
      id: 'bot-a',
      isGroup: false,
      settings: { botName: 'Bot A' },
    },
    {
      id: 'group-a',
      isGroup: true,
      memberIds: ['bot-a', 'existing-bot', 'missing-bot'],
      settings: { botName: 'Group A' },
    },
    {
      id: 'group-degraded',
      isGroup: true,
      memberIds: ['missing-one', 'missing-two'],
      settings: { botName: 'Broken Group' },
    },
  ],
  messages: [{
    id: 'message-duplicate',
    chatId: 'group-a',
    senderId: 'bot-a',
    rootMessageId: 'message-duplicate',
    replyToMessageId: 'message-duplicate',
    replyTo: {
      id: 'message-duplicate',
      senderId: 'bot-a',
      text: 'old',
      senderName: 'Bot A',
    },
    text: 'رسالة',
    attachments: [{
      id: 'attachment-duplicate',
      base64: 'must-disappear',
      previewUrl: 'blob:local',
    }],
  }],
  lifeStoryEvents: lifeEvents,
  botStoryEvents: botEvents,
  memories,
  attachments,
}, { createdAt: now });

const generatedIds: string[] = [];
const prepared = prepareTransferV2Import(transfer, {
  chatIds: ['bot-a', 'existing-bot'],
  messageIds: ['message-duplicate'],
  lifeStoryEventIds: ['life-duplicate'],
  botStoryEventIds: ['bot-story-duplicate'],
  memoryIds: ['memory-duplicate'],
  attachmentIds: ['attachment-duplicate'],
}, {
  createId: (prefix, oldId) => {
    const value = `${prefix}-remapped-${oldId}`;
    generatedIds.push(value);
    return value;
  },
});

const remappedBotId = prepared.idMaps.chats.get('bot-a')!;
const remappedMessageId = prepared.idMaps.messages.get('message-duplicate')!;
const remappedGroup = prepared.transfer.chats.find((chat: any) => chat.id === 'group-a') as any;
assert.notEqual(remappedBotId, 'bot-a');
assert.deepEqual(remappedGroup.memberIds, [remappedBotId, 'existing-bot']);
assert.deepEqual(prepared.missingBotIds.sort(), ['missing-bot', 'missing-one', 'missing-two']);

const degraded = prepared.transfer.chats.find((chat: any) => chat.id === 'group-degraded') as any;
assert.equal(degraded.importState, 'degraded_missing_members');
assert.deepEqual(degraded.memberIds, []);
assert.deepEqual(prepared.degradedGroupIds, ['group-degraded']);
assert.ok(prepared.warnings.some(warning => warning.includes('fewer than two')));

const message = prepared.transfer.messages[0] as any;
assert.equal(message.id, remappedMessageId);
assert.equal(message.chatId, 'group-a');
assert.equal(message.senderId, remappedBotId);
assert.equal(message.rootMessageId, remappedMessageId);
assert.equal(message.replyToMessageId, remappedMessageId);
assert.equal(message.replyTo.id, remappedMessageId);
assert.equal(message.replyTo.senderId, remappedBotId);
assert.equal(message.attachments[0].id, prepared.idMaps.attachments.get('attachment-duplicate'));
assert.equal(message.attachments[0].availability, 'missing');
assert.equal(message.attachments[0].previewUrl, '');
assert.equal('base64' in message.attachments[0], false);

const importedLife = prepared.transfer.lifeStoryEvents.find(event => event.title === 'حدث للبوت المستورد')!;
assert.deepEqual(importedLife.acl, { visibility: 'selected_bots', botIds: [remappedBotId] });
const missingLife = prepared.transfer.lifeStoryEvents.find(event => event.title === 'حدث لبوت مفقود')!;
assert.deepEqual(missingLife.acl, { visibility: 'private', botIds: [] });
assert.ok(prepared.warnings.some(warning => warning.includes('changed to private')));

const importedBotStory = prepared.transfer.botStoryEvents[0];
assert.equal(importedBotStory.botId, remappedBotId);
assert.deepEqual(importedBotStory.sourceMessageIds, [remappedMessageId]);
assert.equal(importedBotStory.sourceGroupId, 'group-a');
assert.deepEqual(importedBotStory.acl.botIds, [remappedBotId]);

const importedMemory = prepared.transfer.memories[0];
assert.equal(importedMemory.scopeId, remappedBotId);
assert.deepEqual(importedMemory.provenance.sourceIds, [remappedMessageId]);
assert.notEqual(importedMemory.id, 'memory-duplicate');

const importedAttachment = prepared.transfer.attachments[0];
assert.notEqual(importedAttachment.id, 'attachment-duplicate');
assert.equal(importedAttachment.chatId, 'group-a');
assert.equal(importedAttachment.messageId, remappedMessageId);
assert.equal(importedAttachment.availability, 'missing');
assert.equal(importedAttachment.opfsKey, undefined);
assert.ok(generatedIds.length >= 6);

console.log('Transfer v2 import planning tests passed.');
