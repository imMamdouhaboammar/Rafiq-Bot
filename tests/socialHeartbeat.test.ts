import assert from "node:assert/strict";
import {
  createContinuityFollowupTrigger,
  createCuriosityFollowupTrigger,
  evaluateSocialHeartbeat,
  generateEgyptianInactivityPrompt,
} from "../services/socialHeartbeat.js";
import { BotMood, type PsychologicalState } from "../types.js";
import type { ContinuityThread } from "../services/companionContinuity.js";

const baseState: PsychologicalState = {
  mood: BotMood.HAPPY,
  energyLevel: 7,
  socialMeter: 6,
  emotionalLedger: 20,
  currentScenario: "Standard Routine",
  intimacyLevel: 50,
};

const nightTime = new Date("2026-08-14T04:00:00Z");
const result1 = evaluateSocialHeartbeat({
  now: nightTime,
  timezone: "UTC",
  quietHoursStart: 2,
  quietHoursEnd: 9,
  lastMessageTimestamp: new Date(Date.now() - 48 * 3600 * 1000),
  psychologicalState: baseState,
});
assert.equal(result1.allowed, false);
assert.equal(result1.reason, "quiet_hours");

const dayTime = new Date("2026-08-14T14:00:00Z");
const trigger = createCuriosityFollowupTrigger(
  "chat-1",
  "bot-1",
  "ميتنج الشغل المهم",
  new Date("2026-08-14T13:00:00Z"),
  "كان قلقان من مقابلة المدير"
);

const result2 = evaluateSocialHeartbeat({
  now: dayTime,
  timezone: "UTC",
  quietHoursStart: 2,
  quietHoursEnd: 9,
  pendingTriggers: [trigger],
  psychologicalState: baseState,
});
assert.equal(result2.allowed, true);
assert.equal(result2.reason, "allowed_curiosity_followup");
assert.equal(result2.trigger?.topic, "ميتنج الشغل المهم");
assert.ok(result2.suggestedStarterPrompt?.includes("ميتنج الشغل المهم"));

const dayTime3 = new Date("2026-08-14T15:00:00Z");
const lastMsgTime = new Date("2026-08-12T10:00:00Z");
const result3 = evaluateSocialHeartbeat({
  now: dayTime3,
  timezone: "UTC",
  quietHoursStart: 2,
  quietHoursEnd: 9,
  lastMessageTimestamp: lastMsgTime,
  psychologicalState: baseState,
});
assert.equal(result3.allowed, true);
assert.equal(result3.reason, "allowed_inactivity_check");
assert.ok(result3.suggestedStarterPrompt);

const conflictState: PsychologicalState = {
  ...baseState,
  mood: BotMood.ANGRY,
  emotionalLedger: -50,
  breakpointState: "disappointed",
};
const result4 = evaluateSocialHeartbeat({
  now: dayTime3,
  timezone: "UTC",
  quietHoursStart: 2,
  quietHoursEnd: 9,
  lastMessageTimestamp: new Date("2026-08-12T10:00:00Z"),
  psychologicalState: conflictState,
});
assert.equal(result4.allowed, false);
assert.equal(result4.reason, "conflict_active");

const dueThread: ContinuityThread = {
  id: "thread:interview-result",
  kind: "outcome",
  summary: "نتيجة الانترفيو اللي كان مستنيها",
  sourceMessageIds: ["m-1"],
  salience: 0.95,
  status: "due",
  createdAt: "2026-08-13T12:00:00.000Z",
  updatedAt: "2026-08-14T12:00:00.000Z",
  dueAt: "2026-08-14T13:00:00.000Z",
};
const continuityTrigger = createContinuityFollowupTrigger(
  "chat-1",
  "bot-1",
  dueThread,
  dayTime,
);
const lowerPriorityCuriosity = createCuriosityFollowupTrigger(
  "chat-1",
  "bot-1",
  "موضوع عابر",
  new Date("2026-08-14T12:00:00Z"),
  "فضول بسيط",
);
const continuityFirst = evaluateSocialHeartbeat({
  now: dayTime,
  timezone: "UTC",
  quietHoursStart: 2,
  quietHoursEnd: 9,
  pendingTriggers: [lowerPriorityCuriosity, continuityTrigger],
  lastMessageTimestamp: lastMsgTime,
  psychologicalState: baseState,
});
assert.equal(continuityFirst.allowed, true);
assert.equal(continuityFirst.reason, "allowed_continuity_followup");
assert.equal(continuityFirst.trigger?.id, continuityTrigger.id);
assert.ok(continuityFirst.suggestedStarterPrompt?.includes(dueThread.summary));

const intimateInactivity = generateEgyptianInactivityPrompt("رفيق", 72, 90);
assert.equal(intimateInactivity.includes("وحشتني"), false);
assert.equal(intimateInactivity.includes("لما تفضى"), true);

console.log("Social Heartbeat tests passed successfully!");
