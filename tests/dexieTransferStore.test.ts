import assert from 'node:assert/strict';
import { splitTransferMessages } from '../services/dexieTransferStore.js';
import { MessageRole, type ChatMessage, type ChatSession } from '../types.js';

const chats: ChatSession[] = [
  {
    id: 'bot-a',
    settings: {
      botName: 'Bot A',
      botGender: 'male',
      chattiness: 'balanced',
      fragmentedMessages: true,
      soulId: 'amira_default',
    },
  },
  {
    id: 'group-a',
    isGroup: true,
    groupName: 'Group A',
    memberIds: ['bot-a', 'bot-b'],
    settings: {
      botName: 'Group A',
      botGender: 'female',
      chattiness: 'balanced',
      fragmentedMessages: true,
      soulId: 'amira_default',
    },
  },
];
const messages: ChatMessage[] = [
  {
    id: 'direct-message',
    chatId: 'bot-a',
    role: MessageRole.USER,
    text: 'Direct',
    timestamp: new Date('2026-07-13T12:00:00.000Z'),
  },
  {
    id: 'group-message',
    chatId: 'group-a',
    role: MessageRole.MODEL,
    senderId: 'bot-a',
    text: 'Group',
    timestamp: new Date('2026-07-13T12:01:00.000Z'),
  },
  {
    id: 'orphan-direct-message',
    chatId: 'missing-chat',
    role: MessageRole.USER,
    text: 'Orphan remains in direct table for later reconciliation.',
    timestamp: new Date('2026-07-13T12:02:00.000Z'),
  },
];

const split = splitTransferMessages(messages, chats);
assert.deepEqual(split.groups.map(message => message.id), ['group-message']);
assert.deepEqual(split.direct.map(message => message.id), [
  'direct-message',
  'orphan-direct-message',
]);

console.log('Dexie transfer store tests passed.');
