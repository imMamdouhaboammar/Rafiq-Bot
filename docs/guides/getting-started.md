# Getting Started

Get Rafiq running locally in under 5 minutes.

---

## Prerequisites

- **Node.js ≥ 20** — Vite 6 and React 19 both require it
- **Bun** (recommended) or npm — Bun is faster for install and dev scripts
- **A Gemini API key** — get one free at [Google AI Studio](https://aistudio.google.com/)

---

## 1. Clone the repository

```bash
git clone <repo-url>
cd rafiq
```

---

## 2. Install dependencies

```bash
bun install
```

---

## 3. Configure environment

```bash
cp .env.example .env.local
```

Open `.env.local` and set at minimum:

```env
GEMINI_API_KEY=your-key-here
```

That is the only required value for local development. The password gate accepts any input when `RAFIQ_APP_PASSWORD_HASH` is not set.

> For a full list of all supported variables, see [`docs/configuration/env-reference.md`](../configuration/env-reference.md).

---

## 4. Start the dev server

```bash
bun run dev
```

This starts Express 5 with Vite in middleware mode on **http://localhost:3000**. Both the SPA and the `/api/*` backend run on the same port.

---

## 5. Open the app

Navigate to **http://localhost:3000**.

On first load you will see the **PasswordGate** screen (`components/PasswordGate.tsx`). In development without `RAFIQ_APP_PASSWORD_HASH` set, any password is accepted.

---

## 6. Create your first companion

1. Click **New Chat** in the sidebar.
2. Choose a soul template (Amira is the default Egyptian companion).
3. Select a dialect, relationship type, and name.
4. Start chatting.

---

## Optional: Set up the password gate for production use

Generate a SHA-256 hash of your chosen password:

```bash
echo -n "mypassword" | shasum -a 256
# a94a8fe5ccb19ba61c4c0873d391e987982fbbd3  -
```

Add to `.env.local`:

```env
RAFIQ_APP_PASSWORD_HASH=a94a8fe5ccb19ba61c4c0873d391e987982fbbd3
RAFIQ_APP_SESSION_SECRET=some-long-random-string-at-least-32-chars
```

---

## Optional: Enable vector memory

Requires a Redis connection (Redis Stack locally, or Redis Iris managed):

```env
RAFIQ_VECTOR_MEMORY_ENABLED=true
REDIS_URL=redis://localhost:6379
```

---

## Run the test suite

```bash
npm run test:p0   # fast P0 gate (security + core unit tests)
npm test          # full suite (110 test files)
```

---

## Next steps

- [`docs/guides/development.md`](development.md) — project structure and how to add features
- [`docs/guides/testing.md`](testing.md) — test runner details and test categories
- [`docs/architecture/overview.md`](../architecture/overview.md) — full architecture reference
