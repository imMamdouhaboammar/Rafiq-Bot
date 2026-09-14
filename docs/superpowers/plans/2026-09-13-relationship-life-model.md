# Rafiq Relationship & Continuity Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. One write owner at a time. Do not commit directly to `main`.

**Goal:** Make Rafiq feel like an ongoing relationship rather than a sequence of realistic replies by adding bounded relationship interpretations, continuity threads, persistent taste, time-aware state transitions, and reason-backed initiative without fabricated off-screen physical life or dependency tactics.

**Architecture:** Add one bounded `CompanionContinuityState` to each one-to-one `ChatSession`, maintained through a pure deterministic reducer. Model-backed reflection may propose candidate changes, but only validated reducers persist them. Existing `humanRealism`, `reflectionEngine`, and `socialHeartbeat` remain the integration seams; the implementation must wire and prove those seams rather than create parallel engines.

**Tech Stack:** TypeScript 5.8, Zod 3, Dexie 4, React 19, existing Vite/Express/Vercel Functions runtime, existing `tsx` test harness.

**Spec:** `docs/specs/relationship-life-model.md`

## Global Constraints

- Anticipation is the product objective; dependency is not.
- No grounded-world fabricated physical activity, third-party conversations, jobs, illness, hunger, financial distress, or emergencies.
- No jealousy, guilt, exclusivity, punishment for absence, fake urgency, or relationship-loss mechanics.
- Existing Living Persona identity boundaries remain authoritative.
- Existing Human Realism anti-fabrication and healthy-agency rules remain authoritative.
- Dreamscape and Slow Burn fictional state must never enter grounded continuity state.
- Group activity must not silently mutate private one-to-one relationship continuity.
- Memory remains the fact/event record; continuity stores only bounded derived meaning and unfinished/shared state.
- Model output may propose state changes but may not write state directly.
- Active + due continuity threads are capped at 12; prompt injection is capped at 4 continuity items.
- No new notification transport, model provider, or second general memory store in this implementation.
- Do not optimize implementation decisions for session minutes, message count, or push-open rate.
- Runtime reachability is part of acceptance: tested modules that are not invoked by the user path do not count as implemented behavior.

---

## Current-State Evidence That Shapes This Plan

- `services/humanRealism.ts` already forbids invented personal history, plans, places, crises, external emergencies, and dependency pressure. Extend that seam; do not weaken it.
- `docs/specs/conversation-shaped-persona.md` explicitly removed simulated hunger, fatigue, financial stress, and canned hardship. Continuity must not reintroduce those concepts under a different name.
- `services/reflectionEngine.server.ts` already produces daily summaries, discovered beliefs, curiosity gaps, inside-joke suggestions, and an intimacy delta.
- `services/socialHeartbeat.ts` already contains quiet hours, daily caps, cooldown, conflict suppression, pending curiosity triggers, and generic inactivity fallback.
- On the current default branch, code search finds `runReflectionConsolidation` only at its definition and finds `evaluateSocialHeartbeat` only at its definition/tests. Treat runtime activation as unproven until an integration test demonstrates otherwise.
- `ChatSession` is already stored as an object in Dexie. The first implementation should add an optional bounded field to the existing chat record instead of creating a new IndexedDB table unless measured constraints prove that insufficient.

## File Map

### New files

- `services/companionContinuity.ts` — Zod-backed continuity contracts, pure reducer, time transitions, bounded selection, proposal validation, and compact prompt context.
- `services/continuityCoordinator.ts` — thin runtime coordinator that owns turn/session-boundary orchestration and keeps `useChatController.ts` from absorbing another subsystem.
- `api/reflection.ts` — authenticated/validated server endpoint that invokes the existing reflection engine and returns bounded proposals; add only if the existing API router cannot expose the server-only function without coupling.
- `tests/companionContinuity.test.ts` — pure state lifecycle tests.
- `tests/continuityCoordinator.test.ts` — active-path orchestration tests.
- `tests/continuityIsolation.test.ts` — group/fiction/grounded isolation regressions.
- `docs/verification/relationship-continuity-dogfood.md` — manual dogfood protocol and measurement sheet.

