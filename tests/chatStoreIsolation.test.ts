import assert from "node:assert/strict";
import { useRafiqStore } from "../stores/useRafiqStore.js";
import { MessageRole, type ChatMessage } from "../types.js";

const makeMessage = (chatId: string, id: string, text: string): ChatMessage => ({
  id,
  chatId,
  role: MessageRole.USER,
  text,
  timestamp: new Date("2026-01-01T00:00:00.000Z"),
});

useRafiqStore.setState({
  userProfile: null,
  chats: [],
  activeChatId: null,
  messagesByChat: {},
  typingByChat: {},
});

const chatAMessage = makeMessage("chat-a", "msg-a", "hello from a");
const chatBMessage = makeMessage("chat-b", "msg-b", "hello from b");

useRafiqStore.getState().setMessages("chat-a", [chatAMessage]);
useRafiqStore.getState().addMessage(chatBMessage);
useRafiqStore.getState().setChatTyping("chat-a", true);
useRafiqStore.getState().setChatTyping("chat-b", false);

const state = useRafiqStore.getState();

assert.deepEqual(state.messagesByChat["chat-a"], [chatAMessage]);
assert.deepEqual(state.messagesByChat["chat-b"], [chatBMessage]);
assert.equal(state.messagesByChat["chat-a"]?.some(message => message.chatId === "chat-b"), false);
assert.equal(state.typingByChat["chat-a"], true);
assert.equal(state.typingByChat["chat-b"], false);

useRafiqStore.getState().removeChat("chat-a");
const afterRemove = useRafiqStore.getState();

assert.equal(afterRemove.messagesByChat["chat-a"], undefined);
assert.equal(afterRemove.typingByChat["chat-a"], undefined);
assert.deepEqual(afterRemove.messagesByChat["chat-b"], [chatBMessage]);

console.log("chat store isolation tests passed");
