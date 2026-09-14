import assert from "node:assert/strict";
import {
  advanceContinuityTime,
  applyContinuityProposal,
  createInitialContinuityState,
  selectContinuityContext,
} from "../services/companionContinuity.js";

const now = new Date("2026-09-13T12:00:00Z");
const evidence = { messageIds: ["m1", "m2", "m3"] };

const initial = createInitialContinuityState(now);
assert.equal(initial.version, 1);
assert.deepEqual(initial.threads, []);

const withDueThread = applyContinuityProposal(initial, {
  type: "thread_upsert",
  kind: "outcome",
  summary: "نتيجة الانترفيو لسه ما ظهرتش",
  sourceMessageIds: ["m1"],
  salience: 0.9,
  dueAt: "2026-09-14T09:00:00.000Z",
}, evidence, now);
assert.equal(withDueThread.threads.length, 1);
assert.equal(withDueThread.threads[0]?.status, "active");

const dueState = advanceContinuityTime(withDueThread, new Date("2026-09-14T10:00:00Z"));
assert.equal(dueState.threads[0]?.status, "due");

const expiring = applyContinuityProposal(initial, {
  type: "thread_upsert",
  kind: "shared_interest",
  summary: "نتكلم عن فيلم قديم",
  sourceMessageIds: ["m1"],
  salience: 0.2,
  expiresAt: "2026-09-13T13:00:00.000Z",
}, evidence, now);
const expired = advanceContinuityTime(expiring, new Date("2026-09-13T14:00:00Z"));
assert.equal(expired.threads[0]?.status, "expired");
assert.equal(selectContinuityContext(expired, now).length, 0);

const withExpectation = applyContinuityProposal(initial, {
  type: "expectation_upsert",
  key: "plans-slip",
  statement: "مواعيد الخطط بتتأجل كتير",
  confidence: 0.95,
  sourceMessageIds: ["m1"],
}, evidence, now);
assert.ok((withExpectation.expectations[0]?.confidence ?? 1) <= 0.35);
assert.equal(withExpectation.expectations[0]?.evidenceCount, 1);

const corrected = applyContinuityProposal(withExpectation, {
  type: "expectation_retire",
  key: "plans-slip",
  sourceMessageIds: ["m2"],
}, evidence, now);
assert.equal(corrected.expectations.length, 0);

const withOpinion = applyContinuityProposal(initial, {
  type: "opinion_upsert",
  topic: "الفيلم",
  stance: "حلو بس مطول زيادة",
  confidence: 0.7,
  sourceMessageIds: ["m1", "m2"],
}, evidence, now);
const laterOpinion = advanceContinuityTime(withOpinion, new Date("2026-10-13T12:00:00Z"));
assert.equal(laterOpinion.opinions[0]?.stance, "حلو بس مطول زيادة");
assert.equal(laterOpinion.opinions[0]?.status, "stable");

let bounded = initial;
for (let index = 0; index < 16; index += 1) {
  bounded = applyContinuityProposal(bounded, {
    type: "thread_upsert",
    kind: "follow_up",
    summary: `متابعة رقم ${index}`,
    sourceMessageIds: ["m1"],
    salience: index / 20,
  }, evidence, now);
}
assert.ok(bounded.threads.filter(thread => ["active", "due", "dormant"].includes(thread.status)).length <= 12);
assert.ok(selectContinuityContext(bounded, now).length <= 4);

assert.throws(() => applyContinuityProposal(initial, {
  type: "thread_upsert",
  kind: "follow_up",
  summary: "مصدر غير موجود",
  sourceMessageIds: ["unknown"],
  salience: 0.5,
}, evidence, now));

// Verify resolving and reviving thread clears resolvedAt
const resolved = applyContinuityProposal(withDueThread, {
  type: "thread_resolve",
  threadId: withDueThread.threads[0]!.id,
  sourceMessageIds: ["m1"],
}, evidence, now);
assert.equal(resolved.threads[0]?.status, "resolved");
assert.ok(resolved.threads[0]?.resolvedAt !== undefined);

const revived = applyContinuityProposal(resolved, {
  type: "thread_upsert",
  kind: "outcome",
  summary: "نتيجة الانترفيو لسه ما ظهرتش",
  sourceMessageIds: ["m1"],
  salience: 0.9,
}, evidence, new Date("2026-09-15T12:00:00Z"));
assert.equal(revived.threads[0]?.status, "active");
assert.equal(revived.threads[0]?.resolvedAt, undefined);

// Verify duplicate ritual source IDs are rejected safely without crashing
const stateBeforeDuplicateRitual = initial;
const stateAfterDuplicateRitual = applyContinuityProposal(initial, {
  type: "ritual_upsert",
  key: "morning-tea",
  description: "شاي الصباح",
  sourceMessageIds: ["m1", "m1"],
}, evidence, now);
assert.deepEqual(stateAfterDuplicateRitual, stateBeforeDuplicateRitual);

console.log("Companion continuity tests passed successfully!");
