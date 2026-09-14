# Architecture Overview

Rafiq is a single-codebase full-stack application: a React 19 SPA in the browser served alongside an Express 5 server in development, and Vercel Serverless Functions in production. All source lives in one TypeScript project with a strict `.server.ts` / `.ts` file split that Vite and esbuild enforce at build time.

---

## High-level topology

```
Browser (React SPA)          Server
────────────────────         ─────────────────────────────────────
index.tsx                    dev:  server.ts (Express 5 + Vite middleware)
  └─ App.tsx                 prod: api/*.ts (Vercel Functions)
       ├─ PasswordGate.tsx         │
       └─ RafiqApp                 │
            ├─ hooks/use*.ts ──HTTPS /api/*──► assertAppSession
            ├─ stores/             │              └─► dispatch table
            └─ components/         │                   ├─ geminiService.server.ts
                                   │                   ├─ reflectionEngine.server.ts
                                   │                   ├─ soulSynthesizer.server.ts
                                   │                   ├─ tools/toolRouter.server.ts
                                   │                   └─ progressiveCloneAnalysis.server.ts
                                   │
                               External
                                   ├─ Gemini API / Vertex AI
                                   └─ Redis (vector memory, LangCache — optional)
```

**Local state authority:** Dexie 4 (IndexedDB) via `services/db.ts`. The server is stateless per-request by default; all chat persistence happens client-side in IndexedDB.

---

## Layer map

| Layer | Files | Responsibility |
|-------|-------|---------------|
| **Entry** | `index.tsx`, `index.html` | ReactDOM bootstrap, PWA service-worker registration |
| **Root component** | `App.tsx` | `PasswordGate` → `RafiqApp`; mounts all top-level views |
| **UI components** | `components/*.tsx` | Rendering only — no business logic, no direct DB access |
| **Controllers (hooks)** | `hooks/use*.ts` | Stateful glue between UI, Zustand store, services, and `/api/*` |
| **Global state** | `stores/useRafiqStore.ts`, `stores/groupStore.ts` | Zustand stores — chats, messages, active chat, group state |
| **Event bus** | `services/eventBus.ts` | Typed mitt emitter mirrored into an RxJS Subject |
| **Services (client)** | `services/*.ts` (no `.server.` suffix) | Browser-safe business logic |
| **Services (server)** | `services/*.server.ts` | Server-only code; imports `node:crypto`, Redis, Google SDKs |
| **API routes (prod)** | `api/*.ts` | Vercel Functions — validate cookies and delegate to services |
| **API routes (dev)** | `server.ts` | Express 5 — same delegations, plus Vite middleware |
| **Types** | `types.ts` | Single source of truth: every shared type + Zod schema |
| **Local DB** | `services/db.ts` | Dexie schema (v1→v6 migrations), per-entity CRUD helpers |
| **Workers** | `workers/attachmentDerivatives.worker.ts` | Off-main-thread attachment processing |

---

## Component map

```
index.tsx
  └─ App.tsx
       ├─ PasswordGate.tsx        (auth gate before anything renders)
       └─ RafiqApp
            ├─ hooks/useAppController.ts   (boot, cloud pull, offline simulation)
            ├─ hooks/useChatController.ts  (per-chat streaming state machine)
            ├─ hooks/useGroupController.ts (N-persona group routing)
            ├─ hooks/useEvent.ts           (event bus subscriptions)
            │
            ├─ components/Sidebar.tsx
            ├─ components/ChatInterface.tsx
            │    └─ components/ChatBubble.tsx
            ├─ components/NewChatModal.tsx
            ├─ components/LiveVoice.tsx
            ├─ components/UserProfileModal.tsx
            ├─ components/BotStoryPanel.tsx
            ├─ components/StatusViewer.tsx
            ├─ components/MemoryInspector.tsx
            ├─ components/HumanIdTimeline.tsx
            ├─ components/ToastHost.tsx
            └─ components/EventConsole.tsx
```

---

## Data flow — chat request lifecycle

```
User types → useChatController → Dexie (persist user msg)
                              → POST /api/gemini-stream (cookie)
                                     │
                                assertAppSession (HMAC cookie check)
                                     │
                              geminiService.server.ts
                                     ├─ recall memory (local or Redis vector)
                                     ├─ tool calls (web_search, current_time, …)
                                     └─ streamGenerateContent → Gemini API
                                            │
                                   SSE text/event-stream chunks
                                            │
                              useChatController (accumulates)
                                     ├─ Dexie (persist partial)
                                     └─ Zustand store (re-renders ChatBubble)
                                            │
                                   data: [DONE]
                                            │
                              useChatController
                                     └─ Dexie (finalize assistant message)
```

