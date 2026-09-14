import assert from "node:assert/strict";
import { calculateEmotionalDecay } from "../services/dynamicEngines.js";
import { validateContinuityProposals } from "../services/continuityProposalValidation.js";
import { BotMood, type PsychologicalState } from "../types.js";

const baseAngryState: PsychologicalState = {
  mood: BotMood.ANGRY,
  energyLevel: 3,
  socialMeter: 4,
  emotionalLedger: -60,
  currentScenario: "Conflict",
  intimacyLevel: 40,
  lastInteractionTime: new Date(Date.now() - 6 * 3600 * 1000),
  breakpointState: "disappointed",
};

const decayed = calculateEmotionalDecay(baseAngryState, new Date());
assert.equal(decayed.mood, BotMood.NEUTRAL);

const oldDisappointedState: PsychologicalState = {
  ...baseAngryState,
  lastInteractionTime: new Date(Date.now() - 25 * 3600 * 1000),
};
const decayed2 = calculateEmotionalDecay(oldDisappointedState, new Date());
assert.equal(decayed2.breakpointState, "none");
assert.ok(decayed.emotionalLedger > -60);

const exhaustedState: PsychologicalState = {
  ...baseAngryState,
  energyLevel: 2,
  lastInteractionTime: new Date(Date.now() - 10 * 3600 * 1000),
};
const decayed3 = calculateEmotionalDecay(exhaustedState, new Date());
assert.ok(decayed3.energyLevel > 2);

const validProposals = validateContinuityProposals([
  {
    type: "thread_upsert",
    kind: "outcome",
    summary: "نتيجة مقابلة الشغل لسه معلقة",
    sourceMessageIds: ["m-1"],
    salience: 0.9,
    dueAt: "2026-09-14T09:00:00.000Z",
  },
  {
    type: "opinion_upsert",
    topic: "الفيلم",
    stance: "حلو بس طويل زيادة",
    confidence: 0.7,
    sourceMessageIds: ["m-1", "m-2"],
  },
], ["m-1", "m-2"]);
assert.equal(validProposals.length, 2);
assert.equal(validProposals[0]?.type, "thread_upsert");

const unknownEvidence = validateContinuityProposals([
  {
    type: "thread_upsert",
    kind: "follow_up",
    summary: "متابعة من مصدر مش موجود",
    sourceMessageIds: ["unknown"],
    salience: 0.8,
  },
], ["m-1"]);
assert.deepEqual(unknownEvidence, []);

const fabricatedEvent = validateContinuityProposals([
  {
    type: "fake_work_event",
    summary: "رفيق اتخانق مع مديره النهاردة",
    sourceMessageIds: ["m-1"],
    salience: 1,
  },
], ["m-1"]);
assert.deepEqual(fabricatedEvent, []);

const weakRitual = validateContinuityProposals([
  {
    type: "ritual_upsert",
    key: "thursday-checkin",
    description: "نتكلم كل خميس بعد الشغل",
    sourceMessageIds: ["m-1"],
  },
], ["m-1"]);
assert.deepEqual(weakRitual, []);

const malformed = validateContinuityProposals("not-an-array", ["m-1"]);
assert.deepEqual(malformed, []);

console.log("Reflection Engine tests passed successfully!");
