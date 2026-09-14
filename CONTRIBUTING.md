# Contributing to Rafiq

Contributions are welcome when they are scoped, testable, and preserve the project's security and localization boundaries.

## Set up a fork

Fork `imMamdouhaboammar/Rafiq-Bot` on GitHub and clone the fork using the URL GitHub provides. Add this repository as an `upstream` remote if you want to keep your fork synchronized.

Use the Bun version pinned by `package.json#packageManager`; CI resolves the same version from that field.

```bash
cd Rafiq-Bot
bun install --frozen-lockfile
cp .env.example .env.local
```

Configure local secrets according to [docs/configuration/env-reference.md](docs/configuration/env-reference.md). Never commit `.env.local`, service-account files, private chat exports, or machine-specific paths.

## Branch and implementation discipline

Create a focused branch from current `main`. Inspect existing tests before changing behavior. Prefer a failing or characterization test before production code when the behavior has a practical test seam. Keep commits atomic and use clear conventional prefixes such as `feat:`, `fix:`, `docs:`, `test:`, and `refactor:`.

Do not mix unrelated cleanup into a feature pull request. Do not rewrite shared history or force push over another contributor's work.

## Verification

Run the checks that match your change and report exactly what you ran:

```bash
bun run typecheck
bun run test:p0
bun test
bun run security:scan
bun run build
```

For provider, environment, or localization changes, also update the relevant public contract docs and focused regression tests.

## Pull requests

Explain the problem, the chosen scope, test evidence, risks, and anything intentionally deferred. Screenshots must use synthetic or non-sensitive data. Call out security, persistence, provider, and RTL/LTR effects explicitly when they apply.

Use the repository pull request template. A green CI run is evidence, not a substitute for explaining behavior and risk.

## Provider contributions

Read [docs/providers/adding-a-provider.md](docs/providers/adding-a-provider.md). Do not copy OAuth client IDs from third-party CLIs, and do not describe a model gateway as direct vendor authentication.

## Localization contributions

Read [docs/localization/README.md](docs/localization/README.md). Preserve the `ar-EG` reference path while proving that shared runtime behavior works independently from it.

## Persona and soul contributions

Persona presets live in `services/soulRegistry.ts` and consume the shared `BotSettings`/soul contracts in `types.ts`. Keep a preset explicit about its intended culture instead of changing global defaults to make one persona work. Add or update focused tests when a preset changes runtime behavior, and verify that another locale does not inherit culture-specific framing by accident.

A new preset should have a distinct use case rather than duplicating an existing personality with different marketing copy. Clone-derived personas use the `custom_clone` path and should not be converted into hardcoded presets.

## Tool contributions

The current realtime tool path is under `services/tools/`, with intent routing in `toolRouter.server.ts` and orchestration in `services/geminiService.server.ts`. Add tools server-side, validate untrusted inputs at the boundary, make unavailable external services fail honestly, and extend `toolTypes.ts` plus persisted tool metadata only when the new tool is actually reachable.

Test routing, result formatting, failure behavior, and at least one real integration chain without mocking every participating layer. Do not place provider credentials or Node-only tool dependencies in browser-facing components.

## Conduct and support

Participation is covered by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). For setup questions and issue routing, see [SUPPORT.md](SUPPORT.md). Security findings belong in the private process described by [SECURITY.md](SECURITY.md).
