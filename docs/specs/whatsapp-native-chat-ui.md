# WhatsApp Native Chat UI

## Goal

Make the active chat surface feel like a native WhatsApp conversation while preserving all existing chat behavior.

## Non Goals

- Do not change message generation, persistence, memory, voice mode, imports, or persona settings data.
- Do not add a new settings store.
- Do not redesign the sidebar or creation modal beyond what the chat surface requires.
- Do not use WhatsApp logos or copyrighted assets.

## Acceptance Criteria

- The chat header has a WhatsApp-like contact bar with avatar, contact/group name, compact status, call actions, and a three-dot menu.
- Model selection, thinking-level selection, edit/info, and delete actions are moved out of the visible header into the settings menu.
- One-to-one chat bubbles no longer show repeated bot avatars, matching WhatsApp conversation density.
- Group messages still show sender identity.
- The message area keeps a WhatsApp-style wallpaper, bubble colors, timestamps, and read checks.
- The input bar uses a WhatsApp-like rounded composer with attachment, emoji, send, and voice controls.
- The layout remains usable on desktop and mobile viewports without text overlap.

## Assumptions

- "Native WhatsApp Interface" means close structural and visual resemblance, not exact proprietary pixel copying.
- Header call buttons can remain visible because they are primary WhatsApp chat actions, not settings.
- Search is not added because no search behavior exists in the current chat controller.

## Approach Chosen

Targeted component restyle and menu consolidation in `ChatInterface`, plus a small bubble-density adjustment in `ChatBubble`.

Tradeoff: this avoids a large rewrite and preserves behavior, while delivering the requested WhatsApp-like shell. It is less risky than recreating the full app shell or adding new global settings state.

## Tasks

- Restyle chat header to a compact WhatsApp contact bar.
- Add a three-dot settings menu.
- Move visible model/thinking controls into the settings menu.
- Move info/edit and delete into the settings menu.
- Tune message area, typing indicator, composer, attachment menu, and recording state.
- Remove repeated one-to-one bot avatars from message bubbles.
- Verify TypeScript/build and browser smoke on desktop/mobile.

## Quality Gates

- `npm run build`
- Browser smoke test on desktop viewport.
- Browser smoke test on mobile viewport.
- Visual check for header, settings menu, input bar, and bubble density.

## Rollback

Revert `components/ChatInterface.tsx`, `components/ChatBubble.tsx`, and this spec file.
