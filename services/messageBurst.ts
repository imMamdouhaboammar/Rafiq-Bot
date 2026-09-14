import { ChatMessage, MessageRole } from "../types.js";

const DEFAULT_BURST_WINDOW_MS = 90_000;

export interface LatestUserBurst {
  historyMessages: ChatMessage[];
  burstMessages: ChatMessage[];
  latestMessage?: ChatMessage;
  combinedText: string;
}

const asTime = (value: Date | string | number): number => new Date(value).getTime();

export const collectLatestUserBurst = (
  messages: ChatMessage[],
  burstWindowMs = DEFAULT_BURST_WINDOW_MS
): LatestUserBurst => {
  const latestMessage = messages[messages.length - 1];

  if (!latestMessage || latestMessage.role !== MessageRole.USER) {
    return {
      historyMessages: messages,
      burstMessages: [],
      latestMessage,
      combinedText: latestMessage?.text || "",
    };
  }

  const latestTime = asTime(latestMessage.timestamp);
  let startIndex = messages.length - 1;

  for (let index = messages.length - 2; index >= 0; index -= 1) {
    const message = messages[index];
    const isSameBurst =
      message.role === MessageRole.USER &&
      message.chatId === latestMessage.chatId &&
      latestTime - asTime(message.timestamp) <= burstWindowMs;

    if (!isSameBurst) break;
    startIndex = index;
  }

  const historyMessages = messages.slice(0, startIndex);
  const burstMessages = messages.slice(startIndex);
  const combinedText = burstMessages
    .map((message, index) => `${index + 1}. ${message.text || "[attachment]"}`)
    .join("\n");

  return {
    historyMessages,
    burstMessages,
    latestMessage,
    combinedText:
      burstMessages.length > 1
        ? `The user sent these consecutive messages as one thought. Understand them together before replying:\n${combinedText}`
        : latestMessage.text,
  };
};
