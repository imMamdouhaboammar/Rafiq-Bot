# Rafiq July: 150 Small Commit Map

This document is the execution ledger for the approved Rafiq July roadmap. Commits must remain reviewable, independently reversible, and tied to a concrete acceptance criterion. Commit count is a delivery target, not permission to split one logical change into meaningless noise.

## Global rules

- Work only in `imMamdouhaboammar/Rafiq-July`.
- Keep the product single-user, local-first, and identified by `main_user`.
- Do not add Supabase, remote account storage, or hidden cross-bot memory sharing.
- Add a failing test before behavior changes when the current harness can exercise the behavior.
- Every commit changes one concern and includes the closest relevant test or documentation update.
- Do not claim a gate passed without command output from CI or a verified local run.
- Never commit environment files, service-account files, private keys, caches, generated model files, or local browser data.

## Commit allocation

| Range | Theme | Target |
|---|---|---:|
| 001-010 | Repository safety, baseline, CI skeleton, runbooks | 10 |
| 011-030 | React lifecycle, cancellation, cleanup, modal semantics | 20 |
| 031-042 | Rendering scale, bounded caches, queues, prompt limits | 12 |
| 043-057 | Background Persona Compiler and physical-state removal | 15 |
| 058-070 | User story, bot story, signals, provenance, ACL | 13 |
| 071-085 | Scoped memory v6, retention, compaction, inspector core | 15 |
| 086-094 | Boldness and proactivity policy plus controls | 9 |
| 095-108 | Persistent group turn coordinator and budgets | 14 |
| 109-116 | Explicit selfie flow and Studio-only general images | 8 |
| 117-126 | Honest link reader and capability health | 10 |
| 127-138 | OPFS attachments, workers, video states | 12 |
| 139-146 | Transactional transfer v2 and encrypted textual backup | 8 |
| 147-150 | Responsive shell, preset dock, final quality gates | 4 |

## Milestone gates

### Gate A: repository safety

- Secret scan covers worktree and reachable history.
- Tracked environment files are removed and credentials are rotated outside Git.
- Baseline distinguishes confirmed failures from tool false positives.

### Gate B: P0 runtime health

- No stale chat request may commit after chat generation changes.
- Timers, listeners, audio handles, object URLs, and long-press work are released.
- Message rendering and caches have explicit limits.
- React Doctor reports zero errors and no untriaged actionable warnings.

### Gate C: P1 behavior and memory

- No automatic `global_shared_pool` indexing or retrieval remains.
- Persona updates use evidence and confidence with slow mutation limits.
- Physical suffering is absent unless explicitly supplied by the user for roleplay or biography.
- Story and memory access respects scope and ACL in unit tests.
- Group turns are queued, cancelable, budgeted, and idempotent.
- Chat image generation is limited to an explicit confirmed selfie action.

### Gate D: P2 storage and transfer

- Original files use OPFS and never transit through Vercel functions.
- Import uses validation, staging, rollback, and interruption tests.
- Normal exports omit private story, sensitive memory, and binary media.
- Mobile chat has no horizontal overflow at 320 to 430 pixels and keeps the composer above the visual viewport.

## Commit record format

Each completed commit should be recorded in the release notes with:

1. commit SHA and message
2. requirement or defect addressed
3. files changed
4. checks run and their result
5. known limitations or follow-up commit number
