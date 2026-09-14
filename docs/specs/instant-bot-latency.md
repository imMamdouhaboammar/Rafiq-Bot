# Instant Bot Latency

## Phase A: Constitution

- Keep response quality controls intact: model and thinking level remain user-selected.
- Remove artificial latency before optimizing model capability.
- Keep changes small, deterministic, and easy to roll back.
- Avoid adding new permissions or background network calls.

## Phase B: Specify

### Goal

Make one-to-one and group bot replies feel immediate by eliminating avoidable waits in the client and group engine while preserving the existing Gemini model and thinking controls.

### Non Goals

- Do not replace the Gemini transport with streaming in this slice.
- Do not change image, selfie, video, import, or profile generation behavior.
- Do not force all chats to Flash or lower thinking.
- Do not redesign the chat UI.

### User Stories

- As a user, when I send a message, I should see the bot start responding immediately instead of waiting before any feedback.
- As a user, when a bot splits a response into multiple messages, the parts should arrive quickly instead of being delayed by simulated typing.
- As a group chat user, bots should not wait several seconds just to simulate reading and typing before calling Gemini.

### Acceptance Criteria

- One-to-one chat starts the bot response pipeline immediately after the user message is saved.
- Typing state appears immediately after sending a one-to-one message.
- Fragmented text messages are saved and displayed without per-part artificial typing waits.
- Group bot replies emit typing state before the Gemini call and do not wait on simulated reading/typing delays.
- Google Search grounding is only attached to text chat generation when external context is present.
- Existing model and thinking level selections continue to be honored.

### Error Cases And Edge Cases

- Empty messages with no attachments still do nothing.
- Image generation mode continues to call selfie generation as before.
- Gemini failures still produce the existing friendly fallback message.
- Burst messages may no longer be coalesced by a 900ms patience window; each send is processed promptly.

### Observability

- Existing console warnings and errors remain.
- The code path is simple enough to verify with TypeScript and production build.

### Rollback

Revert this spec and the small latency edits in `hooks/useChatController.ts`, `services/personaMind.ts`, and `services/geminiService.server.ts`.

## Phase C: Clarify And Analyze

Assumption: "instant" means removing app-imposed latency and showing immediate feedback, not requiring a full streaming rewrite in this change.

Evidence from code:

- `hooks/useChatController.ts` had a fixed `900ms` delay before calling the bot response path.
- Fragmented messages waited `500ms + length * speedFactor` per part after the model response.
- `services/personaMind.ts` waited for simulated reading and typing before calling Gemini.
- `services/geminiService.server.ts` attached `googleSearch` to every normal chat message, even casual messages without external context.

## Phase D: Plan

- Set the one-to-one response delay to zero and show typing immediately after optimistic send.
- Keep the debounce cancellation structure so same-tick duplicate sends are still guarded.
- Remove per-fragment artificial sleeps while preserving message order.
- Move group typing state before Gemini and delete simulated reading/typing waits.
- Add a helper that only enables Google Search when `externalContext` is present.

## Phase E: Tasks

- Update one-to-one chat send timing.
- Update fragmented message timing.
- Update group persona action timing.
- Update Gemini text generation tool selection.
- Run TypeScript and build verification.

## Phase F: Checklist

- `npx tsc --noEmit`
- `npm run build`
- Manual code review for preserved model/thinking behavior.
