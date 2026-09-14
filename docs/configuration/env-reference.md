# Environment configuration

`.env.example` is the public configuration schema for Rafiq. Copy it to `.env.local` for local development and replace only the values you need. `services/env.server.ts` loads `.env` first and `.env.local` second, so local values win.

```bash
cp .env.example .env.local
```

Never commit `.env`, `.env.local`, service-account files, tokens, or private keys. Production deployments should provide the same variable names through the hosting platform secret store.

## Minimum local configuration

Rafiq can boot without every optional integration. For an AI-backed chat flow, configure one Google inference path and the app access gate appropriate to your environment.

| Variable | Classification | Default / safe example | Purpose |
| --- | --- | --- | --- |
| `NODE_ENV` | runtime | `development` | Development or production runtime mode |
| `PORT` | runtime | `3000` | Express server port |
| `RAFIQ_APP_PASSWORD_HASH` | production security | empty | SHA-256 digest used by the app-wide password gate |
| `RAFIQ_APP_SESSION_SECRET` | production security | empty | HMAC secret for the app session cookie; use a strong independent value |
| `RAFIQ_DEFAULT_LOCALE` | runtime locale | `ar-EG` reference preset | Default locale when no explicit runtime locale is supplied |
| `RAFIQ_DEFAULT_TIMEZONE` | runtime timezone | `Africa/Cairo` reference preset | Default timezone when no explicit runtime timezone is supplied |

The locale and timezone values above document the current reference behavior. The OSS globalization work keeps Egyptian Arabic as a bundled preset while removing Egypt-specific fallbacks from global core paths.

## Google Gemini and Vertex AI

Choose either an API-key flow or an explicit Vertex AI credential flow.

| Variable | Classification | Default / safe example | Purpose |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | provider secret | empty | Google AI Studio API key |
| `GOOGLE_CLOUD_PROJECT` | provider config | empty | Vertex AI Google Cloud project ID |
| `GOOGLE_CLOUD_LOCATION` | provider config | `global` | Vertex AI location |
| `GOOGLE_APPLICATION_CREDENTIALS` | provider secret path | empty | Path to a local service-account JSON file |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | provider secret | empty | Inline service-account JSON alternative |
| `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` | provider secret | empty | Base64-encoded service-account JSON alternative |
| `RAFIQ_MODEL_FAST` | advanced model routing | empty | Override fast-chat model |
| `RAFIQ_MODEL_NORMAL` | advanced model routing | empty | Override normal/tool model |
| `RAFIQ_MODEL_DEEP` | advanced model routing | empty | Override deep/memory-heavy model |
| `RAFIQ_HEALTHCHECK_MODEL` | advanced health probe | empty | Model used by the capability health endpoint |

Do not commit a service-account file. Hosting environments should use their secret management facilities.

## AgentRouter

AgentRouter is an optional inference path present in the current runtime. The two token names are accepted aliases.

| Variable | Classification | Default / safe example | Purpose |
| --- | --- | --- | --- |
| `AGENT_ROUTER_TOKEN` | provider secret | empty | Preferred AgentRouter token name |
| `AGENTROUTER_API_KEY` | provider secret alias | empty | Legacy/alternate token name |
| `AGENTROUTER_BASE_URL` | provider config | `https://agentrouter.org/v1` | AgentRouter-compatible API base URL |
| `AGENTROUTER_MODEL` | provider config | `gpt-5.6-sol` | Default AgentRouter model identifier |

The presence of this path does not imply every model exposed by an AgentRouter deployment is supported by Rafiq. Provider documentation describes the reachable contracts separately.

## Web search

Search is optional. When provider configuration is incomplete, Rafiq reports search as unavailable instead of fabricating results.

