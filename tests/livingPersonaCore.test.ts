import assert from "node:assert/strict";
import type { BotSettings } from "../types.js";
import {
  applyAdaptivePersonalityMutation,
  compileAdaptivePersonalityInstruction,
  createAdaptivePersonalityState,
  reduceAdaptivePersonality,
  resolveLivingPersona,
  type PersonalitySignalProposal,
} from "../services/livingPersonaCore.js";
import { compilePersona } from "../services/personaRuntimeCache.js";
import { getBudgetedSystemInstruction } from "../services/personaEngine.js";

const message = (id: string, sessionKey: string) => ({
  id,
  sessionKey,
  timestamp: new Date("2026-07-13T10:00:00.000Z"),
});

const signal = (
  messageId: string,
  sessionKey: string,
  overrides: Partial<PersonalitySignalProposal> = {},
): PersonalitySignalProposal => ({
  facet: "directness",
  direction: 1,
  strength: 3,
  confidence: 0.9,
  kind: "repeated_pattern",
  evidenceMessageIds: [messageId],
  ...overrides,
});

const initial = createAdaptivePersonalityState();

const oneObservation = reduceAdaptivePersonality(initial, [signal("m1", "s1")], {
  batchId: "batch-1",
  now: new Date("2026-07-13T10:01:00.000Z"),
  messages: [message("m1", "s1")],
});
assert.equal(oneObservation.next.facets.directness.offsetBps, 0, "One inferred pattern must not rewrite personality");

const enoughEvidence = reduceAdaptivePersonality(oneObservation.next, [
  signal("m2", "s1"),
  signal("m3", "s2"),
], {
  batchId: "batch-2",
  now: new Date("2026-07-14T10:01:00.000Z"),
  messages: [message("m2", "s1"), message("m3", "s2")],
});
assert.equal(enoughEvidence.next.facets.directness.offsetBps, 100, "Consistent evidence across sessions moves only one point per batch");
assert.ok(enoughEvidence.next.facets.directness.confidenceBps >= 7000);

const duplicateBatch = reduceAdaptivePersonality(enoughEvidence.next, [signal("m3", "s2")], {
  batchId: "batch-2",
  now: new Date("2026-07-14T10:02:00.000Z"),
  messages: [message("m3", "s2")],
});
assert.deepEqual(duplicateBatch.next, enoughEvidence.next, "Retrying the same batch must be a no-op");

const unrelatedBatch = reduceAdaptivePersonality(enoughEvidence.next, [], {
  batchId: "batch-unrelated",
  now: new Date("2026-07-14T10:03:00.000Z"),
  messages: [message("unrelated-1", "s2")],
});
assert.equal(unrelatedBatch.next.facets.directness.offsetBps, 100, "Old evidence must not be applied again in a new batch");

const contradicted = reduceAdaptivePersonality(enoughEvidence.next, [
  signal("m4", "s3", { direction: -1 }),
  signal("m5", "s3", { direction: -1 }),
  signal("m6", "s4", { direction: -1 }),
], {
  batchId: "batch-3",
  now: new Date("2026-07-14T11:01:00.000Z"),
  messages: [message("m4", "s3"), message("m5", "s3"), message("m6", "s4")],
});
assert.equal(contradicted.next.facets.directness.offsetBps, 100, "Contradictory evidence must freeze rather than oscillate");

const majorityButContradicted = reduceAdaptivePersonality(createAdaptivePersonalityState(), [
  signal("majority-1", "majority-s1"),
  signal("majority-2", "majority-s1"),
  signal("majority-3", "majority-s2"),
  signal("minority-1", "majority-s2", { direction: -1 }),
], {
  batchId: "majority-contradiction",
  now: new Date("2026-07-14T11:05:00.000Z"),
  messages: [
    message("majority-1", "majority-s1"),
    message("majority-2", "majority-s1"),
    message("majority-3", "majority-s2"),
    message("minority-1", "majority-s2"),
  ],
});
assert.equal(majorityButContradicted.next.facets.directness.offsetBps, 0, "Any unresolved contradiction must block inferred drift");

const malformed = reduceAdaptivePersonality(createAdaptivePersonalityState(), [{
  facet: "directness",
  direction: 1,
  strength: 3,
  confidence: 0.9,
  kind: "repeated_pattern",
  evidenceMessageIds: null,
} as unknown as PersonalitySignalProposal], {
  batchId: "malformed",
  now: new Date("2026-07-14T11:06:00.000Z"),
  messages: [message("malformed-1", "malformed-s1")],
});
assert.equal(malformed.audit.rejectedSignals, 1, "Malformed analyzer output must be rejected without throwing");

let capped = createAdaptivePersonalityState();
for (let day = 0; day < 30; day += 1) {
  const messages = [0, 1, 2].map(index => message(`cap-${day}-${index}`, `cap-session-${day}-${index > 0 ? 2 : 1}`));
  capped = reduceAdaptivePersonality(capped, messages.map(item => signal(item.id, item.sessionKey, {
    facet: "warmth",
  })), {
    batchId: `cap-batch-${day}`,
    now: new Date(Date.UTC(2026, 6, 1 + day, 12)),
    messages,
  }).next;
}
assert.ok(capped.facets.warmth.offsetBps <= 1500, "Learned drift must stay within fifteen points of baseline");

