import assert from "node:assert/strict";
import { PersonalityEvolutionCoordinator } from "../services/personalityEvolution.js";
import { createAdaptivePersonalityState } from "../services/livingPersonaCore.js";
import { MessageRole, type ChatMessage, type ChatSession } from "../types.js";

const baseTime = new Date("2026-07-13T10:00:00.000Z");
const chat: ChatSession = {
  id: "bot-1",
  settings: {
    botName: "سلمى",
    botGender: "female",
    chattiness: "balanced",
    fragmentedMessages: true,
    soulId: "amira_default",
    adaptivePersonality: createAdaptivePersonalityState(),
  },
};

let messages: ChatMessage[] = Array.from({ length: 8 }, (_, index) => ({
  id: `user-${index + 1}`,
  chatId: chat.id,
  role: MessageRole.USER,
  text: index % 2 === 0 ? "اختصري وقولي الخلاصة" : "بحب الرد المباشر من غير لف",
  timestamp: new Date(baseTime.getTime() + index * 31 * 60 * 1000),
}));

let storedChat = structuredClone(chat);
let saveCount = 0;
let analysisCount = 0;
let updateCount = 0;
let now = new Date("2026-07-13T15:00:00.000Z");

const coordinator = new PersonalityEvolutionCoordinator({
  getChatSession: async () => structuredClone(storedChat),
  getMessagesForChat: async () => structuredClone(messages),
  commitAdaptivePersonality: async (_chatId, expectedVersion, nextState) => {
    if ((storedChat.settings.adaptivePersonality?.version || 1) !== expectedVersion) return undefined;
    saveCount += 1;
    storedChat = {
      ...storedChat,
      settings: { ...storedChat.settings, adaptivePersonality: structuredClone(nextState) },
    };
    return structuredClone(storedChat);
  },
  analyzeSignals: async input => {
    analysisCount += 1;
    assert.equal(input.messages.filter(item => item.role === "user").length, 8);
    const userIds = input.messages.filter(item => item.role === "user").map(item => item.id);
    return [{
      facet: "directness",
      direction: 1,
      strength: 3,
      confidence: 0.95,
      kind: "explicit_preference",
      evidenceMessageIds: userIds.slice(0, 3),
    }];
  },
  onUpdated: () => { updateCount += 1; },
  now: () => new Date(now),
});

const firstRun = await coordinator.runNow(chat.id);
assert.equal(firstRun.status, "updated");
assert.equal(saveCount, 1);
assert.equal(analysisCount, 1);
assert.equal(updateCount, 1);
assert.equal(storedChat.settings.adaptivePersonality?.processedMessageIds.length, 8);
assert.ok((storedChat.settings.adaptivePersonality?.facets.directness.offsetBps || 0) > 0);

now = new Date("2026-07-13T15:16:00.000Z");
const duplicateRun = await coordinator.runNow(chat.id);
assert.equal(duplicateRun.status, "not_enough_evidence");
assert.equal(saveCount, 1, "Already processed messages must not be saved twice");
assert.equal(analysisCount, 1, "Already processed messages must not be sent to the analyzer twice");

const firstSessionKey = storedChat.settings.adaptivePersonality?.currentSessionKey;
const lastInitialTimestamp = messages.at(-1)!.timestamp.getTime();
messages = messages.concat(Array.from({ length: 8 }, (_, index) => ({
  id: `followup-${index + 1}`,
  chatId: chat.id,
  role: MessageRole.USER,
  text: "كمل بنفس الأسلوب المباشر",
  timestamp: new Date(lastInitialTimestamp + (index + 1) * 5 * 60 * 1000),
})));
now = new Date("2026-07-13T15:32:00.000Z");
const overlappingWindowRun = await coordinator.runNow(chat.id);
assert.equal(overlappingWindowRun.status, "updated");
assert.equal(storedChat.settings.adaptivePersonality?.currentSessionKey, firstSessionKey, "Overlapping windows must preserve the active session key");
assert.equal(storedChat.settings.adaptivePersonality?.processedMessageIds.length, 16);

storedChat = { ...storedChat, isGroup: true };
const groupRun = await coordinator.runNow(chat.id);
assert.equal(groupRun.status, "unsupported_scope");

storedChat = {
  ...storedChat,
  isGroup: false,
  settings: {
    ...storedChat.settings,
    adaptivePersonality: {
      ...storedChat.settings.adaptivePersonality!,
      enabled: false,
      processedMessageIds: [],
    },
  },
};
const disabledRun = await coordinator.runNow(chat.id);
assert.equal(disabledRun.status, "disabled");

console.log("Personality evolution coordinator tests passed");