### Existing files to modify

- `types.ts` — add optional `continuityState` to `ChatSessionSchema`; export continuity type only if repository type boundaries require it.
- `services/reflectionEngine.server.ts` — emit evidence-linked continuity proposals, not direct persisted state.
- `services/humanRealism.ts` — accept compact continuity context and preserve all existing anti-fabrication rules.
- `services/personaEngine.ts` — pass selected private continuity context into the one-to-one realism/compiler path.
- `services/personaMind.ts` — consume read-only group-safe identity context only; do not pass private pair-state into group mutation paths.
- `services/socialHeartbeat.ts` — prioritize due continuity triggers and demote generic inactivity.
- `hooks/useChatController.ts` — call the coordinator at narrowly defined session/turn boundaries.
- `package.json` — add the new focused tests to the existing deterministic test chain only after they pass individually.

## Proposed V1 State Contract

Keep the first contract deliberately small. Do not introduce a universal graph or event-sourcing layer.

```ts
export type ContinuityThreadStatus =
  | 'candidate'
  | 'active'
  | 'due'
  | 'dormant'
  | 'resolved'
  | 'expired';

export type ContinuityThreadKind =
  | 'outcome'
  | 'commitment'
  | 'follow_up'
  | 'shared_interest'
  | 'disagreement'
  | 'inside_joke';

export interface ContinuityThread {
  id: string;
  kind: ContinuityThreadKind;
  summary: string;
  sourceMessageIds: string[];
  salience: number; // 0..1
  status: ContinuityThreadStatus;
  createdAt: string;
  updatedAt: string;
  dueAt?: string;
  expiresAt?: string;
  resolvedAt?: string;
}

export interface CompanionOpinion {
  topic: string;
  stance: string;
  confidence: number; // 0..1
  sourceMessageIds: string[];
  status: 'stable' | 'reconsidering';
  updatedAt: string;
}

export interface RelationshipExpectation {
  key: string;
  statement: string;
  confidence: number; // 0..1
  evidenceCount: number;
  sourceMessageIds: string[];
  updatedAt: string;
}

export interface SharedRitual {
  key: string;
  description: string;
  evidenceCount: number;
  lastSeenAt: string;
  nextEligibleAt?: string;
}

export interface CompanionContinuityState {
  version: 1;
  threads: ContinuityThread[];
  opinions: CompanionOpinion[];
  expectations: RelationshipExpectation[];
  rituals: SharedRitual[];
  updatedAt: string;
}
```

V1 intentionally reuses existing `PsychologicalState.intimacyLevel`, `emotionalLedger`, attachment style, and breakpoint state instead of creating duplicate trust/intimacy scores.

### Bounds

- threads: max 12 active/due/dormant retained in prompt-eligible set; resolved/expired compacted aggressively;
- opinions: max 12;
- expectations: max 8;
- rituals: max 6;
- source message IDs: max 6 per item;
- prompt continuity items: max 4 total;
- no item text longer than the existing prompt-budget policy allows; target 200 characters per summary/stance/statement.

---

### Task 0: Prove the Existing Runtime Seams Before Adding Behavior

**Files:**
- Inspect: `hooks/useChatController.ts`
- Inspect: `services/reflectionEngine.server.ts`
- Inspect: `services/socialHeartbeat.ts`
- Inspect: `api/gemini.ts`
- Test: `tests/continuityCoordinator.test.ts`

**Interfaces:**
- Consumes: current chat/session lifecycle and server API conventions.
- Produces: a documented call graph identifying exactly where reflection and heartbeat will be invoked.

- [ ] **Step 1: Write a failing reachability test**

Create `tests/continuityCoordinator.test.ts` with a minimal public coordinator contract that cannot pass until the coordinator is wired through a testable seam:

```ts
import assert from 'node:assert/strict';
import { createContinuityCoordinator } from '../services/continuityCoordinator.js';

const coordinator = createContinuityCoordinator({
  now: () => new Date('2026-09-13T12:00:00Z'),
});

assert.equal(typeof coordinator.onSessionResume, 'function');
assert.equal(typeof coordinator.onConversationSettled, 'function');
```

