# Studio in Chat Spec

## Goal
Allow a user to generate creative images directly from the one-to-one chat composer without leaving the conversation.

## Non Goals
- Persist Studio settings per chat.
- Add iterative image editing state.
- Make the persona proactively generate images by default.

## User Stories
- As a user, I can toggle Studio mode from the composer.
- As a user, I can choose aspect ratio, output size, and style before sending a prompt.
- As a user, I receive the generated image as a normal chat attachment.
- As a user, I can download or open a generated image from the chat bubble.

## Acceptance Criteria
- Studio mode is unavailable for group chats.
- Studio prompts use `generateStudioImage` through the existing protected Gemini RPC.
- The default model is `gemini-3.1-flash-image-preview` with fallback to existing image models.
- Generated Studio attachments include `fileName: studio-image.png` and render in existing image bubbles.
- Typecheck and production build complete.

## Data Contracts
- `StudioConfig.aspectRatio`: `1:1 | 3:4 | 4:3 | 9:16 | 16:9`
- `StudioConfig.size`: `1K | 2K | 4K`
- `StudioConfig.style`: optional supported Studio style id.
- Server response: `{ imageUrl: string; description: string }`

## Error Cases
- Empty prompt returns a server error.
- Failed model calls fall through the configured model chain.
- Full failure adds the existing chat error response and clears typing state.

## Rollback
Revert changes in `types.ts`, `services/geminiModels.ts`, `services/geminiService.server.ts`, `services/geminiService.ts`, `api/gemini.ts`, `hooks/useChatController.ts`, `components/ChatInterface.tsx`, and `components/ChatBubble.tsx`.
