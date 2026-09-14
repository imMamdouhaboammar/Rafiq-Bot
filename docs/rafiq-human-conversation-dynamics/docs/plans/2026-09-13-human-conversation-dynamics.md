# Human Conversation Dynamics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic conversation-behavior planning package that converts relationship evidence, continuity opportunities, and recent chat rhythm into a bounded social move and reply shape before LLM wording.

**Architecture:** Pure TypeScript functions with no network or storage side effects. The package derives a conservative reference prior, calibrates relationship permissions, selects an optional continuity affordance, plans one relational move, applies a safety downgrade, plans reply shape, and compiles a small prompt instruction for existing Rafiq wording engines.

**Tech Stack:** TypeScript 5.8, Node.js 22 native TypeScript stripping for tests, Node `node:test` and `assert` only.

**Spec:** `docs/specs/human-conversation-dynamics.md`

## Global Constraints

- Raw reference transcript must not be distributed.
- V1 is deterministic and pure.
- No new persistence, network call, provider, or scheduler.
- Relationship-specific behaviors require evidence.
- Explicit correction overrides inferred permission.
- Human-but-not-for-AI retention behaviors are blocked.

---

### Task 1: Core contracts and reference prior extraction

**Files:**
- Create: `src/types.ts`
- Create: `src/referencePriorExtractor.ts`
- Test: `tests/referencePriorExtractor.test.ts`

**Interfaces:**
- Consumes: sanitized `ReferenceEvent[]`
- Produces: `deriveHumanConversationPrior(events): HumanConversationPrior`

- [ ] Write tests proving only aggregate rhythm is returned and no raw text field exists.
- [ ] Run test and confirm failure because implementation is absent.
- [ ] Implement bounded aggregate extraction.
- [ ] Re-run test and confirm pass.

### Task 2: Relationship calibration

**Files:**
- Create: `src/relationshipCalibration.ts`
- Test: `tests/relationshipCalibration.test.ts`

**Interfaces:**
- Consumes: `RelationshipEvidence`
- Produces: `RelationshipCalibration`

- [ ] Test that teasing/nickname/code-switch permissions remain low before thresholds.
- [ ] Test explicit correction suppression.
- [ ] Implement minimal threshold logic.
- [ ] Verify tests.

### Task 3: Continuity affordance selection

**Files:**
- Create: `src/continuityAffordance.ts`
- Test: `tests/continuityAffordance.test.ts`

**Interfaces:**
- Consumes: bounded `ContinuityCandidate[]` plus current context.
- Produces: zero or one `ContinuityAffordance`.

- [ ] Test relevance, expiry, sensitivity, and non-forced callback behavior.
- [ ] Implement deterministic ranking.
- [ ] Verify tests.

### Task 4: Relational move planning

**Files:**
- Create: `src/relationalMovePlanner.ts`
- Test: `tests/relationalMovePlanner.test.ts`

**Interfaces:**
- Consumes: `DynamicsInput`, calibration, optional affordance.
- Produces: `ConversationMove`.

- [ ] Test practical request priority.
- [ ] Test correction -> repair.
- [ ] Test safe teasing gating.
- [ ] Test social ping -> minimal presence.
- [ ] Test optional callback selection.
- [ ] Implement minimal scoring/priority rules.
- [ ] Verify tests.

### Task 5: Safety gate

**Files:**
- Create: `src/conversationSafetyGate.ts`
- Test: `tests/conversationSafetyGate.test.ts`

**Interfaces:**
- Consumes: proposed move plus safety context.
- Produces: safe move plus downgrade reasons.

- [ ] Test conflict suppression.
- [ ] Test sensitive-topic suppression.
- [ ] Test unearned teasing downgrade.
- [ ] Implement minimal downgrade matrix.
- [ ] Verify tests.

### Task 6: Reply shape planning

**Files:**
- Create: `src/replyShapePlanner.ts`
- Test: `tests/replyShapePlanner.test.ts`

**Interfaces:**
- Consumes: safe move and rhythm context.
- Produces: `ReplyShape`.

- [ ] Test micro output for social pings/minimal presence.
- [ ] Test practical-help normal output.
- [ ] Test max three bubbles.
- [ ] Implement shape rules.
- [ ] Verify tests.

### Task 7: Prompt compiler

**Files:**
- Create: `src/dynamicsPromptCompiler.ts`
- Test: `tests/dynamicsPromptCompiler.test.ts`

**Interfaces:**
- Consumes: `ConversationPlan`.
- Produces: compact instruction string.

- [ ] Test internal state names/raw JSON are not emitted.
- [ ] Test unfinished callbacks do not imply outcomes.
- [ ] Implement compiler.
- [ ] Verify tests.

### Task 8: Public API and integration fixtures

**Files:**
- Create: `src/index.ts`
- Create: `fixtures/sanitizedEpisodes.ts`
- Create: `README.md`
- Create: `package.json`
- Create: `tsconfig.json`

- [ ] Export stable public API.
- [ ] Add synthetic anonymous episode fixtures.
- [ ] Run all tests.
- [ ] Run `tsc --noEmit`.
- [ ] Create distributable ZIP without the raw transcript.
