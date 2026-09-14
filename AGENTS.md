# Rafiq-Bot Agent Contract

Rafiq-Bot is a TypeScript/React/Vite/Express AI companion application with browser-local state, server-side inference integrations, configurable personas, memory, tools, and optional remote services.

## Read first

Before changing behavior, inspect `README.md`, `PRODUCT.md`, `DESIGN.md`, `docs/architecture/overview.md`, the affected source files, and their existing tests.

## Canonical commands

- Install: `bun install`
- Development: `bun run dev`
- Typecheck: `npm run typecheck`
- P0 checks: `npm run test:p0`
- Full tests: `npm test`
- Security scan: `npm run security:scan`
- Production build: `bun run build`

## Architecture boundaries

- `components/`, `hooks/`, and `stores/` are browser-facing code. Keep server credentials and Node-only dependencies out of the browser bundle.
- Files ending in `.server.ts` are server-only. Do not import them from client code.
- `api/` and `server.ts` own server HTTP boundaries. Validate untrusted input before it reaches provider or persistence code.
- IndexedDB/Dexie is the local browser state authority. Optional Redis-backed features must fail closed or degrade honestly when not configured.
- Reuse existing contracts in `types.ts` and `contracts/` rather than creating duplicate shapes.
- Use `services/eventBus.ts` for existing cross-feature event flows when that is already the local pattern.

## Configuration and secrets

- Never commit `.env`, `.env.local`, credentials, tokens, service-account files, private keys, personal filesystem paths, or real user data.
- `.env.example` is the public environment-variable schema. `docs/configuration/env-reference.md` is its human-readable reference. `tests/envContract.test.ts` prevents drift between runtime reads, the example, and the docs.
- Agent Kernel is optional local maintainer tooling. Its vault, global rules, and machine-specific state are never repository content.
- If a credential may have entered Git history, report the credential type without printing its value. Do not rewrite history or rotate secrets without explicit maintainer authorization.

## Localization and cultural behavior

- Keep locale, timezone, UI direction, conversational language, culture, persona, and provider as separate concepts.
- Egyptian Arabic is a first-class reference preset and part of Rafiq's origin. Do not hardcode it into global behavior that is expected to work for other locales.
- Preserve both RTL and LTR behavior when changing shared UI or conversational infrastructure.

## Implementation discipline

- Preserve existing behavior unless the task explicitly changes it.
- For behavior changes, inspect existing tests first and prefer a failing or characterization test before production changes.
- Keep changes scoped. Avoid unrelated refactors and speculative abstractions.
- Test through public seams. Add integration coverage when a change crosses server/client, provider, persistence, middleware, or tool boundaries.
- Stage only work-owned files. Use atomic commits with clear conventional messages.

## Definition of done

A change is complete only when its focused tests pass, typecheck passes, relevant security checks pass, the production build succeeds when applicable, and `git diff --check` is clean. User-visible changes also require responsive and accessibility verification at the affected surface. Report anything that could not be verified.