| Variable | Classification | Default / safe example | Purpose |
| --- | --- | --- | --- |
| `RAFIQ_WEB_SEARCH_PROVIDER` | optional feature | empty | Search provider identifier such as an implementation supported by `webSearchTool.server.ts` |
| `RAFIQ_WEB_SEARCH_API_KEY` | optional secret | empty | Search-provider API key |
| `RAFIQ_WEB_SEARCH_ENGINE_ID` | optional config | empty | Engine ID required by providers such as Google Custom Search |
| `RAFIQ_WEB_SEARCH_LOCALE` | optional locale | `ar-EG` reference preset | Search locale when the caller does not specify one |
| `RAFIQ_WEB_SEARCH_REGION` | optional region | `eg` reference preset | Search region when the caller does not specify one |

## Vector memory

Vector memory is optional and disabled by default. The runtime can use Redis Stack, Redis Agent Memory, or its existing local fallback depending on configuration.

| Variable | Classification | Default / safe example | Purpose |
| --- | --- | --- | --- |
| `RAFIQ_VECTOR_MEMORY_ENABLED` | optional feature | `false` | Master vector-memory switch |
| `REDIS_URL` | optional secret/config | empty | Redis connection URL |
| `AGENT_MEMORY_API_KEY` | optional secret alias | empty | Redis Agent Memory API key alias |
| `REDIS_AGENT_MEMORY_API_KEY` | optional secret | empty | Redis Agent Memory API key |
| `REDIS_AGENT_MEMORY_SERVER_URL` | optional config | empty | Redis Agent Memory server URL |
| `REDIS_AGENT_MEMORY_STORE_ID` | optional config | empty | Redis Agent Memory store ID |
| `REDIS_AGENT_MEMORY_NAMESPACE` | optional config | `rafiq` | Agent Memory namespace |
| `RAFIQ_REDIS_VECTOR_INDEX` | advanced | `idx:rafiq:mem:v1` | RediSearch vector index name |
| `RAFIQ_REDIS_VECTOR_PREFIX` | advanced | `rafiq:mem:` | Redis key prefix |
| `RAFIQ_EMBEDDING_MODEL` | advanced | `gemini-embedding-001` | Embedding model |
| `RAFIQ_EMBEDDING_DIM` | advanced | `768` | Embedding dimensions |
| `RAFIQ_VECTOR_MAX_TEXT_CHARS` | advanced | `1200` | Maximum text length sent for one embedding |
| `RAFIQ_VECTOR_RETRIEVAL_LIMIT` | advanced | `5` | Maximum vector results per query |
| `RAFIQ_VECTOR_MAX_DISTANCE` | advanced | `0.62` | Maximum accepted cosine distance |

## LangCache

LangCache is optional and disabled by default. Both API-key variable names are accepted aliases.

| Variable | Classification | Default / safe example | Purpose |
| --- | --- | --- | --- |
| `RAFIQ_LANGCACHE_ENABLED` | optional feature | `false` | Master semantic-cache switch |
| `LANGCACHE_API_KEY` | optional secret alias | empty | LangCache API key alias |
| `REDIS_LANGCACHE_API_KEY` | optional secret | empty | Redis LangCache API key |
| `REDIS_LANGCACHE_SERVER_URL` | optional config | empty | LangCache server URL |
| `REDIS_LANGCACHE_CACHE_ID` | optional config | empty | LangCache cache ID |
| `RAFIQ_LANGCACHE_SIMILARITY_THRESHOLD` | advanced | `0.91` | Minimum similarity for semantic cache hits |
| `RAFIQ_LANGCACHE_TTL_MS` | advanced | `604800000` | Cache TTL in milliseconds |
| `RAFIQ_LANGCACHE_USE_ATTRIBUTES` | advanced | `false` | Include contextual cache attributes when enabled |

## Consistency contract

`tests/envContract.test.ts` scans runtime environment reads and requires every discovered key to appear in `.env.example`. It also requires every example key to appear in this reference. When adding or renaming an environment variable, update the runtime, `.env.example`, and this file in the same change.