- [ ] **Step 2: Run the focused test and confirm it fails for the missing coordinator**

Run:

```bash
npx tsx tests/continuityCoordinator.test.ts
```

Expected: module/function-not-found failure.

- [ ] **Step 3: Trace existing invocation points**

Confirm whether `runReflectionConsolidation` and `evaluateSocialHeartbeat` have runtime callers. Do not rely on their test presence. Record the chosen integration boundary in comments in `continuityCoordinator.ts`, not in a second planning doc.

- [ ] **Step 4: Add the smallest coordinator shell**

The shell must expose only session resume and settled-conversation boundaries. No scheduler, queue framework, or event bus is added in this task.

- [ ] **Step 5: Run the focused test**

Expected: PASS for the public coordinator shape.

- [ ] **Step 6: Commit**

```bash
git add services/continuityCoordinator.ts tests/continuityCoordinator.test.ts
git commit -m "test: establish continuity runtime seam"
```

---

### Task 1: Add the Bounded Continuity Contract and Pure Reducer

**Files:**
- Create: `services/companionContinuity.ts`
- Modify: `types.ts`
- Test: `tests/companionContinuity.test.ts`

**Interfaces:**
- Produces:
  - `createInitialContinuityState(now)`
  - `advanceContinuityTime(state, now)`
  - `applyContinuityProposal(state, proposal, evidence, now)`
  - `selectContinuityContext(state, now, limit)`
- Consumes: message IDs and explicit evidence supplied by callers; no direct database/network access.

- [ ] **Step 1: Write failing lifecycle tests**

Cover at minimum:

```ts
// due transition
// expiry transition
// resolved thread no longer prompt-eligible
// max 12 retained prompt-eligible threads
// opinion does not flip from elapsed time alone
// one message cannot create a high-confidence expectation
// explicit correction can reduce/retire an expectation
// selection returns <= 4 compact items
```

Use a fixed clock in every test.

- [ ] **Step 2: Verify the tests fail before implementation**

```bash
npx tsx tests/companionContinuity.test.ts
```

- [ ] **Step 3: Implement schemas and reducers**

Use Zod at the input/output boundary. Reducers must be deterministic and pure. IDs must derive from stable input/evidence where practical; do not use random values for idempotent proposal application.

- [ ] **Step 4: Add `continuityState` to `ChatSessionSchema`**

Make the field optional/default-safe so legacy sessions parse unchanged. Do not create a Dexie table or database version solely for this field; the existing chat object can persist it.

- [ ] **Step 5: Run focused tests and existing schema/migration tests**

```bash
npx tsx tests/companionContinuity.test.ts
npx tsx tests/rafiqV6Contracts.test.ts
npx tsx tests/dbV6Migration.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add services/companionContinuity.ts types.ts tests/companionContinuity.test.ts
git commit -m "feat: add bounded companion continuity state"
```

---

### Task 2: Add Evidence-Linked Reflection Proposals

**Files:**
- Modify: `services/reflectionEngine.server.ts`
- Create if required by current server conventions: `api/reflection.ts`
- Test: `tests/reflectionEngine.test.ts`

**Interfaces:**
- Consumes: recent message batch and existing psychological state.
- Produces: validated candidate proposals containing type, text, source message IDs, salience/confidence, and optional revisit time.
- Does not persist continuity state.

- [ ] **Step 1: Extend tests before the schema**

Add fixtures proving:

- proposals referencing unknown message IDs are rejected;
- a candidate can create an outcome/follow-up thread;
- an inside-joke proposal remains evidence-linked;
- a relationship expectation from one message is low confidence;
- no proposal category exists for illness, hunger, money distress, fake work events, or third-party events;
- malformed model JSON falls back safely without mutating state.

- [ ] **Step 2: Extend the reflection result schema**

Prefer one `continuityProposals` array over separate new arrays for every future concept.

A proposal should be narrow enough for the pure reducer to validate. Do not return a replacement `CompanionContinuityState` from the model.

- [ ] **Step 3: Preserve the current reflection outputs**

