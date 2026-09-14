# Rafiq (رفيق)

[![CI](https://github.com/imMamdouhaboammar/Rafiq-Bot/actions/workflows/ci.yml/badge.svg)](https://github.com/imMamdouhaboammar/Rafiq-Bot/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Rafiq is an open-source, local-first AI companion application built with TypeScript, React, Vite, Express, and Bun. The core combines configurable personas, conversation continuity, memory, tools, media workflows, and WhatsApp-export persona analysis without making one locale or one provider the whole product identity.

Egyptian Arabic is the first and most developed reference localization. The runtime now separates locale, timezone, text direction, culture, conversation language, and search region so other localizations can be added without inheriting Egyptian defaults.

## What exists today

- Streaming companion chat with persona and relationship context
- Browser-local persistence through Dexie and IndexedDB
- Optional Redis-backed vector memory and semantic cache paths
- WhatsApp text export parsing and progressive persona analysis
- Group conversation orchestration and continuity features
- Image and media workflows routed through the current Google inference stack
- Realtime time, web search, and URL-reading tools
- Google Gemini API or Vertex AI as the primary inference path
- Optional AgentRouter gateway support for recognized model IDs
- A tested KoboldCpp adapter that is not yet wired into the main chat provider selector
- Neutral runtime defaults with `ar-EG` preserved as a first-class reference culture

See [PRODUCT.md](PRODUCT.md) for product boundaries and [docs/architecture/overview.md](docs/architecture/overview.md) for the runtime map.

## Quick start

### Prerequisites

Use Bun for the repository workflow. The current lockfile is `bun.lock`. You also need one configured Google inference path: a Gemini API key or Vertex AI credentials.

```bash
git clone https://github.com/imMamdouhaboammar/Rafiq-Bot.git
cd Rafiq-Bot
bun install --frozen-lockfile
cp .env.example .env.local
```

For local use, configure an AI path plus the app access gate in `.env.local`:

```env
GEMINI_API_KEY=
RAFIQ_APP_PASSWORD_HASH=
RAFIQ_APP_SESSION_SECRET=
```

`RAFIQ_APP_PASSWORD_HASH` must be a SHA-256 hex digest. `RAFIQ_APP_SESSION_SECRET` must be an independent value of at least 32 characters. If you use Vertex AI instead of `GEMINI_API_KEY`, follow the [environment reference](docs/configuration/env-reference.md). Never commit `.env.local`.

Start the combined Express and Vite development server:

```bash
bun run dev
```

Open `http://localhost:3000`.

## Verification

```bash
bun run typecheck
bun run test:p0
bun test
bun run security:scan
bun run build
```

The full test command uses Bun test discovery, so new `*.test.ts` files do not need a hardcoded count in documentation.

## Providers

Provider status is documented from reachable code, not from model names:

- [Provider matrix](docs/providers/README.md)
- [Adding a provider](docs/providers/adding-a-provider.md)

Direct consumer-subscription OAuth for ChatGPT, Claude, Gemini, or Grok is not a current Rafiq feature. A model name exposed through AgentRouter is not the same thing as direct authentication with that model vendor.

## Localization

The global runtime defaults are `en-US`, `UTC`, and LTR. Egyptian Arabic remains a bundled reference path and can explicitly enable Egypt-specific conversational and cultural behavior. The interface still contains Arabic strings, so Rafiq should not yet be described as a fully translated application.

See [docs/localization/README.md](docs/localization/README.md).

## Documentation

- [Documentation index](docs/README.md)
- [Getting started](docs/guides/getting-started.md)
- [Development guide](docs/guides/development.md)
- [Testing guide](docs/guides/testing.md)
- [Environment reference](docs/configuration/env-reference.md)
- [Deployment](docs/deployment/deployment.md)
- [API reference](docs/api/api-reference.md)
- [Agent Kernel maintainer workflow](docs/guides/agent-kernel.md)

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Use [SUPPORT.md](SUPPORT.md) for support routing and [SECURITY.md](SECURITY.md) for private vulnerability reporting. Community participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

The project deliberately keeps secrets, service-account files, private chat data, and machine-local Agent Kernel state outside the repository.

## License

Rafiq is licensed under the [MIT License](LICENSE).
