# Rafiq July execution status

Status date: 2026-07-13

Repository: `imMamdouhaboammar/Rafiq-July`

Active delivery branch: `main`

## Executive status

The 150-small-commit delivery target has been exceeded. Commit count remains evidence of incremental delivery, not evidence that every acceptance gate is complete.

The current `main` snapshot has passed the repository's pull-request verification workflows after the latest active-path changes: Complete Test Discovery, Quality Gates, and Repository Security all completed successfully. The verified jobs included every discovered TypeScript test, the scripted suite, repository scanning, TypeScript, and the production build.

This milestone is not release-ready. React Doctor, dependency review, browser E2E, accessibility, performance soak, real-provider tests, and physical-device acceptance remain open. Privacy and security hardening beyond the existing repository gates is intentionally deferred during the current development and testing phase.

## Delivered in the current main round

- Added a standalone SSE parser with split-chunk buffering, `[DONE]` handling, source/tool aggregation, malformed payload handling, and proper server-error propagation.
- Shipped the Human ID timeline inside the active profile experience with add, edit, delete, dates, sensitivity, and per-bot ACL controls.
- Shipped the Memory Inspector inside the active tools screen with search, scope filtering, readable scope names, and Forget Everywhere.
- Shipped Bot Story controls with bot selection, real versus imaginary labels, corrections with supersession history, logical deletion, and source-message navigation.
- Shipped per-bot Social Agency controls for boldness, proactivity, unsolicited-message enablement, cooldown, quiet hours, and timezone.
- Shipped Preset Replies Dock through the existing saved prompt pool and the active chat send callback, including preview, undo, drag/snap persistence, hide, and reopen.
- Fixed action-dialog lifecycle so callbacks no longer leave confirmation dialogs stuck open.
- Preserved concurrent group-chat work committed to `main` while applying these changes.

## Backlog progress

`Implemented` means the core module and active product path exist. It does not override a missing browser acceptance test. `Partial` means useful foundations exist but one or more required product paths or acceptance gates remain.

| # | Workstream | Status | Delivered | Remaining acceptance work |
|---:|---|---|---|---|
| 1 | Repository safety | Deferred for current phase | Tracked-file guard, worktree/index/reachable-history scanner, CI jobs, detector tests, rotation runbook, baseline | External credential rotation and final clean-history publication decision before release |
| 2 | React runtime correctness | Partial | Async generation guard, bounded lifecycle helpers, modal/focus work, tested SSE parser, server-error propagation, dialog callback dismissal | Pass the request AbortSignal into the active network call; rerun React Doctor and fix actionable errors; split remaining oversized components |
| 3 | Bounded runtime and memory | Partial | Bounded LRU/async queue, paged message-window logic, prompt budgets, correction-aware compaction, bounded OPFS writes | 1,000-message long-task test; 10,000-message heap/listener/object-URL soak; wire a virtualized list into the shipped shell |
| 4 | Background Persona Compiler | Implemented | Conversation-shaped compiler, evidence-aware runtime, stable/transient separation, physical-suffering defaults removed from new state and prompts | Complete legacy-data migration proof and real-conversation evaluation |
| 5 | User life story | Implemented | V6 contracts, repository, ACL-aware signals, prompt caps, and shipped Human ID add/edit/delete/ACL timeline | Browser E2E for persistence, selected-bot visibility, editing, deletion, and mobile interaction |
| 6 | Bot story | Implemented | Typed records, provenance, supersession, real/imaginary labels, shipped correction/deletion UI, and source-message navigation | Browser E2E for correction history, deleted state, unloaded source messages, and real generated events |
| 7 | Scoped memory | Implemented | Shared-pool isolation, scoped records, provenance/retention/sensitivity, compaction, shipped Memory Inspector, and Forget Everywhere | Browser E2E plus long-run physical retention and deletion policy proof |
| 8 | Boldness and proactivity | Implemented | Separate policy fields, safety limits, cooldown/topic-dedup logic, and shipped per-bot controls including enablement, quiet hours, and timezone | Connect the saved policy to real notification scheduling and run behavioral evaluation |
| 9 | Group Turn Coordinator | Partial | Persistent jobs, causal caps, idempotency, cancel/retry/backoff, replayed drain requests, deterministic race tests, and later unlimited-conversation activity changes on `main` | Real-model multi-bot smoke, attachment propagation, UI cancellation proof, and cost telemetry |
| 10 | Explicit image generation | Implemented | Model tags no longer execute, keyword routing removed, confirmed/idempotent selfie path, Studio-only general prompt policy tests | Browser E2E proving one confirmed selfie and zero generation from ordinary image language |
| 11 | Honest link reading | Partial | Honest unavailable search state, explicit routing, URL validation and SSRF defenses | Safe preview and explicit-read browser flow, rendered-reader policy, citations, DNS/IP pinning integration, real-provider smoke |
| 12 | Capability health | Partial | Health contracts, repository, probes, dashboard, unit tests, and a visible dashboard in the active tools screen | Real staging checks for Gemini, groups, reader, transfer, and attachments across every target shell |
| 13 | OPFS large attachments | Partial | OPFS metadata model, bounded chunk writes, progress/cancel/resume, incremental hashing, quota, and derivative modules/tests | Replace Base64 in the active composer/player path, add Worker derivatives and codec states, then run 500MB Chromium acceptance |
| 14 | Import/export v2 | Partial | Versioned manifest, validation, legacy planning, transactional staging/rollback, encrypted textual export and malformed-file tests | Replace the active v5 tools flow, run browser round-trip with interruption/quota failures, and confirm binary missing/local-only behavior |
| 15 | Responsive WhatsApp shell | Partial | Responsive shell and viewport modules/tests exist; active application still uses its previous mobile and desktop branches | Integrate one shipped shell; run WebKit/Chromium 320 to 430px overflow, visual viewport, keyboard, and safe-area E2E |
| 16 | Preset Replies Dock | Implemented | Dock state, drag/snap persistence, active saved-prompt wiring, shared send path, preview, undo, hide, and reopen | Keyboard/pointer browser E2E, resize/orientation tests, and non-overlap proof with composer and floating controls |

## Verified gates for the latest code snapshot before this status update

| Gate | Result |
|---|---|
| Complete Test Discovery | Pass: every discovered TypeScript test completed successfully |
| Quality Gates | Pass: repository safety, P0 regressions, full suite, TypeScript, and production build |
| Repository Security | Pass |
| Browser E2E and accessibility | Not installed or executed yet |
| Performance and device tests | Not executed yet |
| React Doctor full scan | Previous result remains 50/100 with 6 errors and 289 warnings; rerun required after the current React changes |
| Dependency audit | Previous result remains 23 advisories; review remains deferred during the current feature-development round |

## Current execution order

1. Unify the responsive WhatsApp shell and remove duplicate mobile and desktop render branches.
2. Connect `AbortSignal` from the active generation lease to the streaming fetch and prove cancellation.
3. Replace the active Base64 attachment composer path with OPFS-backed attachment records and progressive reads.
4. Replace the visible v5 import/export tools with the transactional v2 flow.
5. Add locked browser harnesses for Human ID, Bot Story, Memory Inspector, Social Agency, Preset Replies, groups, and attachment flows.
6. Run React Doctor, fix actionable runtime and accessibility findings, then split the largest React modules.
7. Add message-list virtualization and run the 1,000-message and 10,000-message performance acceptance tests.
8. Run real-provider and physical-device acceptance after the feature paths above are stable.