`dailySummary`, `discoveredBeliefs`, `curiosityGaps`, `suggestedInsideJokes`, `intimacyDelta`, and `reflectionNote` must remain compatible unless an explicit migration is added.

- [ ] **Step 4: Expose the server-only reflection through the existing API pattern if necessary**

If no safe existing route can call `reflectionEngine.server.ts`, add `api/reflection.ts` with request validation and existing authentication conventions. Do not call Gemini directly from the browser.

- [ ] **Step 5: Run reflection tests**

```bash
npx tsx tests/reflectionEngine.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add services/reflectionEngine.server.ts tests/reflectionEngine.test.ts
git add api/reflection.ts  # only if created
git commit -m "feat: emit validated continuity proposals from reflection"
```

---

### Task 3: Wire Continuity Into the Active One-to-One User Path

**Files:**
- Modify: `services/continuityCoordinator.ts`
- Modify: `hooks/useChatController.ts`
- Modify: `services/db.ts` only if the existing `saveChatSession` path cannot persist the optional field unchanged
- Test: `tests/continuityCoordinator.test.ts`

**Interfaces:**
- `onConversationSettled(chat, recentMessages)` returns the updated session after reflection/proposal reduction when the idle/turn threshold is met.
- `onSessionResume(chat)` applies time transitions and returns due state plus an optional proactive candidate.

- [ ] **Step 1: Add failing integration-style coordinator tests**

Prove the flow:

```text
legacy chat without continuity
  -> resume
  -> initial continuity created
  -> no fabricated event appears
  -> save

conversation with unresolved interview outcome
  -> reflection proposal
  -> reducer validates source IDs
  -> active thread persisted

later resume after dueAt
  -> time reducer marks thread due
```

- [ ] **Step 2: Implement coordinator with dependency injection**

Inject clock and reflection client/function so tests do not require a live provider. Do not add a framework-level scheduler.

- [ ] **Step 3: Wire the smallest controller calls**

Use session resume/chat selection and a settled-conversation boundary. Avoid invoking reflection on every token or every rendered bubble.

- [ ] **Step 4: Preserve cancellation and stale-write protections**

Any async reflection result must verify it still belongs to the current chat/version before saving. A late result from chat A must never overwrite chat B or a newer chat snapshot.

- [ ] **Step 5: Run coordinator plus async guard tests**

```bash
npx tsx tests/continuityCoordinator.test.ts
npx tsx tests/asyncGenerationGuard.test.ts
npx tsx tests/chatStoreIsolation.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add services/continuityCoordinator.ts hooks/useChatController.ts tests/continuityCoordinator.test.ts
git add services/db.ts  # only if changed
git commit -m "feat: activate continuity in private chat flow"
```

---

### Task 4: Inject Compact Continuity Into Response Planning

**Files:**
- Modify: `services/humanRealism.ts`
- Modify: `services/personaEngine.ts`
- Test: `tests/humanRealism.test.ts`
- Test: `tests/companionContinuity.test.ts`

**Interfaces:**
- Consumes: `selectContinuityContext(..., limit = 4)` result.
- Produces: compact prompt text with no raw state dump.

- [ ] **Step 1: Write failing prompt tests**

Prove:

- at most four continuity items are injected;
- resolved/expired threads never enter prompts;
- a relevant opinion can appear without forcing agreement;
- anti-fabrication wording remains present;
- continuity instructions do not expose scores or internal labels to user-facing text.

- [ ] **Step 2: Extend the Human Realism input contract**

Add a compact, already-selected continuity input. Do not give the prompt compiler the entire chat database or all memory records.

- [ ] **Step 3: Add one continuity section to the existing prompt**

The instruction should tell the model to use continuity only when natural and never to narrate the state model.

- [ ] **Step 4: Wire `personaEngine.ts` for one-to-one chats**

Do not mutate state here. This is a read-only response-planning step.

- [ ] **Step 5: Run tests**

```bash
npx tsx tests/humanRealism.test.ts
npx tsx tests/companionContinuity.test.ts
npx tsx tests/cleanPersona.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add services/humanRealism.ts services/personaEngine.ts tests/humanRealism.test.ts tests/companionContinuity.test.ts
git commit -m "feat: ground replies in compact continuity context"
```

