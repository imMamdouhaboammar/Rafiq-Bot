import assert from "node:assert/strict";
import { collectLatestUserBurst } from "../services/messageBurst.js";
import { classifyConversationRoute } from "../services/conversationRouter.js";
import { MessageRole, type ChatMessage } from "../types.js";

const makeMessage = (
  id: string,
  role: MessageRole,
  text: string,
  timestamp: string
): ChatMessage => ({
  id,
  chatId: "chat-a",
  role,
  text,
  timestamp: new Date(timestamp),
});

const messages: ChatMessage[] = [
  makeMessage("m1", MessageRole.USER, "ازيك", "2026-01-01T10:00:00.000Z"),
  makeMessage("m2", MessageRole.MODEL, "الحمد لله، كله فل", "2026-01-01T10:00:04.000Z"),
  makeMessage("m3", MessageRole.USER, "كله حلو", "2026-01-01T10:00:07.000Z"),
  makeMessage("m4", MessageRole.USER, "منين", "2026-01-01T10:00:10.000Z"),
];

const burst = collectLatestUserBurst(messages);

assert.deepEqual(burst.historyMessages.map(message => message.id), ["m1", "m2"]);
assert.deepEqual(burst.burstMessages.map(message => message.id), ["m3", "m4"]);
assert.match(burst.combinedText, /Understand them together/);
assert.match(burst.combinedText, /1\. كله حلو/);
assert.match(burst.combinedText, /2\. منين/);

const separatedMessages: ChatMessage[] = [
  makeMessage("m1", MessageRole.USER, "كله حلو", "2026-01-01T10:00:00.000Z"),
  makeMessage("m2", MessageRole.USER, "منين", "2026-01-01T10:03:00.000Z"),
];

const separatedBurst = collectLatestUserBurst(separatedMessages);
assert.deepEqual(separatedBurst.historyMessages.map(message => message.id), ["m1"]);
assert.deepEqual(separatedBurst.burstMessages.map(message => message.id), ["m2"]);
assert.equal(separatedBurst.combinedText, "منين");

const showerBurst = collectLatestUserBurst([
  makeMessage("m1", MessageRole.MODEL, "أنت عامل إيه؟", "2026-01-01T10:00:00.000Z"),
  makeMessage("m2", MessageRole.USER, "باخد شاور", "2026-01-01T10:00:04.000Z"),
  makeMessage("m3", MessageRole.USER, "؟", "2026-01-01T10:00:07.000Z"),
]);
const showerConversationText = showerBurst.burstMessages.map(message => message.text).join("\n");
assert.equal(
  classifyConversationRoute(showerConversationText).id,
  "direct-question",
  "A trailing question-mark nudge must not erase the substantive message before it",
);

console.log("message burst tests passed");
