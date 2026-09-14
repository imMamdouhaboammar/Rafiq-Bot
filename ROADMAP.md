# Roadmap

This roadmap describes direction, not a release schedule. Items may change as the code, provider policies, and contributor evidence change.

## Current priorities

1. Keep the public repository reproducible, secure, and understandable from a fresh clone.
2. Continue separating locale, culture, persona, provider, and UI language so Egyptian Arabic remains a first-class reference localization rather than a global assumption.
3. Consolidate inference behind clearer provider boundaries without weakening server-only credential handling.
4. Improve accessibility, responsive behavior, startup performance, and bundle size with measured regressions tests.
5. Strengthen import, memory, continuity, and persona behavior with deterministic tests and explicit data boundaries.

## Provider direction

Google Gemini API and Vertex AI are the current primary inference paths. AgentRouter is an optional gateway path. A tested KoboldCpp adapter exists but is not yet the main-chat provider selector. Direct consumer-subscription OAuth for ChatGPT, Claude, Gemini, or Grok is not a current Rafiq feature.

Future provider work should use `docs/providers/adding-a-provider.md`, preserve server-side credentials, and verify provider policy before any OAuth or subscription-based connector is shipped.

## Localization direction

The runtime now has neutral locale and timezone defaults plus explicit RTL/LTR resolution. A complete translated UI is still future work. New localization contributions should preserve the `ar-EG` reference experience while proving at least one LTR and one additional locale path.