---

### Task 5: Make Proactivity Thread-Backed Instead of Absence-Backed

**Files:**
- Modify: `services/socialHeartbeat.ts`
- Modify: `services/continuityCoordinator.ts`
- Test: `tests/socialHeartbeat.test.ts`
- Test: `tests/continuityCoordinator.test.ts`

**Interfaces:**
- Consumes: due continuity threads selected by the coordinator.
- Produces: one reason-backed proactive candidate subject to existing policy checks.

- [ ] **Step 1: Write failing priority tests**

Required order:

```text
explicit/requested follow-up
> due outcome/commitment thread
> repeated ritual
> generic inactivity fallback
```

Also prove quiet hours, daily limits, cooldown, and conflict suppression still win over all non-emergency proactive candidates.

- [ ] **Step 2: Remove automatic emotional language from generic inactivity**

A generic absence fallback must not automatically claim "وحشتني". Warmth may be selected later from actual intimacy/relationship context, but absence alone cannot create an affection claim.

- [ ] **Step 3: Add continuity trigger mapping**

Map due threads into the existing `ProactiveReachoutTrigger` shape rather than creating a second proactive queue model.

- [ ] **Step 4: Activate evaluation on app/session resume only**

V1 does not add push notification infrastructure. If the app is closed, state becomes due; on the next supported runtime boundary the coordinator may surface the candidate.

- [ ] **Step 5: Run tests**

```bash
npx tsx tests/socialHeartbeat.test.ts
npx tsx tests/continuityCoordinator.test.ts
npx tsx tests/socialAgencyPolicy.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add services/socialHeartbeat.ts services/continuityCoordinator.ts tests/socialHeartbeat.test.ts tests/continuityCoordinator.test.ts
git commit -m "feat: prioritize meaningful proactive followups"
```

---

### Task 6: Enforce Fiction, Group, and Relationship Isolation

**Files:**
- Modify: `services/personaMind.ts` only if necessary to block private continuity mutation/input leakage
- Modify: `services/companionContinuity.ts`
- Test: `tests/continuityIsolation.test.ts`
- Regression: `tests/groupConversation.test.ts`
- Regression: `tests/dynamicMood.test.ts`
- Regression: `tests/slowBurnStoryEngine.test.ts`

**Interfaces:**
- Consumes: message provenance/mode metadata.
- Produces: hard rejection of invalid continuity evidence.

- [ ] **Step 1: Write failing isolation tests**

Prove:

- a Dreamscape fictional event cannot create a grounded continuity thread;
- a Slow Burn story event cannot create an expectation/opinion about real shared history;
- group bot-to-bot chatter cannot alter private pair state;
- a group message may still read public/stable persona identity without receiving private relationship interpretations;
- imported clone identity stays separate from post-import relationship continuity.

- [ ] **Step 2: Add provenance checks to proposal validation**

Reject or ignore proposals whose evidence source is fictional-mode or a non-private relationship scope.

- [ ] **Step 3: Run isolation and existing regression tests**

```bash
npx tsx tests/continuityIsolation.test.ts
npx tsx tests/groupConversation.test.ts
npx tsx tests/dynamicMood.test.ts
npx tsx tests/slowBurnStoryEngine.test.ts
npx tsx tests/clonePersonaRuntime.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add services/companionContinuity.ts services/personaMind.ts tests/continuityIsolation.test.ts
git commit -m "test: isolate grounded relationship continuity"
```

---

### Task 7: Add Dogfood Evaluation Before Expanding Scope

**Files:**
- Create: `docs/verification/relationship-continuity-dogfood.md`
- Modify: `package.json`

**Interfaces:**
- Produces: repeatable evaluation protocol and test-suite inclusion.

- [ ] **Step 1: Write the manual dogfood protocol**

Record at minimum once per evaluated session:

- whether a prior thread was recognized correctly;
- whether Rafiq introduced a meaningful new relational state;
- whether any callback felt forced;
- whether any claim felt fabricated;
- whether any proactive message felt needy/guilting;
- whether the user corrected a memory/relationship interpretation;
- whether the user returned voluntarily without a proactive message;
- free-text answer for the 48-hour no-push recall experiment when run.

