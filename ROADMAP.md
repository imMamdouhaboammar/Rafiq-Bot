# Roadmap

This roadmap describes direction, not a release schedule. Items may change as the code, provider policies, and contributor evidence change.

## Current priorities

1. Keep the public repository reproducible, secure, and understandable from a fresh clone.
2. Expand the structured `i18n/` message catalog across all secondary drawers and modals while preserving `en-US` as the global default and `ar-EG` as a first-class reference preset.
3. Consolidate inference behind clearer provider boundaries with resilient fallback chains and without weakening server-only credential handling.
4. Improve accessibility, responsive behavior, startup performance, and bundle size with measured regression tests.
5. Strengthen neuro-cognitive memory (v8), Boundless Storyteller continuity, `.rafiq.json` v2 portability, and cognitive pipeline verification.

## Provider direction

Google Gemini API and Vertex AI are the current primary inference paths. AgentRouter is an optional gateway path. A tested KoboldCpp adapter exists but is not yet the main-chat provider selector. Direct consumer-subscription OAuth for ChatGPT, Claude, Gemini, or Grok is not a current Rafiq feature.

Future provider work should use `docs/providers/adding-a-provider.md`, preserve server-side credentials, and verify provider policy before any OAuth or subscription-based connector is shipped.

## Localization direction

The runtime has neutral locale and timezone defaults (`en-US`, `UTC`, LTR), globally neutral default archetypes (`nova_default`, `alex_default`), and a structured message catalog boundary under `i18n/` (`en-US.json` and `ar-EG.json`). New localization contributions should wire remaining component strings through `i18n/` while preserving the `ar-EG` reference experience.
