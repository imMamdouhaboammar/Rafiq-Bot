# Development Guide

How the codebase is organized, the conventions that hold it together, and how to add new features.

---

## Project structure at a glance

```
rafiq/
├── App.tsx                  Root component (PasswordGate → RafiqApp)
├── index.tsx                ReactDOM entry point, PWA service-worker lifecycle
├── index.html               Vite HTML shell
├── index.css                Global styles (Tailwind utility imports)
├── server.ts                Express 5 dev server — Vite middleware + /api/* routes
├── types.ts                 All shared types and Zod schemas (single source of truth)
├── vercel.json              Deployment config — function timeouts, SPA rewrite
├── vite.config.ts           Vite config — port 3000, host 0.0.0.0, @ alias
│
├── api/                     Vercel Serverless Functions (production)
│   ├── auth-login.ts        POST — verify password, set signed cookie
│   ├── gemini.ts            POST — action dispatch table
│   ├── gemini-stream.ts     POST — SSE streaming
│   └── capability-test.ts   GET  — reachability probe
│
├── components/              UI components (rendering only, no business logic)
├── hooks/                   React controllers (stateful glue)
├── stores/                  Zustand global state
├── services/                Business logic (110+ modules)
│   ├── tools/               Gemini function-calling tool implementations
│   ├── souls/               Additional built-in soul definitions
│   ├── conversationDynamics/  Conversation planning and safety subsystem
│   └── webReader/           URL fetch helpers for the web reader tool
├── workers/                 Web Workers (off-main-thread processing)
├── utils/                   Utility functions
├── tests/                   All test files
├── contracts/               Zod contract schemas (e.g. rafiqV6.ts)
├── public/                  Static assets, PWA manifest, service worker
└── Soul Files/              Raw persona dossiers (JSON + prose)
```

---

## Core conventions

### Server / client file split

The most important convention in this codebase:

| Suffix | Where it runs | May import |
|--------|--------------|-----------|
| `*.server.ts` | Server only | `node:*`, Redis, Google SDK service accounts, `services/env.server.ts` |
| `*.ts` | Browser + server | Browser-safe APIs only. No `node:crypto`, no `fs`, no Redis |

Vite excludes `*.server.ts` from the browser bundle. Never import a `.server.ts` file from a `.ts` file that will run in the browser.

### Types are centralized

`types.ts` is the **single source of truth** for all shared types and Zod schemas:

- `ChatSession`, `ChatMessage`, `UserProfile`, `MemoryEntry` — core domain types
- `PsychologicalStateSchema`, `SoulTraits`, `SoulDefinition` — Soul Engine types
- `BotMood`, `AppMode`, `RelationType`, `Dialect` — enums
- `CloneProfileSchema`, `CloneAnalysisProgressSchema` — Clone Pipeline types

Services import from `types.ts`. They do not define their own parallel type shapes.

### Event-driven UI updates

Never call `setState` across unrelated components. Instead:

```typescript
// Emitter
import { eventBus } from './services/eventBus';
eventBus.emit('ui:toast', { message: 'Done!', type: 'success' });

// Listener
import { useEvent } from './hooks/useEvent';
useEvent('ui:toast', (payload) => { /* handle */ });
```

All event names follow `domain:action` convention. Valid domains: `chat`, `ai`, `persona`, `group`, `import`, `ui`, `system`.

### Zod at every boundary

Every piece of data that crosses a trust boundary (DB read, server response, RPC payload) is validated with a Zod schema from `types.ts` or `contracts/`.

### Stores are flat

One Zustand store per domain:
- `stores/useRafiqStore.ts` — chats, activeChatId, messagesByChat, typingByChat
- `stores/groupStore.ts` — group members, reactions
- `stores/composerAttachmentUiStore.ts` — attachment composer state

Slices are kept small and orthogonal. Do not merge unrelated state into one store.

---

## Adding a new Gemini action

Actions on `POST /api/gemini` are registered in two places:

**1. `api/gemini.ts` — production (Vercel)**

```typescript
const ACTIONS = {
  myNewAction: GeminiServerService.myNewAction,
  // ...
} as const;
```

**2. `server.ts` — development (Express)**

```typescript
const actions = {
  ...GeminiServerService,
  myNewAction: GeminiServerService.myNewAction,
};
```

The client calls it via `services/geminiService.ts`:

```typescript
// services/geminiService.ts
export const myNewAction = async (arg: string) => {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    body: JSON.stringify({ action: 'myNewAction', args: [arg] }),
  });
  const data = await response.json();
  return data.result;
};
```

---

## Adding a new Soul

1. Create `services/souls/yourSoulName.ts` exporting a `SoulDefinition` (from `types.ts`).
2. Register it in `services/soulRegistry.ts`.
3. Optionally add a JSON dossier to `Soul Files/` for the clone synthesizer.

---

## Adding a new UI component

1. Create `components/MyComponent.tsx`.
2. Keep it rendering-only — no direct Dexie access, no fetch calls.
3. Read state from Zustand (`stores/useRafiqStore.ts`) or receive it as props.
4. Emit events via `eventBus.emit()` for cross-component side effects.
5. Write a reachability test in `tests/myComponentReachability.test.ts`.

---

## Adding a new tool (Gemini function calling)

1. Create `services/tools/myTool.server.ts` — export a `ToolDefinition` and handler.
2. Register it in `services/tools/toolRouter.server.ts`.
3. Add types to `services/tools/toolTypes.ts` if needed.
4. Write a test in `tests/realtimeTools.test.ts` or a new file.

---

## Dev server details

`server.ts` runs Express 5 with two modes:

| `NODE_ENV` | Behavior |
|------------|---------|
| `development` | Vite in middleware mode — HMR, hot reload, no `dist/` needed |
| `production` | Serves `dist/` statically + `/api/*` routes |

**Port:** 3000 (configurable via `PORT` env var)  
**Body limit:** 50mb (for base64 image payloads)

Cache-Control headers are set to `no-store` in development to prevent stale Vite-served assets.

---

## TypeScript type-checking

```bash
npm run typecheck   # tsc --noEmit (no emit — Vite owns the build)
```

5 test files are excluded from type-checking in `tsconfig.json` due to mock patterns:
- `tests/koboldInferenceProvider.test.ts`
- `tests/lorebookEngine.test.ts`
- `tests/reflectionEngine.test.ts`
- `tests/roleplayEngine.test.ts`
- `tests/socialHeartbeat.test.ts`

---

## Build

```bash
bun run build   # vite build → dist/
```

Output goes to `dist/`. The SPA entry is `index.html`. Vercel deploys from `dist/`.

---

## Path alias

`@` maps to the project root in both Vite (`vite.config.ts`) and TypeScript (`tsconfig.json`):

```typescript
import { ChatSession } from '@/types';       // → ./types.ts
import { db } from '@/services/db';          // → ./services/db.ts
```

---

## Security scan

```bash
npm run security:scan   # checks for tracked secrets + scans for API key patterns
```

Run this before every commit. The scan uses `scripts/security/` to detect accidentally committed credentials.
