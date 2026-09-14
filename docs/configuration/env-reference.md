# Environment Variable Reference

All environment variables are loaded by `services/env.server.ts` at server startup. It reads `.env` first, then `.env.local` (which takes precedence). Neither file is committed to the repository.

Copy `.env.example` to `.env.local` to get started:

```bash
cp .env.example .env.local
```

---

## Server runtime

| Variable | Type | Default | Required | Effect |
|----------|------|---------|----------|--------|
| `NODE_ENV` | `development \| production` | `development` | No | Controls Vite middleware vs static file serving in `server.ts` |
| `PORT` | number | `3000` | No | Port the Express dev server listens on |

---

## App password gate

These variables gate access to the entire application. Without them set, the password gate in `components/PasswordGate.tsx` accepts any input in development mode.

| Variable | Type | Default | Required | Effect |
|----------|------|---------|----------|--------|
| `RAFIQ_APP_PASSWORD_HASH` | string (SHA-256 hex) | — | Production | SHA-256 hex digest of the app password. Compared by `services/appAuth.server.ts: verifyAppPassword()` |
| `RAFIQ_APP_SESSION_SECRET` | string (≥32 chars) | — | Production | HMAC signing key for the session cookie. Used by `createAppSessionCookie()` and `hasValidAppSession()` |

**How to generate `RAFIQ_APP_PASSWORD_HASH`:**

```bash
echo -n "yourpassword" | shasum -a 256
# outputs: <hex>  -
# copy only the hex part
```

---

## Gemini API / Vertex AI

Rafiq supports two AI backends. Set exactly one group.

### Option A — Gemini API (Google AI Studio)

| Variable | Type | Default | Required | Effect |
|----------|------|---------|----------|--------|
| `GEMINI_API_KEY` | string | — | Yes (if using Gemini API) | Passed to `@google/genai` in `services/geminiService.server.ts` |

### Option B — Vertex AI (GCP service account)

| Variable | Type | Default | Required | Effect |
|----------|------|---------|----------|--------|
| `GOOGLE_CLOUD_PROJECT` | string | — | Yes (if using Vertex) | GCP project ID |
| `GOOGLE_CLOUD_LOCATION` | string | `global` | No | GCP region |
| `GOOGLE_APPLICATION_CREDENTIALS` | file path | — | Yes (if using Vertex, file-based) | Path to service account JSON. `server.ts` auto-detects `service-account.json` in the project root if this is unset |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | JSON string | — | Yes (if using Vertex, inline) | Full service account JSON as a string (alternative to file path) |
| `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` | base64 string | — | Yes (if using Vertex, base64) | Base64-encoded service account JSON (useful for Vercel env vars) |

---

## Web search

Used by `services/tools/webSearchTool.server.ts` (the `web_search` Gemini tool). Leave empty to expose an honest "unavailable" state — the tool will report it cannot search rather than failing silently.

| Variable | Type | Default | Required | Effect |
|----------|------|---------|----------|--------|
| `RAFIQ_WEB_SEARCH_PROVIDER` | string | — | No | Search provider identifier |
| `RAFIQ_WEB_SEARCH_API_KEY` | string | — | No | API key for the search provider |
| `RAFIQ_WEB_SEARCH_ENGINE_ID` | string | — | No | Search engine ID |
| `RAFIQ_WEB_SEARCH_LOCALE` | string | `ar-EG` | No | Locale for search results |
| `RAFIQ_WEB_SEARCH_REGION` | string | `eg` | No | Region for search results |

---

## Vector memory (Redis)

Optional. Disabled by default. When enabled, `services/redisVectorMemory.server.ts` uses Redis Iris or self-hosted Redis Stack for semantic memory retrieval across conversations.

| Variable | Type | Default | Required | Effect |
|----------|------|---------|----------|--------|
| `RAFIQ_VECTOR_MEMORY_ENABLED` | `true \| false` | `false` | No | Master switch. When `false`, all other vector memory vars are ignored |
| `REDIS_URL` | Redis URL | — | No | Connection string for self-hosted Redis Stack (e.g. `redis://localhost:6379`) |
| `REDIS_AGENT_MEMORY_API_KEY` | string | — | No | API key for Redis Iris managed service |
| `REDIS_AGENT_MEMORY_SERVER_URL` | URL | — | No | Redis Iris server URL |
| `REDIS_AGENT_MEMORY_STORE_ID` | string | — | No | Store ID within Redis Iris |
| `REDIS_AGENT_MEMORY_NAMESPACE` | string | `rafiq` | No | Key namespace prefix |
| `RAFIQ_REDIS_VECTOR_INDEX` | string | `idx:rafiq:mem:v1` | No | RediSearch vector index name |
| `RAFIQ_REDIS_VECTOR_PREFIX` | string | `rafiq:mem:` | No | Key prefix for vector records |
| `RAFIQ_EMBEDDING_MODEL` | string | `gemini-embedding-001` | No | Gemini embedding model used to vectorize memory text |
| `RAFIQ_EMBEDDING_DIM` | number | `768` | No | Embedding dimensions (must match the model) |
| `RAFIQ_VECTOR_MAX_TEXT_CHARS` | number | `1200` | No | Maximum characters per memory text before truncation |
| `RAFIQ_VECTOR_RETRIEVAL_LIMIT` | number | `5` | No | Maximum number of vector results returned per query |
| `RAFIQ_VECTOR_MAX_DISTANCE` | number | `0.62` | No | Cosine distance cutoff — results beyond this threshold are discarded |

---

## LangCache (semantic response cache)

Optional. Disabled by default. `services/langCache.server.ts` caches Gemini responses by semantic similarity to avoid redundant API calls for near-duplicate prompts.

| Variable | Type | Default | Required | Effect |
|----------|------|---------|----------|--------|
| `RAFIQ_LANGCACHE_ENABLED` | `true \| false` | `false` | No | Master switch |
| `RAFIQ_LANGCACHE_TTL_SECONDS` | number | `900` | No | Cache entry time-to-live in seconds |

---

## Notes

- `services/env.server.ts` loads `.env` then `.env.local` (`.env.local` wins on conflicts).
- Never commit `.env.local` or `.env` with real secrets. Both are in `.gitignore`.
- In Vercel production, all variables are set in the project's Environment Variables dashboard — not in committed files.
- Boolean variables accept the literal string `"true"` or `"false"`.
