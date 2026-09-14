# Redis Vector Memory

## Goal and Success Criteria

Make Boost Rafiq faster and smarter by adding an optional server-side Redis vector memory layer. Prefer Redis Agent Memory managed hosting when configured, with self-hosted Redis Stack as fallback.

Success means:

- Redis credentials never ship to the browser.
- Existing Dexie memory remains the local fallback.
- When enabled, each chat stores session events and semantic memories in Redis and retrieves relevant memories before Gemini generation.
- Redis failures degrade silently to the existing local memory path.
- The app still builds without a Redis server.

## Constitution

- Simplicity: one server-only Redis module with a narrow API.
- Safety: Redis access is gated by environment variables and never runs from client code.
- Testability: vector serialization and TypeScript build catch integration errors.
- Determinism: index names, key prefixes, dimensions, and thresholds are explicit.
- Minimal permissions: use only Redis hash writes, RediSearch index creation, and scoped `FT.SEARCH`.

## Scope

- Add a Redis HNSW vector index over chat memory records.
- Use Gemini embeddings for multilingual semantic retrieval.
- Combine Redis semantic context with existing Boost Rafiq Dexie context.
- Suppress Google Search when Redis already has a strong semantic match.
- Add Redis LangCache for safe semantic response caching on plain text turns.

## Non Goals

- No migration of existing Dexie memories into Redis in this slice.
- No memory management dashboard.
- No Redis deployment automation.
- No direct browser-to-Redis connection.

## Data Contract

Managed Redis Agent Memory:

- `sessionId`: sanitized chat ID.
- `ownerId`: `user` or `rafiq`.
- `namespace`: `rafiq` by default.
- `topics`: memory category, role, and `rafiq`.
- `memoryType`: `semantic` for user facts, `episodic` for assistant turns.

Self-hosted Redis Stack index: `idx:rafiq:mem:v1`

Key prefix: `rafiq:mem:`

Hash fields:

- `chatId`: TAG, sortable scope filter.
- `sourceRole`: TAG, `user` or `model`.
- `category`: TAG, inferred memory category.
- `text`: TEXT, original clipped message text.
- `summary`: TEXT, short display-safe summary.
- `salience`: NUMERIC, approximate importance.
- `updatedAt`: NUMERIC, epoch milliseconds.
- `embedding`: VECTOR HNSW, `FLOAT32`, cosine distance, default 768 dimensions.

Environment:

- `RAFIQ_VECTOR_MEMORY_ENABLED=true`: enables the layer.
- `REDIS_AGENT_MEMORY_SERVER_URL`: managed Agent Memory endpoint.
- `REDIS_AGENT_MEMORY_STORE_ID`: managed Agent Memory store ID.
- `AGENT_MEMORY_API_KEY`: managed Agent Memory API key.
- `REDIS_URL`: self-hosted Redis connection URL.
- `RAFIQ_EMBEDDING_MODEL=gemini-embedding-001`: embedding model.
- `RAFIQ_EMBEDDING_DIM=768`: reduced dimensionality for lower memory and latency.
- `RAFIQ_VECTOR_RETRIEVAL_LIMIT=5`: top-k retrieval.
- `RAFIQ_VECTOR_MAX_DISTANCE=0.62`: cosine-distance cutoff for accepted memories.
- `RAFIQ_LANGCACHE_ENABLED=true`: enables semantic response cache.
- `REDIS_LANGCACHE_SERVER_URL`: LangCache endpoint.
- `REDIS_LANGCACHE_CACHE_ID`: LangCache cache ID.
- `LANGCACHE_API_KEY`: LangCache API key.
- `RAFIQ_LANGCACHE_SIMILARITY_THRESHOLD=0.91`: minimum cache similarity.
- `RAFIQ_LANGCACHE_TTL_MS=604800000`: default one-week cache TTL.
- `RAFIQ_LANGCACHE_USE_ATTRIBUTES=true`: optional; use only when the LangCache cache has attributes configured.

## Error Cases and Edge Cases

- Redis unavailable: log warning, continue with Dexie memory only.
- RediSearch index missing: create it on first use.
- Embedding API failure: skip Redis write/read for that turn.
- Agent Memory API failure: skip Redis write/read for that turn.
- LangCache API failure: skip cache read/write for that turn.
- Attachment, reply-context, or live-search turns: bypass LangCache to avoid stale or mismatched responses.
- LangCache cache without configured attributes: isolate by chat/persona/model/context inside the cache prompt instead of attributes.
- Dimension mismatch: reject the vector before writing to Redis.
- Empty or tiny messages: do not index.
- Attachments: only text is embedded in this slice.

## Approaches Considered

1. Server-side Redis vector memory with HNSW and Gemini embeddings.
   - Best correctness and security. Medium diff. Chosen.
2. Redis semantic cache for Gemini responses only.
   - Faster repeated answers, but less useful for relationship memory.
3. Browser-side vector search over IndexedDB.
   - Smallest runtime dependency, but not Redis and not production-scalable.
4. Docs-only architecture.
   - Lowest risk, but does not improve the app.

## Implementation Plan

- Add `redis`, `@redis-iris/agent-memory`, and `@redis-ai/langcache` dependencies.
- Add `services/redisVectorMemory.server.ts`.
- Add `services/langCache.server.ts`.
- Retrieve Redis Agent Memory or Redis Stack memory inside `sendMessageToGemini`.
- Search LangCache before Gemini generation and save cacheable replies after generation.
- Index recent history, the current user message, and the final model reply.
- Pass `chatId` as the Redis memory scope from the chat controller.
- Keep Dexie Boost Rafiq memory unchanged as fallback.

## Tasks

- Create Redis client with pooling/reconnect timeout.
- Create RediSearch HNSW index on first use.
- Convert Gemini embeddings to Float32 buffers.
- Store memory hashes under chat-scoped keys.
- Query with hybrid chat filter plus KNN vector search.
- Merge retrieved Redis context into Gemini system context.
- Verify with TypeScript/build.

## Checklist

- `npm run build` passes.
- No Redis code is imported by browser-facing modules.
- App runs when Redis env vars are absent.
- Redis keys use scoped prefixes.
- No secret files are read or modified.

## Rollback

- Set `RAFIQ_VECTOR_MEMORY_ENABLED=false` or remove `REDIS_URL`.
- Revert `services/redisVectorMemory.server.ts`, the small `sendMessageToGemini` integration, and the added dependencies.
- Disable LangCache independently with `RAFIQ_LANGCACHE_ENABLED=false`.
- Existing Dexie memory continues to work.
