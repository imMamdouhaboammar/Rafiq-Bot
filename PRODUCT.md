# Product

## Summary

Rafiq is an open-source AI companion application for configurable conversational personas, continuity, memory, tools, and media workflows. It originated with an Egyptian Arabic experience, which remains the reference localization, while the shared runtime is being separated from locale-specific behavior.

## Primary users

- People running a personal or self-hosted companion application
- Contributors extending persona, memory, tools, localization, or provider behavior
- Researchers exploring conversation dynamics and persona continuity through the included research artifacts

## Core jobs

- Create or configure a companion and hold an ongoing conversation with persistent local context
- Import a WhatsApp text export and derive an editable persona profile from observed conversation evidence
- Use optional tools and memory integrations without exposing server credentials to the browser
- Adapt locale and culture without forcing Egyptian defaults into non-Egyptian sessions

## Current product boundaries

Browser IndexedDB is the primary persistent store for chats and local companion state. Server routes handle inference, optional remote memory integrations, search, and other server-only work. Provider credentials belong on the server or in a local secret store and must not be copied into browser state.

Google Gemini API and Vertex AI are the primary inference paths today. AgentRouter is an optional gateway. A KoboldCpp adapter exists as a tested local integration, but it is not yet the main chat provider selector.

## Reference localization

Egyptian Arabic is intentionally preserved as a first-class preset and research reference. Egypt-specific dialect helpers, cultural timing, food data, and persona content may remain local when explicitly selected. Shared runtime defaults must remain locale-neutral.

## Non-goals for the current release line

- Claiming full UI translation across all locales
- Treating the app-wide password gate as a multi-user identity system
- Storing or publishing real provider credentials in repository files
- Claiming direct ChatGPT, Claude, Gemini, or Grok consumer-subscription OAuth where no provider-approved connector exists
- Treating the standalone KoboldCpp adapter as full parity with the integrated Google or AgentRouter chat paths

## Quality bar

Behavior changes should have focused regression evidence, and release-readiness work should pass typecheck, P0 checks, the full Bun test suite, the secret scanner, and the production build. User-visible changes also require browser verification at desktop and mobile widths.

## Data and privacy notes

Imported conversations can contain highly personal material. Tests, screenshots, documentation, and issues must use synthetic or non-sensitive data. Server processing should receive only the data required for the requested operation, and public artifacts must never contain real chat exports, cookies, API keys, or service-account material.
