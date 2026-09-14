import assert from "node:assert/strict";
import { createContinuityCoordinator } from "../services/continuityCoordinator.js";
import {
  applyContinuityProposal,
  createInitialContinuityState,
} from "../services/companionContinuity.js";
import {
  ChatMessageSchema,
  ChatSessionSchema,
  MessageRole,
} from "../types.js";

const fixedNow = new Date("2026-09-13T12:00:00Z");
const evidence = { messageIds: ["u-1", "b-1"] };

const dueSeed = applyContinuityProposal(
  createInitialContinuityState(new Date("2026-09-12T12:00:00Z")),
  {
    type: "thread_upsert",
    kind: "outcome",
    summary: "نتيجة الانترفيو اللي كان مستنيها",
    sourceMessageIds: ["u-1"],
    salience: 0.95,
    dueAt: "2026-09-13T11:00:00.000Z",
  },
  evidence,
  new Date("2026-09-12T13:00:00Z"),
);

const privateChat = ChatSessionSchema.parse({
  id: "chat-1",
  settings: { botName: "رفيق", botGender: "male" },
  psychology: {},
  continuityState: dueSeed,
});

const savedChats: typeof privateChat[] = [];
let reflectionCalls = 0;
const coordinator = createContinuityCoordinator({
  now: () => fixedNow,
  saveChat: async chat => {
    savedChats.push(chat);
  },
  reflect: async () => {
    reflectionCalls += 1;
    return { continuityProposals: [] };
  },
});

const resumed = await coordinator.onSessionResume({ chat: privateChat });
assert.equal(resumed.changed, true);
assert.equal(resumed.chat.continuityState?.threads[0]?.status, "due");
assert.equal(resumed.proactiveTriggers.length, 1);
assert.equal(resumed.proactiveTriggers[0]?.type, "continuity_followup");
assert.ok(resumed.context.some(item => item.text.includes("الانترفيو")));
assert.equal(savedChats.length, 1);

const groupChat = ChatSessionSchema.parse({
  id: "group-1",
  isGroup: true,
  groupName: "الصحاب",
  memberIds: ["chat-1"],
  settings: { botName: "جروب", botGender: "male" },
  continuityState: dueSeed,
});
const groupResume = await coordinator.onSessionResume({ chat: groupChat });
assert.equal(groupResume.changed, false);
assert.deepEqual(groupResume.context, []);
assert.deepEqual(groupResume.proactiveTriggers, []);
assert.equal(savedChats.length, 1);

const conversationChat = ChatSessionSchema.parse({
  id: "chat-2",
  settings: { botName: "رفيق", botGender: "male" },
  psychology: {},
});
const messages = [
  ChatMessageSchema.parse({
    id: "u-1",
    chatId: "chat-2",
    role: MessageRole.USER,
    text: "عندي انترفيو بكرة ومستني النتيجة بعده",
    timestamp: new Date("2026-09-13T11:55:00Z"),
  }),
  ChatMessageSchema.parse({
    id: "b-1",
    chatId: "chat-2",
    role: MessageRole.MODEL,
    text: "تمام ابقى طمني عملت ايه",
    timestamp: new Date("2026-09-13T11:56:00Z"),
  }),
];

let capturedReflectionInput: unknown;
const conversationSaves: typeof conversationChat[] = [];
const conversationCoordinator = createContinuityCoordinator({
  now: () => fixedNow,
  saveChat: async chat => {
    conversationSaves.push(chat);
  },
  reflect: async input => {
    reflectionCalls += 1;
    capturedReflectionInput = input;
    return {
      continuityProposals: [{
        type: "thread_upsert",
        kind: "outcome",
        summary: "نتيجة الانترفيو لسه معلقة",
        sourceMessageIds: ["u-1"],
        salience: 0.9,
        dueAt: "2026-09-14T12:00:00.000Z",
      }],
    };
  },
});

const settled = await conversationCoordinator.onConversationSettled({
  chat: conversationChat,
  messages,
});
assert.equal(reflectionCalls, 1);
assert.equal(settled.chat.continuityState?.threads.length, 1);
assert.equal(settled.chat.continuityState?.threads[0]?.summary, "نتيجة الانترفيو لسه معلقة");
assert.equal(conversationSaves.length, 1);
assert.deepEqual(
  Reflect.get(capturedReflectionInput as object, "messages"),
  messages.map(message => ({
    id: message.id,
    chatId: message.chatId,
    role: message.role,
    text: message.text,
    timestamp: message.timestamp,
  })),
);

const settledAgain = await conversationCoordinator.onConversationSettled({
  chat: settled.chat,
  messages,
});
assert.equal(reflectionCalls, 1);
assert.equal(settledAgain.changed, false);

const groupSettled = await conversationCoordinator.onConversationSettled({
  chat: groupChat,
  messages: messages.map(message => ({ ...message, chatId: groupChat.id })),
});
assert.equal(groupSettled.changed, false);
assert.equal(reflectionCalls, 1);

console.log("Continuity coordinator orchestration tests passed successfully!");
