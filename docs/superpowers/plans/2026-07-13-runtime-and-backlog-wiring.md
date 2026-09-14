# Runtime and Backlog Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the active chat runtime and ship the first existing backlog modules through the real user interface without addressing deferred security and privacy work.

**Architecture:** Keep the current React, Zustand, Dexie, and Vercel structure. Introduce a focused SSE parser so transport behavior is independently testable, pass cancellation from the chat controller into the network request, then mount the existing Preset Replies Dock and Capability Health Dashboard through current screens rather than creating parallel feature shells.

**Tech Stack:** React 19, TypeScript 5.8, Zustand 5, Dexie 4, executable TypeScript contract tests via tsx.

## Global Constraints

- Commit directly to `main` as explicitly requested.
- Keep each commit small and independently understandable.
- Do not include the deferred P0 privacy and security work in this batch.
- Preserve current chat behavior and Arabic interface copy.
- Add tests before behavior changes.
- Run the repository test, typecheck, security scan, and production build gates after the batch.

---

### Task 1: Streaming Transport Contract

**Files:**
- Create: `services/sseStreamParser.ts`
- Create: `tests/sseStreamParser.test.ts`
- Modify: `services/geminiService.ts`
- Modify: `hooks/useChatController.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `consumeSseResponse(response, handlers)` for tested SSE parsing and error propagation.
- Produces: optional `AbortSignal` support on `sendMessageToGeminiStream`.

- [ ] Write a failing test proving server `isError` chunks reject instead of being logged and ignored.
- [ ] Write a failing test proving split SSE chunks are buffered and delivered once complete.
- [ ] Implement the parser with explicit JSON parse handling and `[DONE]` support.
- [ ] Pass `AbortSignal` from `useChatController` to the browser fetch.
- [ ] Run the focused test and `npm run typecheck`.
- [ ] Commit the transport change.

### Task 2: Preset Replies in Active Chat

**Files:**
- Modify: `components/ChatInterface.tsx`
- Modify: `hooks/useChatController.ts`
- Create: `services/presetReplies.ts`
- Create: `tests/presetReplies.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `getPresetRepliesForChat(chat)` with deterministic, bounded suggestions.
- Consumes: existing `PresetRepliesDock` and controller `handleSend`.

- [ ] Write a failing test proving group and direct chats receive appropriate bounded presets.
- [ ] Implement the preset selector without model calls or new persistence.
- [ ] Expose a send action from the chat controller for the dock.
- [ ] Mount the dock in the active `ChatInterface` with current composer/header bounds.
- [ ] Run focused tests and typecheck.
- [ ] Commit the active dock wiring.

### Task 3: Capability Health Reachability

**Files:**
- Modify: `components/PwaToolsTab.tsx`
- Create: `tests/capabilityHealthReachability.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: existing `CapabilityHealthDashboard` and browser capability probes.
- Produces: a visible health section in the shipped tools tab.

- [ ] Write a failing source-contract test proving the shipped tools tab mounts the dashboard.
- [ ] Mount the existing dashboard using the current probe repository and refresh action.
- [ ] Run focused tests and typecheck.
- [ ] Commit the dashboard wiring.

### Task 4: Batch Verification and Roadmap Update

**Files:**
- Modify: `docs/roadmap/execution-status.md`

**Interfaces:**
- Records the exact completed active-path work and remaining acceptance gaps.

- [ ] Run `npm test`.
- [ ] Run `npm run security:scan`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Confirm GitHub Actions on the final commit.
- [ ] Update the roadmap without claiming browser E2E or performance acceptance.
- [ ] Commit the status update.
