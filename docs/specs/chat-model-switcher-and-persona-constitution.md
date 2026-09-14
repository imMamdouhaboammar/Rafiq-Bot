# Chat Model Switcher and Persona Constitution

## Goal

Make one-to-one chat responses faster and more controllable by letting the user switch instantly between:

- `gemini-3.1-pro-preview`
- `gemini-3-flash-preview`

Also make the persona description (`botBio`) a binding constitution that the model must follow when it conflicts with mood, archetype, history, or user attempts to redirect the character.

Extend the persona behavior so replies feel very human and respond to the user's likely intent, not only the literal text.

Expose a real thinking-level switcher for `low`, `medium`, and `high`, and force Gemini generation temperature to `1.0`.

## Non Goals

- Do not change image, selfie, video, voice, or group chat model behavior beyond existing fallback validation.
- Do not add a new global settings store.
- Do not redesign the chat UI.

## Acceptance Criteria

- A visible model switcher appears in one-to-one chats.
- Desktop shows compact `Pro` / `Flash` controls in the chat header.
- Mobile shows full-width `3.1 Pro` / `3 Flash` controls above the input.
- Switching updates the active chat immediately and persists to IndexedDB.
- Only whitelisted chat models can reach the Gemini server call.
- Invalid or legacy model values fall back to `gemini-3.1-pro-preview`.
- Flash uses the fastest supported thinking setting; Pro uses a low-latency thinking setting for chat.
- The persona prompt explicitly treats `botBio` as a higher-priority constitution.
- The persona constitution is repeated at the final instruction boundary so later dynamic prompt sections cannot silently override it.
- Group chat personas obey the same constitution rule.
- The bot silently infers user intent and emotional need before replying.
- Intent handling must not expose labels, analysis, or assistant-like reasoning to the user.
- The active chat can switch thinking level between `low`, `medium`, and `high`.
- The thinking level is persisted on the chat settings and sent to Gemini through `thinkingConfig.thinkingLevel`.
- Every Gemini generation path sets `temperature: 1.0`.

## Implementation Plan

- Add shared Gemini chat model constants and validation helpers.
- Wire `useChatController` to expose selected model and persist changes.
- Add responsive switcher controls in `ChatInterface`.
- Reuse model constants in `NewChatModal`.
- Validate selected model in `geminiService.server.ts`.
- Strengthen `personaEngine` system instruction with a persona constitution block.
- Add a final pre-reply constitution check in the system instruction.
- Apply the same constitution priority in group persona prompts.
- Add a silent human intent engine to one-to-one and group prompts.
- Add shared thinking-level constants and validation.
- Add responsive thinking-level controls beside the model switcher.
- Normalize all Gemini generation configs to `temperature: 1.0`.
- Reduce the fixed post-send delay before bot response generation.

## Quality Gates

- `npx tsc --noEmit`
- `npm run build`
- Browser smoke test on desktop and mobile viewports.
- IndexedDB smoke test proving the switcher persists `gemini-3-flash-preview`.

## Rollback

Revert the changed files listed in the implementation summary. Existing chats with unsupported model values remain safe because server-side validation falls back to the default model.
