# Human Realism Upgrade

## Phase A: Constitution

- Simplicity: add one reusable prompt layer instead of scattering new rules across files.
- Safety: do not add permissions, network calls, credentials, or provider changes.
- Testability: expose the realism layer as a deterministic compiler that tests can inspect.
- Determinism: avoid random prompt assembly; dynamic wording depends only on explicit psychology state.
- Minimal churn: keep existing soul, route, memory, and Gemini model paths intact.

## Phase B: Specify

### Goal

Make Rafiq's agents feel more human by improving live conversational judgment: subtext reading, continuity, emotional timing, restraint, and non-generic wording.

### Non Goals

- Do not redesign the chat UI.
- Do not add a new model provider.
- Do not change memory storage, Redis, LangCache, or Google Search behavior.
- Do not loosen privacy controls around persona constitution or bio leakage.

### User Stories

- As a user, I want the agent to answer the real social meaning behind my message, not only the literal words.
- As a user, I want the agent to remember relevant context naturally without sounding like it is reading a database.
- As a user, I want the agent to feel alive but not overacted, repetitive, or scripted.
- As a group chat user, I want each persona to react like a believable group member, not a private assistant.

### Acceptance Criteria

- One-to-one system prompts include a dedicated human realism layer.
- Group persona prompts include the same realism layer with group-specific behavior.
- The layer instructs the model to infer literal ask, social subtext, relevant memory, and a single human stance silently.
- The layer explicitly prevents generic assistant, therapist-script, roleplay-script, and bio-narrator failure modes.
- The layer tells the model not to invent shared memories or personal history.
- Tests verify that the compiled one-to-one and group instructions contain the realism controls.

### Error Cases and Edge Cases

- Low intimacy must remain guarded and should not force affection.
- Damaged emotional ledger should allow colder or disappointed replies without breaking the persona.
- Low energy should reduce performance rather than producing long dramatic replies.
- Memories should be used only when directly relevant.

### Observability

- No new runtime logging is required because the change is prompt assembly only.
- Build and deterministic prompt tests are the quality evidence.

### Rollback

Revert `services/humanRealism.ts`, remove its imports from `services/personaEngine.ts` and `services/personaMind.ts`, remove the test file, and remove this spec.

## Phase C: Clarify And Analyze

Assumption: "increase humanity" means improving perceived conversational naturalness and relationship realism inside the existing Gemini flow, not adding a visible UI control or changing providers.

Evidence from code:

- `services/personaEngine.ts` already compiles persona constitution, archetype, traits, route, and style into the main one-to-one system instruction.
- `services/personaMind.ts` builds separate group persona prompts, so group behavior needs the same realism layer separately.
- `services/conversationRouter.ts` already detects direct questions, venting, banter, conflict, decisions, and neutral messages.
- `services/geminiService.server.ts` already applies bio leak repair after generation.

## Phase D: Plan

- Add `services/humanRealism.ts` with a deterministic `compileHumanRealismInstruction` helper.
- Inject the helper into one-to-one prompt assembly after route and context.
- Inject the helper into group persona prompt assembly.
- Add lightweight prompt compiler tests.
- Add an npm test script for the new tests.

## Phase E: Tasks

- Create the human realism compiler.
- Wire one-to-one prompts.
- Wire group prompts.
- Write prompt assembly tests.
- Run `npm test`, `npx tsc --noEmit`, and `npm run build`.

## Phase F: Checklist

- `npm test`
- `npx tsc --noEmit`
- `npm run build`
- Manual review for no provider, credential, storage, or UI behavior changes.