- [ ] **Step 2: Add new tests to the deterministic suite**

Append only after focused tests pass:

```text
tsx tests/companionContinuity.test.ts
tsx tests/continuityCoordinator.test.ts
tsx tests/continuityIsolation.test.ts
```

Do not replace `scripts/run-test-suite.mjs`; discovery should continue catching forgotten tests.

- [ ] **Step 3: Run the broad verification ladder**

```bash
npm run security:scan
npm test
npm run typecheck
npm run build
node scripts/run-test-suite.mjs
```

If `npm ci` is still blocked by the pre-existing `package.json`/`package-lock.json` mismatch, repair that in a separate atomic prerequisite commit/PR or explicitly mark release verification blocked. Do not claim these checks passed if dependency installation never completed.

- [ ] **Step 4: Run manual active-path verification**

Minimum scenarios:

1. create/continue a private chat;
2. establish an unresolved real user outcome;
3. leave and advance the test clock/time window;
4. resume and observe a due thread;
5. receive a relevant follow-up without fabricated off-screen claims;
6. resolve the thread and confirm it no longer reappears;
7. enter Dreamscape/Slow Burn and confirm fictional events do not leak;
8. use group chat and confirm private continuity is unchanged.

- [ ] **Step 5: Commit**

```bash
git add docs/verification/relationship-continuity-dogfood.md package.json
git commit -m "docs: add relationship continuity dogfood gate"
```

---

## PR / Review Gates for the Future Implementation

The implementation PR is **BLOCKED** from merge if any of these are true:

- the active path still does not call the continuity coordinator;
- tests exercise isolated modules only but no runtime integration seam;
- model output can replace persisted continuity state directly;
- continuity invents external-world events;
- fictional/group evidence contaminates private grounded state;
- proactive messages bypass quiet hours/cooldown/daily caps;
- generic inactivity is the primary initiative mechanism;
- prompt context is unbounded;
- the implementation introduces another general memory store;
- broad verification cannot run and the PR describes itself as release-ready anyway.

The implementation PR may be considered **CODE READY / RELEASE BLOCKED** when all feature-specific behavior is proven locally but repository-wide dependency/CI infrastructure remains independently broken.

## YAGNI Decisions

Do not build these in V1:

- no relationship event-sourcing platform;
- no graph database for continuity state;
- no separate Dexie table unless bounded state cannot fit safely in `ChatSession`;
- no background service worker scheduler solely for this feature;
- no remote analytics pipeline;
- no new notification provider;
- no synthetic NPC social circle;
- no generalized autonomous agent loop;
- no new LLM call per message just to create novelty;
- no duplicate trust/intimacy score when existing psychology already carries those signals.

## Final Verification Matrix

| Requirement | Primary evidence |
|---|---|
| unfinished matter survives sessions | coordinator integration test |
| time makes thread due/stale without fake events | pure reducer test |
| opinion persists and can reconsider from evidence | pure reducer test |
| repeated evidence creates expectation/ritual | pure reducer test |
| user correction can repair interpretation | reducer + coordinator test |
| prompt uses compact relevant continuity only | human realism test |
| proactive prioritizes meaningful due thread | social heartbeat test |
| quiet hours/cooldown/conflict still suppress | existing + extended heartbeat tests |
| Dreamscape/Slow Burn cannot leak | isolation test |
| group does not mutate private state | isolation + group tests |
| legacy chats remain valid | schema/migration regressions |
| active runtime path actually invokes feature | coordinator reachability/integration test |
| no grounded fabricated off-screen claim | prompt guard + dogfood fabrication audit |
| no dependency tactics | prompt/proactivity regression + dogfood review |

## Execution Order

Implement in this order only:

`Task 0 -> Task 1 -> Task 2 -> Task 3 -> Task 4 -> Task 5 -> Task 6 -> Task 7`

The vertical slice is complete after Task 5: a real unresolved thread is created, persisted, becomes due with time, informs a later response, and can drive one policy-compliant proactive re-entry. Tasks 6 and 7 are release hardening and evidence gates, not optional polish.
