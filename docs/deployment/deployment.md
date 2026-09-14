# Deployment

Rafiq is wired for **Vercel** out of the box. The `vercel.json` at the project root configures the build, function timeouts, and SPA routing.

---

## Vercel deployment

### What gets deployed

| What | How |
|------|-----|
| Static SPA | `vite build` → `dist/` (configured as `outputDirectory` in `vercel.json`) |
| Serverless Functions | `api/*.ts` — Vercel auto-detects TypeScript files in `api/` |

`vercel.json` configuration:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "functions": {
    "api/gemini.ts": { "maxDuration": 60 },
    "api/gemini-stream.ts": { "maxDuration": 120 }
  },
  "rewrites": [
    { "source": "/((?!api/.*).*)", "destination": "/index.html" }
  ]
}
```

- `api/gemini.ts` — 60 second max (non-streaming Gemini calls including soul synthesis and image generation)
- `api/gemini-stream.ts` — 120 second max (SSE streaming chat completions)
- The rewrite rule sends all non-`/api/*` paths to `index.html` for SPA client-side routing

### Deploy steps

1. Push to your connected Git branch (GitHub, GitLab, or Bitbucket)
2. Vercel runs the configured `npm run build` command → `vite build`
3. Output is deployed from `dist/`
4. `api/*.ts` files are deployed as Serverless Functions

Or deploy manually:

```bash
vercel deploy
```

---

## Required environment variables (Vercel dashboard)

Set these in **Project Settings → Environment Variables** on Vercel. Never commit real values to the repository.

### Always required

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google AI Studio API key **or** use Vertex AI vars below |
| `RAFIQ_APP_PASSWORD_HASH` | SHA-256 hex of the app password |
| `RAFIQ_APP_SESSION_SECRET` | HMAC signing key (≥32 random chars) |

### Vertex AI (alternative to Gemini API)

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLOUD_PROJECT` | GCP project ID |
| `GOOGLE_CLOUD_LOCATION` | Region (default: `global`) |
| `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` | Base64-encoded service account JSON (recommended for Vercel) |

### Optional — web search

| Variable | Description |
|----------|-------------|
| `RAFIQ_WEB_SEARCH_PROVIDER` | Search provider |
| `RAFIQ_WEB_SEARCH_API_KEY` | API key |
| `RAFIQ_WEB_SEARCH_ENGINE_ID` | Engine ID |
| `RAFIQ_WEB_SEARCH_LOCALE` | Optional override; blank derives from the runtime locale |
| `RAFIQ_WEB_SEARCH_REGION` | Optional override; blank derives from the locale region |

### Optional — vector memory (Redis)

| Variable | Description |
|----------|-------------|
| `RAFIQ_VECTOR_MEMORY_ENABLED` | Set to `true` to enable |
| `REDIS_URL` | Redis connection string (self-hosted Redis Stack) |
| `REDIS_AGENT_MEMORY_API_KEY` | Redis Iris API key |
| `REDIS_AGENT_MEMORY_SERVER_URL` | Redis Iris server URL |
| `REDIS_AGENT_MEMORY_STORE_ID` | Store ID |
| `RAFIQ_EMBEDDING_MODEL` | Default: `gemini-embedding-001` |
| `RAFIQ_EMBEDDING_DIM` | Default: `768` |
| `RAFIQ_VECTOR_RETRIEVAL_LIMIT` | Default: `5` |
| `RAFIQ_VECTOR_MAX_DISTANCE` | Default: `0.62` |

### Optional — LangCache

| Variable | Description |
|----------|-------------|
| `RAFIQ_LANGCACHE_ENABLED` | Set to `true` to enable |
| `RAFIQ_LANGCACHE_TTL_MS` | Default: `604800000` |

> For the full variable reference with types, defaults, and effects, see [`docs/configuration/env-reference.md`](../configuration/env-reference.md).

---

## Local production build

To test the production build locally:

```bash
bun run build           # compiles SPA to dist/
NODE_ENV=production tsx server.ts   # serves dist/ + api/* on port 3000
```

In production mode, `server.ts` serves static files from `dist/` instead of using Vite middleware. The `/api/*` routes remain identical to development.

---

## Function timeout notes

- `POST /api/gemini` has a 60-second maximum duration in `vercel.json`.
- `POST /api/gemini-stream` has a 120-second maximum duration for SSE responses.

These are configured limits, not latency guarantees. Runtime duration still depends on the selected provider operation and hosting conditions.

---

## PWA / offline support

`public/sw.js` registers a service worker for PWA capabilities. The service worker caches the SPA shell and static assets. Vercel serves `public/` contents at the root of the deployed URL alongside `dist/`.

`public/manifest.webmanifest` declares the PWA metadata (name, icons, theme color, display mode).

---

## Security notes

- `.env*` files are in `.gitignore` — never committed.
- All Gemini API keys and Redis credentials are server-only (`services/*.server.ts`). The browser never receives them.
- The session cookie uses HMAC-SHA256 signing. Rotate `RAFIQ_APP_SESSION_SECRET` to invalidate all active sessions.
- `bun run security:scan` detects accidentally committed secrets. Run before every deploy.
