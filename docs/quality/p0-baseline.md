# P0 Baseline

Recorded on 2026-07-13 against the initial private snapshot commit `1929e335450136099915813443b45220b07fe4e8`.

This baseline separates defects confirmed by source inspection from measurements that still require an executable environment. A measurement is not treated as verified merely because it appeared in the roadmap.

## Confirmed by source inspection

### Cross-bot memory leakage

`services/redisVectorMemory.server.ts` currently writes every chat record into both the chat-specific scope and `global_shared_pool`. Retrieval combines the requested chat with that global pool in the local fallback, Agent Memory path, and Redis KNN query. The existing test explicitly expects bot B to receive bot A's memory.

Disposition: confirmed P0 defect. The legacy test must be reversed before the implementation is changed.

### Attachment persistence uses base64

`types.ts` allows attachment `base64` and `services/db.ts` reconstructs a data URL when `previewUrl` is absent. This keeps large binary payloads inside structured application records and is incompatible with the approved OPFS design.

Disposition: confirmed P2 architectural defect. P0 must avoid expanding this path.

### Physical-state defaults exist

`PsychologicalStateSchema` contains hunger, financial stress, and sleepiness defaults. New chat initialization also supplies those values. This can cause physical suffering to become ordinary prompt state even when the user did not define it.

Disposition: confirmed P1 behavior defect. Migration must preserve useful persona evidence while removing these automatic prompt inputs.

### Test harness is serial ad hoc scripts

`package.json` runs a long chain of `tsx` scripts. Vitest, React Testing Library, Playwright, axe, lint, typecheck, React Doctor, and Unslop are not represented as release scripts in the initial snapshot.

Disposition: confirmed quality gap. Tool installation must update both package metadata and the lockfile from official packages before the related gate is enforced.

### Large component surface

`App.tsx` and `components/ChatBubble.tsx` are large components with multiple responsibilities. `ChatBubble` combines markdown parsing, file rendering, audio playback, context menus, and interaction controls.

Disposition: confirmed maintainability and lifecycle risk. React Doctor results are not inferred from file size and still require a real scan.

## Reported but not yet independently executed

- React Doctor score 39/100 with 8 errors and 281 warnings.
- 10,000-message heap growth and listener/object URL behavior.
- Vercel failure near 4.5 MB for the current attachment path.
- Group real-model context retention and cancellation behavior.
- Import/export round-trip and rollback behavior.
- Unslop score and error count.

These remain acceptance targets. They must be reproduced or replaced by clearer evidence before closure.

## Baseline gate status

| Gate | Status | Evidence needed |
|---|---|---|
| Worktree secret scan | not run | CI or local scanner output |
| Reachable-history secret scan | not run | scanner output against all reachable commits |
| Unit tests | not run | complete command output |
| Typecheck | script absent | locked script and output |
| Lint | script absent | locked config and output |
| Build | not run | Vite build output |
| React Doctor | script absent | full scan output and triage file |
| Playwright/axe | absent | locked installation and run output |
| Unslop | script absent | audit output showing 100/100 and zero errors |

## Safety note

Credential rotation cannot be performed through source changes. Any credential that previously existed in tracked `.env*`, service-account, or key files must be revoked and reissued in the provider console. History cleanup does not make an already exposed credential safe.