let dailyCapped = createAdaptivePersonalityState();
for (let batch = 0; batch < 5; batch += 1) {
  const batchMessages = [0, 1, 2].map(index => message(`daily-${batch}-${index}`, `daily-session-${index > 0 ? 2 : 1}`));
  dailyCapped = reduceAdaptivePersonality(dailyCapped, batchMessages.map(item => signal(item.id, item.sessionKey, {
    facet: "humor",
  })), {
    batchId: `daily-batch-${batch}`,
    now: new Date("2026-07-13T18:00:00.000Z"),
    messages: batchMessages,
  }).next;
}
assert.equal(dailyCapped.facets.humor.offsetBps, 300, "A facet must move at most three points per day");

const explicit = reduceAdaptivePersonality(createAdaptivePersonalityState(), [signal("explicit-1", "explicit-session", {
  facet: "expressiveness",
  direction: -1,
  kind: "explicit_preference",
  strength: 3,
  confidence: 0.98,
})], {
  batchId: "explicit-batch",
  now: new Date("2026-07-13T12:00:00.000Z"),
  messages: [message("explicit-1", "explicit-session")],
});
assert.equal(explicit.next.facets.expressiveness.offsetBps, -50, "An explicit communication preference gets a small immediate effect");

const correction = reduceAdaptivePersonality(createAdaptivePersonalityState(), [signal("correction-1", "correction-s1", {
  facet: "warmth",
  direction: -1,
  kind: "correction",
})], {
  batchId: "correction-batch",
  now: new Date("2026-07-13T12:05:00.000Z"),
  messages: [message("correction-1", "correction-s1")],
});
const afterOpposingInference = reduceAdaptivePersonality(correction.next, [
  signal("opposing-1", "opposing-s1", { facet: "warmth", direction: 1 }),
  signal("opposing-2", "opposing-s1", { facet: "warmth", direction: 1 }),
  signal("opposing-3", "opposing-s2", { facet: "warmth", direction: 1 }),
], {
  batchId: "opposing-batch",
  now: new Date("2026-07-13T12:06:00.000Z"),
  messages: [
    message("opposing-1", "opposing-s1"),
    message("opposing-2", "opposing-s1"),
    message("opposing-3", "opposing-s2"),
  ],
});
assert.equal(afterOpposingInference.next.facets.warmth.offsetBps, -50, "A historical correction must not be re-applied by later inferred evidence");

const learnedBeforeUserIntent = {
  ...enoughEvidence.next,
  version: 7,
  processedMessageIds: ["latest-1", "latest-2"],
};
const pausedLatest = applyAdaptivePersonalityMutation(learnedBeforeUserIntent, {
  type: "set_enabled",
  enabled: false,
}, new Date("2026-07-15T10:00:00.000Z"));
assert.equal(pausedLatest.enabled, false);
assert.equal(pausedLatest.version, 8, "User intent must rebase on the latest persisted version");
assert.deepEqual(pausedLatest.processedMessageIds, ["latest-1", "latest-2"]);
const resetLatest = applyAdaptivePersonalityMutation(learnedBeforeUserIntent, {
  type: "reset",
  enabled: true,
}, new Date("2026-07-15T10:00:00.000Z"));
assert.equal(resetLatest.facets.directness.offsetBps, 0);
assert.deepEqual(resetLatest.processedMessageIds, ["latest-1", "latest-2"], "Reset must not relearn old history");
assert.equal(resetLatest.observationCount, 0);

const instruction = compileAdaptivePersonalityInstruction(enoughEvidence.next);
assert.match(instruction, /ADAPTIVE PERSONALITY/);
assert.match(instruction, /more direct/i);
assert.ok(instruction.length <= 800, "Adaptive prompt block must remain fixed-size");
assert.doesNotMatch(instruction, /m1|m2|m3/, "Raw evidence must never leak into the prompt");

const testLearnedState = {
  ...enoughEvidence.next,
  updatedAt: new Date(),
};

const settings: BotSettings = {
  botName: "سلمى",
  botGender: "female",
  chattiness: "balanced",
  fragmentedMessages: true,
  soulId: "amira_default",
  soulTraits: { chaos: 30, empathy: 80, slang: 70, intellect: 60, positivity: 40 },
  adaptivePersonality: testLearnedState,
};
const resolved = resolveLivingPersona(settings);
assert.equal(resolved.effectiveTraits.empathy, 80, "Adaptive style must not mutate the immutable archetype baseline");
assert.match(resolved.adaptiveInstruction, /more direct/i);
const decayed = resolveLivingPersona(settings, new Date(Date.now() + 90 * 86_400_000));
assert.equal(decayed.adaptiveInstruction, "", "Dormant learned style must fade toward baseline over time");

const directChatPrompt = getBudgetedSystemInstruction(
  compilePersona(settings),
  settings,
  null,
);
assert.match(directChatPrompt, /ADAPTIVE PERSONALITY/);
assert.match(directChatPrompt, /more direct/i, "The normal streaming/direct-chat prompt must receive learned style");

console.log("Living Persona Core tests passed");