---

## Key subsystems

### Soul Engine

Each AI persona is a `SoulDefinition` (defined in `types.ts`):

```typescript
interface SoulDefinition {
  id: string;
  name: string;
  description: string;
  emoji: string;
  baseTraits: SoulTraits; // chaos, empathy, slang, intellect, positivity — each 0–100
  systemPromptBase: string;
  vibe?: string;
  tempo?: string;
  attachmentStyle?: string;
  conflictStyle?: string;
  strengths?: string[];
  blindSpots?: string[];
  signatureBehaviors?: string[];
}
```

**Soul trait axes** (`types.ts: SoulTraits`):

| Trait | Range | Low end → High end |
|-------|-------|-------------------|
| `chaos` | 0–100 | Logical → Unhinged |
| `empathy` | 0–100 | Cold → Therapist |
| `slang` | 0–100 | Formal → Street |
| `intellect` | 0–100 | Simple → Philosopher |
| `positivity` | 0–100 | Depressed → Manic |

**Dialect** (`types.ts: Dialect` enum): `cairo_modern`, `alexandrian`, `saidi`, `fusha_light`, `franko`

Built-in souls:
- **Amira** — default kernel in `services/soul.ts` and JSON dossiers in `Soul Files/`
- **Chaotic Bestie** — `services/souls/chaoticBestie.ts`

`services/soulRegistry.ts` — active soul registry  
`services/soulSynthesizer.server.ts` — builds `SoulBlueprint` from a WhatsApp export using Gemini

---

### Psychological State Machine

Every chat session's `PsychologicalState` persists in Dexie and evolves between sessions. Defined by `PsychologicalStateSchema` in `types.ts`:

| Field | Type | What it tracks |
|-------|------|---------------|
| `mood` | `BotMood` enum | happy, sad, angry, excited, romantic, anxious, neutral, playful, bored, hangry, broke |
| `energyLevel` | number 0–10 | Available engagement capacity |
| `socialMeter` | number 0–10 | Desire to interact |
| `emotionalLedger` | number −100–100 | Cumulative interaction balance |
| `intimacyLevel` | number 0–100 | Relationship depth milestone |
| `hungerLevel` | number 0–100 | Physical state |
| `financialStress` | number 0–100 | Economic anxiety signal |
| `sleepiness` | number 0–100 | Fatigue state |
| `breakpointState` | `'none' \| 'disappointed'` | Relationship rupture signal |

`services/dynamicEngines.ts` — mutation logic between sessions  
`services/livingPersonaCore.ts` — applies `AdaptivePersonalityMutation` (adjusts warmth, humor, directness, expressiveness, initiative facets based on conversation evidence)

---

### Memory Engine

Three memory stores run in parallel:

| Store | Location | Scope | Persistence |
|-------|----------|-------|-------------|
| Extracted facts | `services/memoryEngine.ts` + Dexie | Per-chat | IndexedDB |
| Graph memory | `services/graphMemory.server.ts` | Relationship graph | Server-side (session) |
| Vector memory | `services/redisVectorMemory.server.ts` | Semantic search | Redis (optional) |

`services/memoryPolicy.ts` — what gets extracted and retained  
`services/memoryRepository.ts` — Dexie read/write for `MemoryEntry` records

`MemoryEntry` categories: `identity`, `preference`, `memory`, `goal`, `fact`, `emotion`, `general`

---

### Clone Pipeline

Converts a WhatsApp `.txt` export into a live persona:

```
services/whatsappImporter.server.ts          parse raw .txt, extract participants
            ↓
services/chatStatistics.ts                   per-participant linguistic stats
            ↓
services/progressiveCloneAnalysis.server.ts  batch Gemini analysis (streamed)
            ↓
services/soulSynthesizer.server.ts           build SoulBlueprint (CloneProfile)
            ↓
services/personaEngine.ts                    instantiate persona with blueprint
```

`ProgressiveCloneJob` (Dexie) tracks progress across page refreshes. The UI streams `CloneAnalysisProgressSchema` events.

---

### Group Chat Engine

Orchestrates conversations with N AI personas simultaneously:

| Module | Purpose |
|--------|---------|
| `services/groupEngine.ts` | Orchestration coordinator |
| `services/conversationRouter.ts` | Which persona(s) should respond |
| `services/responseRouter.ts` | Routes responses to the correct UI slot |
| `services/groupTurnCoordinator.ts` | Prevents simultaneous replies, manages turn order |
| `services/personaMind.ts` | Per-persona cognitive state |
| `hooks/useGroupController.ts` | React controller for group chat UI |
| `stores/groupStore.ts` | Zustand state for group members and reactions |

