import type { ChatMessage } from '../types.js';

export interface ChatBubbleComparableProps {
  message: ChatMessage;
  senderName?: string;
  senderAvatar?: string;
  isGroup?: boolean;
  isUser: boolean;
  onReply: (message: ChatMessage) => void;
  onDelete?: (message: ChatMessage) => void;
}

const attachmentFingerprint = (message: ChatMessage): string => (
  (message.attachments || []).map(attachment => [
    attachment.fileName || '',
    attachment.mimeType,
    attachment.fileSize ?? '',
    attachment.previewUrl,
    attachment.category || '',
  ].join(':')).join('|')
);

const reactionFingerprint = (message: ChatMessage): string => (
  (message.reactions || []).map(reaction => (
    `${reaction.senderId}:${reaction.senderName}:${reaction.emoji}`
  )).join('|')
);

const groundingFingerprint = (message: ChatMessage): string => (
  (message.groundingUrls || []).map(url => `${url.title}:${url.uri}`).join('|')
);

const replyFingerprint = (message: ChatMessage): string => {
  const reply = message.replyTo;
  return reply
    ? `${reply.id}:${reply.senderId}:${reply.senderName}:${reply.text}`
    : '';
};

const toolFingerprint = (message: ChatMessage): string => (
  JSON.stringify(message.toolsUsed || [])
);

const timestampValue = (message: ChatMessage): number => {
  const value = new Date(message.timestamp).getTime();
  return Number.isFinite(value) ? value : 0;
};

export const areChatBubblePropsEqual = (
  previous: ChatBubbleComparableProps,
  next: ChatBubbleComparableProps,
): boolean => (
  previous.message.id === next.message.id &&
  previous.message.text === next.message.text &&
  timestampValue(previous.message) === timestampValue(next.message) &&
  previous.message.isThinking === next.message.isThinking &&
  previous.message.isError === next.message.isError &&
  previous.message.deletedForMe === next.message.deletedForMe &&
  attachmentFingerprint(previous.message) === attachmentFingerprint(next.message) &&
  reactionFingerprint(previous.message) === reactionFingerprint(next.message) &&
  replyFingerprint(previous.message) === replyFingerprint(next.message) &&
  groundingFingerprint(previous.message) === groundingFingerprint(next.message) &&
  toolFingerprint(previous.message) === toolFingerprint(next.message) &&
  previous.senderName === next.senderName &&
  previous.senderAvatar === next.senderAvatar &&
  previous.isGroup === next.isGroup &&
  previous.isUser === next.isUser &&
  previous.onReply === next.onReply &&
  previous.onDelete === next.onDelete
);
