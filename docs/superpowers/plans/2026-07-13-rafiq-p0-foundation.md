# Rafiq P0 Foundation Implementation Plan

> **For agentic workers:** Execute tasks in order. Workers may inspect and propose changes, but only the coordinating agent may commit, merge, or push.

**Goal:** Establish a safe, testable base for eliminating cross-bot memory leakage, stale async writes, unbounded runtime resources, and untriaged React defects.

**Architecture:** P0 introduces explicit policy modules before integrating them into large runtime files. Pure functions define scope, retention, queue limits, and capability state. Existing services then consume those contracts in small behavior changes with focused regression tests.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Dexie 4, Zod 3, Node test scripts through `tsx`, Playwright and React Testing Library when added with a locked dependency update.

## Global constraints

- Single-user and local-first with identity `main_user`.
- No automatic memory sharing between bots.
- User story, bot, chat, group, and knowledge are separate scopes.
- Original attachments remain local and do not pass through Vercel.
- Image generation in chat requires an explicit confirmed selfie action.
- General image generation remains inside Studio.
- Link reading requires explicit user intent and must not bypass access controls.
- P0 completes before P1; P1 completes before P2.
- Release requires tests, lint, typecheck, build, React Doctor, secret scan, and Unslop.

## File map

### Repository safety

- `scripts/security/scan-secrets.mjs`: deterministic worktree secret-pattern scanner with allowlist support.
- `scripts/security/check-tracked-sensitive-files.mjs`: rejects tracked environment, key, credential, cache, and model artifacts.
- `.github/workflows/security.yml`: executes repository safety checks on pushes and pull requests.
- `docs/security/credential-rotation-runbook.md`: records the required out-of-band response for previously exposed credentials.

### Contracts and policies

- `contracts/rafiqV6.ts`: Zod contracts for story, scoped memory, social agency, attachment metadata, group jobs, capability health, and transfer v2.
- `services/memoryPolicy.ts`: scope keys, access checks, retention deadlines, compaction limits, and prompt selection limits.
- `services/storySignals.ts`: safe story-signal selection capped at three signals and 600 characters.
- `services/socialAgencyPolicy.ts`: bounds boldness and proactivity and enforces cooldown, quiet hours, and deduplication.
- `services/capabilityHealth.ts`: derives honest capability states and blocks success claims without a real test.

### Runtime integrations

- `services/redisVectorMemory.server.ts`: remove `global_shared_pool` indexing, retrieval, formatting, and Redis queries.
- `tests/sharedMemoriesPool.test.ts`: reverse the legacy expectation and prove bot isolation.
- `services/db.ts`: add Dexie v6 tables and a non-destructive migration.
- `types.ts`: consume v6 contracts while preserving legacy parsing during migration.

## Tasks

### Task 1: Repository safety baseline

- [ ] Add credential rotation runbook.
- [ ] Add worktree secret scanner.
- [ ] Add tracked-sensitive-file scanner.
- [ ] Add CI workflow using pinned runtime versions.
- [ ] Add documented baseline with confirmed defects and unverified claims.
- [ ] Run scanners in CI and record exact output.

### Task 2: Scoped memory policy

- [ ] Write tests proving bot A records are inaccessible to bot B.
- [ ] Add canonical scope-key builder.
- [ ] Add ACL checks for user story, bot, chat, group, and knowledge.
- [ ] Add retention rules: durable identity and goals, seven-day transient emotions, thirty-day general details.
- [ ] Add per-scope compaction threshold of 250 records.
- [ ] Add prompt selection cap and deterministic ranking.

### Task 3: Remove the global shared pool

- [ ] Change the existing regression test to expect isolation.
- [ ] Remove automatic writes to `global_shared_pool`.
- [ ] Remove local fallback reads from `global_shared_pool`.
- [ ] Remove Agent Memory global-session searches.
- [ ] Restrict Redis vector queries to the requested scope.
- [ ] Remove shared-pool labels from formatted context.
- [ ] Run the isolated memory test and the full existing test command.

### Task 4: Dexie v6 contracts

- [ ] Add versioned Zod schemas.
- [ ] Add v6 Dexie tables and indexes.
- [ ] Migrate useful Soul Mixer values to persona evidence without physical-state defaults.
- [ ] Preserve legacy chats, messages, memories, and random prompts.
- [ ] Add migration tests for empty, normal, partial, and malformed legacy records.

### Task 5: React lifecycle baseline

- [ ] Inventory effects, timers, listeners, audio resources, object URLs, and long-press handlers.
- [ ] Introduce per-chat generation cancellation.
- [ ] Prevent stale loads and streams from writing after navigation.
- [ ] Correct `ChatBubble` memo equality or remove unsafe custom equality.
- [ ] Make story navigation state updates pure.
- [ ] Adopt one accessible modal primitive.
- [ ] Record remaining React Doctor items with file, rule, evidence, and disposition.

### Task 6: Bounded runtime resources

- [ ] Add bounded LRU utility with unit tests.
- [ ] Apply it to markdown and persona caches.
- [ ] Bound background queues and graph traversal.
- [ ] Add retry and backoff with idempotent writes.
- [ ] Add soak-test instrumentation for listeners, object URLs, queues, and heap samples.

## Verification commands

Run only after the matching tooling is installed and locked:

```bash
npm run security:scan
npm test
npm run typecheck
npm run lint
npm run build
npm run react-doctor
npm run test:e2e
npx unslop audit
```

No command may be marked successful from static inspection alone. GitHub Actions results or captured local command output are required.
