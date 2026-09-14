# Adding a provider

Rafiq does not yet have one universal inference interface. A provider contribution should reduce, not increase, provider-specific branching across the product.

## Boundary rules

1. Keep credentials and refresh tokens in server-only code. Never expose them to React, IndexedDB, screenshots, logs, or public examples.
2. Separate authentication from model capability. A successful login does not prove text, tools, vision, images, video, embeddings, or streaming are available.
3. Do not copy first-party OAuth client IDs from another CLI or repository. Use a provider-supported third-party flow and document its policy basis.
4. Preserve Rafiq-owned persona, memory, continuity, tool, and localization behavior. A provider adapter transports inference; it does not own companion identity.
5. Add explicit failure behavior. Optional providers must fail honestly and must not fabricate search or model output.

## Integration seams today

- `services/googleClient.server.ts`: credential resolution and Google client construction
- `services/agentRouter.server.ts`: optional gateway adapter pattern
- `services/koboldInferenceProvider.ts`: small local OpenAI-compatible adapter pattern
- `services/modelRouter.ts`: response-path model selection
- `services/geminiModels.ts`: current model registry
- `services/geminiService.server.ts`: main inference orchestration

## Contribution sequence

Start with a server-only adapter and focused tests for configuration, request shape, timeout/error handling, and response normalization. Add model capability metadata before exposing the provider in UI. Only then integrate it with the main chat path and verify streaming, tools, attachments, memory, and localization through the real chain.

If the provider requires browser redirects or OAuth callbacks, store state, PKCE verifiers, access tokens, and refresh tokens on the server or in an approved local secret store. A hosted multi-user connector also needs credential ownership tied to a real user identity; the current app-wide password gate is not a user account model.

## Required verification

Run focused provider tests, `bun run typecheck`, `bun run test:p0`, `bun run security:scan`, and the full suite before exposing a new provider as supported. Update `docs/providers/README.md`, `.env.example`, and `docs/configuration/env-reference.md` when the public configuration contract changes.
