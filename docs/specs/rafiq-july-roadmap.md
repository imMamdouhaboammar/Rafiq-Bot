# Rafiq July — Product and Engineering Roadmap

## Objective

Turn Rafiq into a local-first, single-user companion product whose bots develop from their bios and witnessed conversations, interact safely in groups, and feel proactive without becoming verbose or repetitive.

## Verified baseline

- React Doctor: 39/100, with 8 errors and 281 warnings before remediation.
- Production build and TypeScript checks pass.
- The current attachment pipeline serializes files as base64 and is not suitable for large media.
- Image routing can over-trigger from creative keywords and model-emitted generation tags.
- Memory records can currently cross bot boundaries through a shared pool.
- Import/export, web tools, and group conversations need real end-to-end reliability gates.

## P0 — Runtime correctness and repository safety

1. Remove tracked environment files from the publishable snapshot, rotate exposed credentials, and run secret scanning before release.
2. Fix effect, timer, stream, audio-listener, stale memo, story navigation, semantic HTML, focus management, and accessibility findings.
3. Add bounded caches, cancellation, object URL cleanup, message virtualization, and memory compaction.
4. Release gate: tests, build, typecheck, full React Doctor, and Unslop. No actionable Doctor warning may remain undocumented.

## P1 — Story, persona, and memory

### User life story

- Store a correctable timeline in the local Human ID profile.
- Every story event is private, available to all bots, or available to selected bots.
- Bots receive only a few relevant extracted signals, never the raw timeline by default.

### Bot story

- Maintain a visible and correctable timeline with provenance.
- Only bio facts and witnessed chat/group events can become canonical history.
- Imaginary events stay separately marked as fictional.

### Persona compiler

- Retire Soul Mixer as the source of truth and incrementally compile personality from bio, evidence, and user corrections.
- Separate stable personality, transient mood, boldness, and proactivity.
- Do not inject hunger, starvation, death, exhaustion, or illness unless explicitly requested as role-play or authored in the bio.

### Scoped memory

- Replace the shared global pool with user-story, bot, chat, group, and knowledge scopes.
- Keep provenance, confidence, sensitivity, retention, and supersession for every memory.
- Provide inspect, correct, forget, and forget-everywhere controls.

## P1 — Groups and social agency

- Add a persistent Group Turn Coordinator with ordering, cancellation, retries, cost limits, and causal state.
- Allow at most two primary bot replies and one follow-up per user turn unless the user explicitly continues the exchange.
- Let bots respond to each other using speaker context without allowing infinite autonomous loops.
- Add per-bot `boldness` and `proactivity`; boldness changes candor rather than message length.
- Limit unsolicited initiative to one message per bot per day with quiet hours, a 12-hour cooldown, and topic deduplication.

## P1 — Truthful tools

- Conversation image generation is selfie-only and requires an explicit user action. General generation remains inside Studio.
- A pasted link shows a preview; content reading starts only after an explicit request.
- Never bypass authentication, CAPTCHA, paywalls, DRM, robots rules, private networks, or access controls.
- Remove fabricated search results and expose configured, degraded, unavailable, and last-success states for every tool.

## P2 — Large attachments and transfer

- Store original files in browser OPFS and keep only metadata in Dexie.
- Use streaming writes, progress, cancel/resume, hashes, quota checks, and real video playback.
- Never send the original large binary through a Vercel function; send only bounded user-approved derivatives for AI analysis.
- Version `.rafiq` exports, validate them, stage imports transactionally, verify checksums, and support rollback.
- Exports intentionally exclude binary media. Imported media references must display as local-only or missing instead of silently breaking.

## P2 — WhatsApp-like mobile experience

- Replace duplicated mobile/desktop branches with one responsive shell.
- Keep the composer above mobile keyboards and safe areas, with 44px minimum tap targets and no horizontal overflow at 320–430px.
- Consolidate preset-reply controls into a draggable, edge-snapping dock with close, persisted position, and restore from chat settings.
- Add explicit loading, empty, offline, failed-send, retry, and unsupported-media states.

## Acceptance gates

- No cross-bot story or memory leakage in an ACL matrix test.
- Reactions, replies, attachments, and streaming states never become stale after chat changes.
- A 10,000-message soak test shows bounded memory, queue size, prompt size, and listener count.
- A 500MB local video can be attached, cancelled/resumed, and played without freezing Chromium.
- A real-model group smoke test proves two bots can respond to each other while respecting the causal cap.
- Full import/export round trips cover legacy versions, malformed data, duplicate IDs, missing bots, and quota failure.
- Final release passes tests, build, typecheck, full React Doctor, secret scan, and Unslop with 0 errors.

## Release destination

Publish only a sanitized clean-history snapshot to the private repository `imMamdouhaboammar/Rafiq-July`. The original repository and its remote remain unchanged.
