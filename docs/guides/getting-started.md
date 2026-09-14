# Getting started

This guide starts Rafiq from a fresh clone without relying on machine-specific configuration.

## 1. Clone and install

```bash
git clone https://github.com/imMamdouhaboammar/Rafiq-Bot.git
cd Rafiq-Bot
bun install --frozen-lockfile
```

## 2. Create local configuration

```bash
cp .env.example .env.local
```

For an AI-backed local chat, configure one Google inference path and the app access gate. The simplest inference path is `GEMINI_API_KEY`. The access gate requires both a SHA-256 password digest and an independent session secret.

```env
GEMINI_API_KEY=
RAFIQ_APP_PASSWORD_HASH=
RAFIQ_APP_SESSION_SECRET=
```

You can generate a local password digest with any SHA-256 utility and generate the session secret with a cryptographically secure random generator. Do not reuse the password digest as the session secret. Do not paste either value into issues, screenshots, or documentation.

For Vertex AI, Redis, AgentRouter, search, LangCache, and locale variables, use the [environment reference](../configuration/env-reference.md).

## 3. Start the development server

```bash
bun run dev
```

Open `http://localhost:3000` and enter the local password whose SHA-256 digest you configured. Development and production both enforce the password configuration; there is no documented bypass mode.

## 4. Create a companion

Create a new chat from the interface, choose or author a persona, and start a conversation. Egyptian Arabic presets remain available, but the shared runtime defaults to `en-US`, `UTC`, and LTR unless another locale is selected.

## 5. Verify the checkout

```bash
bun run typecheck
bun run test:p0
bun test
bun run security:scan
bun run build
```

## Next steps

- [Development guide](development.md)
- [Testing guide](testing.md)
- [Architecture overview](../architecture/overview.md)
- [Provider matrix](../providers/README.md)
- [Localization](../localization/README.md)
- [Deployment](../deployment/deployment.md)
