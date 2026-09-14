import assert from 'node:assert/strict';
import { areChatBubblePropsEqual } from '../services/chatBubbleComparator.js';
import { MessageRole, type ChatMessage } from '../types.js';

const onReply = () => undefined;
const onDelete = () => undefined;
const baseMessage: ChatMessage = {
  id: 'message-1',
  chatId: 'chat-1',
  role: MessageRole.MODEL,
  text: 'نفس النص',
  timestamp: new Date('2026-07-13T12:00:00.000Z'),
};
const baseProps = {
  message: baseMessage,
  senderName: 'رفيق',
  senderAvatar: 'avatar-a',
  isGroup: false,
  isUser: false,
  onReply,
  onDelete,
};

assert.equal(areChatBubblePropsEqual(baseProps, { ...baseProps }), true);
assert.equal(areChatBubblePropsEqual(baseProps, {
  ...baseProps,
  message: {
    ...baseMessage,
    reactions: [{ emoji: '❤️', senderId: 'user', senderName: 'Mamdouh' }],
  },
}), false, 'reaction changes must rerender the bubble');

assert.equal(areChatBubblePropsEqual(baseProps, {
  ...baseProps,
  message: {
    ...baseMessage,
    replyTo: { id: 'reply-1', text: 'تفصيل جديد', senderName: 'Mamdouh', senderId: 'user' },
  },
}), false, 'reply changes must rerender the bubble');

assert.equal(areChatBubblePropsEqual(baseProps, {
  ...baseProps,
  message: {
    ...baseMessage,
    attachments: [{
      mimeType: 'image/png',
      previewUrl: 'data:image/png;base64,new-image',
      fileName: 'image.png',
      fileSize: 10,
      category: 'image',
    }],
  },
}), false, 'attachment content changes must rerender the bubble');

assert.equal(areChatBubblePropsEqual(baseProps, {
  ...baseProps,
  senderAvatar: 'avatar-b',
}), false, 'sender presentation changes must rerender the bubble');

console.log('Chat bubble comparator tests passed.');
