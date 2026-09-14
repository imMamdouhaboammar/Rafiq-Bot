# Testing Guide

Rafiq's test suite uses `tsx` as a script runner — there is no separate test framework. Each test file is a standalone executable TypeScript script.

---

## Running tests

```bash
npm run test:p0   # P0 gate: security + core unit tests (fast, ~30 tests)
npm test          # full suite: all 110 test files
```

To run a single file:

```bash
tsx tests/humanRealism.test.ts
tsx tests/boundedLru.test.ts
```

---

## How tests work

Each test file uses Node's built-in `node:assert/strict` module:

```typescript
import assert from 'node:assert/strict';
import { BoundedLru } from '../services/boundedLru.js';

const cache = new BoundedLru<string, number>({ maxEntries: 2 });
cache.set('a', 1);
assert.equal(cache.get('a'), 1);
assert.throws(() => new BoundedLru({ maxEntries: 0 }), /positive integer/);
```

Tests exit with code 0 on success and non-zero on any `assert` failure.

**`tests/setupEnv.ts`** — imported by server-side tests that need the environment bootstrapped. It sets:
- `NODE_ENV=test`
- `GEMINI_API_KEY=test-only-gemini-key` (fake key — tests do not call Gemini)
- `RAFIQ_APP_PASSWORD_HASH` — SHA-256 of `test-only-password`
- `RAFIQ_APP_SESSION_SECRET` — a test-only secret ≥ 32 chars
- `RAFIQ_VECTOR_MEMORY_ENABLED=true` — but clears all Redis URLs so no real connection is attempted

---

## Test categories

### Unit tests

Test a single service module in isolation. No network calls, no real DB (Dexie is not available in Node).

**Examples:**

| Test file | What it covers |
|-----------|---------------|
| `tests/boundedLru.test.ts` | `services/boundedLru.ts` — LRU eviction |
| `tests/humanRealism.test.ts` | `services/humanRealism.ts` — burst formatting, emoji protocol |
| `tests/messageBurst.test.ts` | `services/messageBurst.ts` — chunking strategy |
| `tests/memoryPolicy.test.ts` | `services/memoryPolicy.ts` — memory extraction rules |
| `tests/dynamicMood.test.ts` | `services/dynamicEngines.ts` — mood state machine |
| `tests/livingPersonaCore.test.ts` | `services/livingPersonaCore.ts` — personality adaptation |
| `tests/chatBubbleComparator.test.ts` | `services/chatBubbleComparator.ts` — message deduplication |

### Reachability tests

Verify that a component or module is wired correctly — imported in the right place, mounted once, not doubled. These read source files as text and use `assert.match` / `assert.doesNotMatch`:

```typescript
import { readFile } from 'node:fs/promises';
const appSource = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');
assert.match(appSource, /import ResponsiveWhatsAppShell/);
assert.equal((appSource.match(/<ToastHost\s*\/>/g) || []).length, 1);
```

**Examples:**

| Test file | What it verifies |
|-----------|----------------|
| `tests/responsiveShellReachability.test.ts` | `ResponsiveWhatsAppShell` is imported and mounted once |
| `tests/presetRepliesDockReachability.test.ts` | `PresetRepliesDock` wiring |
| `tests/memoryInspectorReachability.test.ts` | `MemoryInspector` panel wiring |
| `tests/streamCancellationReachability.test.ts` | Streaming cancellation signal path |
| `tests/reflectionRpcReachability.test.ts` | Reflection engine RPC call site |

### Integration tests

Test multi-module flows end-to-end, often using a real Dexie-in-memory store or mocked Gemini response:

**Examples:**

| Test file | What it covers |
|-----------|---------------|
| `tests/clonePersonaRuntime.test.ts` | Clone pipeline end-to-end |
| `tests/progressiveCloneJob.test.ts` | Clone job batching and state |
| `tests/groupConversation.test.ts` | Group chat turn routing |
| `tests/continuityCoordinator.test.ts` | Companion continuity across sessions |
| `tests/transferV2.test.ts` | Chat export/import round-trip |

### Security tests

`npm run test:security` runs two scripts:

| Script | What it checks |
|--------|---------------|
| `scripts/security/secret-detectors.test.mjs` | Pattern detection accuracy for common secret shapes |
| `scripts/security/scan-secrets.integration.test.mjs` | Full scan of the working tree for accidentally committed secrets |

---

## P0 gate — what it covers

`npm run test:p0` runs security tests first, then:

```
boundedLru · boundedAsyncQueue · asyncGenerationGuard · chatBubbleComparator
storyNavigation · rafiqV6Contracts · dbV6Migration · memoryPolicy · storySignals
socialAgencyPolicy · capabilityHealth · webSearchHonesty · urlSafety
appAuthConfiguration · googleClientConfiguration · geminiSafetySettings
localVectorMemory · sharedMemoriesPool · vectorMemoryLegacyCleanup · agentRouter
```

These are fast (< 5s total) and cover the most critical invariants. Run them before every commit.

---

## Adding a new test

1. Create `tests/myFeature.test.ts`.
2. Import `assert from 'node:assert/strict'`.
3. Import the module under test (use `.js` extension per `"moduleResolution": "bundler"` convention).
4. For tests that need the server environment: `import './setupEnv.js';` at the top.
5. Add the file to `package.json`:
   - If it belongs in P0: append `&& tsx tests/myFeature.test.ts` to `test:p0`
   - Otherwise: append to `test`

**Convention:** use `assert.equal()` for exact values, `assert.match()` for pattern checks, `assert.throws()` for error conditions. No test runner globals (`it`, `describe`, `expect`) — just plain assertions.

---

## Skipped tests (tsconfig excludes)

Five test files are excluded from type-checking but still run at test time:

- `tests/koboldInferenceProvider.test.ts`
- `tests/lorebookEngine.test.ts`
- `tests/reflectionEngine.test.ts`
- `tests/roleplayEngine.test.ts`
- `tests/socialHeartbeat.test.ts`

These use heavy mock patterns that conflict with strict DOM types. They are fully functional at runtime.