---

### Realtime Tool Calling

`services/tools/toolRouter.server.ts` exposes Gemini function-calling tools. The client never invokes tools directly.

| Tool name | File | What it does |
|-----------|------|-------------|
| `current_time` | `timeTool.server.ts` | Returns date/time using the resolved runtime locale and timezone |
| `web_search` | `webSearchTool.server.ts` | Optional search via configured Tavily, SerpAPI, Google Custom Search, Brave, or Bing provider |
| `open_url` | `webReaderTool.server.ts` | Fetch and extract text from a URL |
| `search_and_read` | `webReaderTool.server.ts` | Combined search + URL read |
| `research_tool` | `researchTool.server.ts` | Multi-step research synthesis |
| `baladi_nutrition` | `baladiNutritionTool.ts` | Egyptian food nutritional data |

---

### Human Realism Layer

| Module | File | Effect |
|--------|------|--------|
| Message burst | `services/messageBurst.ts` | Splits one response into 3–5 bubbles |
| Fragmented delivery | `services/humanRealism.ts` | Typos, emoji protocol, cadence variation |
| Cadence maestro | `services/cadenceMaestro.ts` | Per-persona timing model |
| Egyptian spintax | `services/egyptianSpintaxEngine.ts` | Dialect phrase variation |
| Conversation dynamics | `services/conversationDynamics/` | Planning, relational moves, safety gate |

---

### Event Bus

`services/eventBus.ts` — typed mitt emitter + RxJS Subject:

```typescript
eventBus.emit('ai:response_ready', payload);
eventBus.observe('ai:response_ready').subscribe(handler);
```

Event domains: `chat:*`, `ai:*`, `persona:*`, `group:*`, `import:*`, `ui:*`, `system:*`

`components/EventConsole.tsx` — runtime inspector for the event bus.

---

### Auth Model

1. `POST /api/auth-login` — verifies app password against `RAFIQ_APP_PASSWORD_HASH` (SHA-256 hex), returns HMAC-signed cookie using `RAFIQ_APP_SESSION_SECRET`
2. All other `/api/*` routes — call `assertAppSession(req)` from `services/appAuth.server.ts`
3. Browser never receives Gemini API keys or Redis credentials — all secrets are server-only

---

## Build & runtime split

| Environment | Server | Launch command |
|-------------|--------|---------------|
| Development | `server.ts` — Express 5 + `tsx`, Vite middleware | `bun run dev` |
| Production | `api/*.ts` Vercel Functions with local structural request/response types | `vercel deploy` |

**File naming convention:**
- `services/foo.server.ts` — server-only. May import `node:*`, Redis, Google service account credentials.
- `services/foo.ts` — isomorphic. Must not import `node:crypto`, `fs`, or server-only SDKs.
- Vite excludes `.server.ts` files from the browser bundle.

`vite.config.ts`: port 3000, host `0.0.0.0`, `@` alias maps to project root.

---

## TypeScript configuration

- Target: **ES2022**, module: **ESNext**, resolution: **bundler**
- `@/*` alias → project root (`./`)
- `allowImportingTsExtensions: true` — allows importing `.ts` files directly (Vite resolves them)
- `noEmit: true` — Vite owns the emit; `tsc` is type-check only
- Test-only mock-heavy modules may be excluded from type-checking; `tsconfig.json` is the canonical exclusion list

---

## Local database schema (Dexie v6)

`services/db.ts` manages `RafiqDatabase`:

| Table | Key | Stores |
|-------|-----|--------|
| `chats` | `id` | `ChatSession` records |
| `messages` | `id` | `ChatMessage`, indexed by `chatId` |
| `userProfile` | `id` | Single `UserProfile` record |
| `memoryEntries` | `id` | `MemoryEntry`, indexed by `chatId` |
| `randomPrompts` | `id` | `RandomPrompt` records |
| `capabilityHealth` | `key` | Feature flag health per capability |
| `progressiveCloneJobs` | `id` | Clone job progress state |
| `progressiveCloneStaging` | `id` | Transactional staging for clone commits |
| `socialAgencySettings` | `id` | Per-bot social agency config |
| `storyStates` | `chatId` | `ActiveStoryState` for slow-burn story mode |
| `attachments` | `id` | OPFS attachment metadata |

All records are validated through Zod schemas (defined in `types.ts`) before persistence.
