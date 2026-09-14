# Testing guide

Rafiq uses a mix of Bun test files and executable TypeScript regression scripts. The repository-level full-suite command is Bun test discovery, while `test:p0` is the smaller critical gate used for fast feedback.

## Commands

```bash
bun run test:p0
bun test
bun run typecheck
bun run security:scan
```

Run a focused Bun test file with:

```bash
bun test tests/localizationRuntime.test.ts
```

Many standalone assertion scripts can also be run directly with `tsx`:

```bash
bunx tsx tests/envContract.test.ts
```

## Test categories

- Unit and policy tests exercise a service or pure contract in isolation.
- Reachability tests read source and verify critical UI or RPC wiring.
- Integration tests exercise multi-module flows such as attachments, cloning, groups, continuity, or transfer.
- OSS contract tests verify environment documentation, agent instructions, localization, and public documentation.
- Security scripts validate tracked-file safety and scan repository sources and Git history for secret patterns.

Do not hardcode the number of test files in docs or PRs. Bun discovery changes as coverage grows.

## Behavior changes

Inspect existing tests before implementation. Prefer an existing failing test, a strengthened expectation, or a new focused failing test before changing production behavior. For pure documentation, generated assets, or manual-only visual work, record the replacement verification instead.

When a change crosses server/client, provider, persistence, middleware, or tool boundaries, add or run at least one test that exercises the real chain rather than mocking every layer.

## Test environment

`tests/setupEnv.ts` provides test-only configuration for server-side tests. Values in test fixtures must remain synthetic. A test token should never be shaped like a production secret if the repository secret scanner will correctly flag it.

## Typecheck exclusions

`tsconfig.json` explicitly excludes a small set of tests whose mocks conflict with strict DOM typings. They still run at test time. Treat that list as code-owned configuration rather than repeating a count in documentation.

## Before a pull request

Run focused tests while working, then run `bun run test:p0`, `bun test`, `bun run typecheck`, `bun run security:scan`, and `bun run build` for release-oriented changes.
