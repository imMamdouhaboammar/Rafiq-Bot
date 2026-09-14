import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { AgentMemory } from '@redis-iris/agent-memory';
import { createClient, type RedisClientType } from 'redis';
import { MessageRole } from '../types.js';
import { createGoogleGenAIClient } from './googleClient.server.js';

export type VectorMemoryRole = MessageRole | 'user' | 'model';

export type VectorMemoryRecord = {
  id?: string;
  role: VectorMemoryRole;
  text: string;
  category?: string;
  timestamp?: Date | string | number;
  salience?: number;
};

type StoredLocalMemory = {
  id: string;
  role: string;
  category: string;
  text: string;
  summary: string;
  salience: number;
  updatedAt: number;
  embedding: number[];
};

type RetrievedMemory = {
  chatId?: string;
  summary: string;
  text: string;
  category: string;
  role: string;
  salience: number;
  distance: number;
};

const LOCAL_STORE_PATH = path.join(process.cwd(), 'tmp', 'local_vector_memory.json');
const FORBIDDEN_SHARED_SCOPE = 'global_shared_pool';
const MAX_SCOPE_RECORDS = 250;

let redisClientPromise: Promise<RedisClientType> | null = null;
let indexReadyPromise: Promise<void> | null = null;
let agentMemoryClient: AgentMemory | null = null;
let localStoreCache: Record<string, StoredLocalMemory[]> = {};
let isLocalStoreLoaded = false;
let writePromiseChain = Promise.resolve();

const readNumber = (name: string, fallback: number): number => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};

const getConfig = () => ({
  enabled: process.env.RAFIQ_VECTOR_MEMORY_ENABLED === 'true',
  redisUrl: process.env.REDIS_URL?.trim(),
  agentMemoryApiKey: (process.env.AGENT_MEMORY_API_KEY || process.env.REDIS_AGENT_MEMORY_API_KEY)?.trim(),
  agentMemoryServerUrl: process.env.REDIS_AGENT_MEMORY_SERVER_URL?.trim(),
  agentMemoryStoreId: process.env.REDIS_AGENT_MEMORY_STORE_ID?.trim(),
  agentMemoryNamespace: process.env.REDIS_AGENT_MEMORY_NAMESPACE?.trim() || 'rafiq',
  indexName: process.env.RAFIQ_REDIS_VECTOR_INDEX?.trim() || 'idx:rafiq:mem:v1',
  keyPrefix: process.env.RAFIQ_REDIS_VECTOR_PREFIX?.trim() || 'rafiq:mem:',
  embeddingModel: process.env.RAFIQ_EMBEDDING_MODEL?.trim() || 'gemini-embedding-001',
  embeddingDim: readNumber('RAFIQ_EMBEDDING_DIM', 768),
  maxTextChars: readNumber('RAFIQ_VECTOR_MAX_TEXT_CHARS', 1200),
  retrievalLimit: Math.max(1, Math.min(20, readNumber('RAFIQ_VECTOR_RETRIEVAL_LIMIT', 5))),
  maxCosineDistance: Math.max(0, Math.min(2, readNumber('RAFIQ_VECTOR_MAX_DISTANCE', 0.62))),
});

const assertExplicitScope = (scopeId: string): void => {
  if (!scopeId.trim()) throw new Error('Vector memory requires an explicit scope ID.');
  if (scopeId === FORBIDDEN_SHARED_SCOPE) {
    throw new Error('global_shared_pool is forbidden. Use an explicit bot, chat, group, or knowledge scope.');
  }
};

export const isRedisVectorMemoryConfigured = (): boolean => {
  const config = getConfig();
  return config.enabled && Boolean(config.redisUrl) && config.embeddingDim > 0;
};

const isAgentMemoryConfigured = (): boolean => {
  const config = getConfig();
  return config.enabled && Boolean(
    config.agentMemoryApiKey && config.agentMemoryServerUrl && config.agentMemoryStoreId,
  );
};

const sanitizeAgentMemoryId = (value: string): string => {
  const normalized = value
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return (normalized || 'default').slice(0, 64);
};

const getAgentMemoryClient = (): AgentMemory => {
  const config = getConfig();
  if (!isAgentMemoryConfigured()) throw new Error('Redis Agent Memory is not configured.');

  if (!agentMemoryClient) {
    agentMemoryClient = new AgentMemory({
      serverURL: config.agentMemoryServerUrl!,
      storeId: config.agentMemoryStoreId!,
      apiKey: config.agentMemoryApiKey!,
      timeoutMs: 5000,
    });
  }

  return agentMemoryClient;
};

const getRedisClient = async (): Promise<RedisClientType> => {
  const config = getConfig();
  if (!isRedisVectorMemoryConfigured()) throw new Error('Redis vector memory is not configured.');

  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      const client = createClient({
        url: config.redisUrl,
        socket: {
          connectTimeout: 3000,
          reconnectStrategy: retries => Math.min(retries * 50, 1000),
        },
      }) as RedisClientType;

      client.on('error', error => {
        console.warn('[RedisVectorMemory] Redis client error:', error);
      });
      await client.connect();
      return client;
    })();
  }

  return redisClientPromise;
};

const escapeTagValue = (value: string): string => (
  value.replace(/[\\,.<>{}\[\]"':;!@#$%^&*()\-+=~\s|]/g, '\\$&')
);

const summarize = (text: string): string => {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed.length > 220 ? `${trimmed.slice(0, 217)}...` : trimmed;
};

const normalizeRole = (role: VectorMemoryRole): string => (
  String(role) === MessageRole.USER || String(role) === 'user' ? 'user' : 'model'
);

const inferCategory = (text: string): string => {
  if (/(اسمي|عمري|انا|أنا|ساكن|شغال|بشتغل|identity|name|age|live|work)/i.test(text)) return 'identity';
  if (/(بحب|بكره|مفضل|افضل|favorite|like|hate)/i.test(text)) return 'preference';
  if (/(نفسي|هدفي|بحلم|عايز|عاوزه|plan|goal|dream)/i.test(text)) return 'goal';
  if (/(زعلان|مبسوط|خايف|قلقان|متضايق|happy|sad|angry|afraid|anxious)/i.test(text)) return 'emotion';
  if (/(فاكر|افتكر|مرة|زمان|حصل|remember|memory|used to)/i.test(text)) return 'memory';
  return 'general';
};

const scoreSalience = (record: VectorMemoryRecord): number => {
  if (typeof record.salience === 'number') return Math.max(0, Math.min(1, record.salience));
  const category = record.category || inferCategory(record.text);
  const roleBoost = normalizeRole(record.role) === 'user' ? 0.2 : 0;
  const categoryBoost = ['identity', 'goal', 'emotion', 'preference'].includes(category) ? 0.2 : 0;
  const lengthBoost = record.text.length > 100 ? 0.1 : 0;
  return Math.min(1, 0.45 + roleBoost + categoryBoost + lengthBoost);
};

const stableRecordId = (scopeId: string, record: VectorMemoryRecord): string => (
  crypto
    .createHash('sha256')
    .update(`${scopeId}:${record.id || ''}:${normalizeRole(record.role)}:${record.text}`)
    .digest('hex')
    .slice(0, 48)
);

const stableRedisKey = (scopeId: string, record: VectorMemoryRecord): string => {
  const config = getConfig();
  return `${config.keyPrefix}${scopeId}:${stableRecordId(scopeId, record).slice(0, 32)}`;
};

export const vectorToFloat32Buffer = (
  values: number[],
  expectedDim = getConfig().embeddingDim,
): Buffer => {
  if (values.length !== expectedDim) {
    throw new Error(`Embedding dimension mismatch. Expected ${expectedDim}, received ${values.length}.`);
  }
  const vector = new Float32Array(values);
  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
};

const embedText = async (
  text: string,
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY',
): Promise<number[]> => {
  const config = getConfig();
  const ai = createGoogleGenAIClient();
  const response = await ai.models.embedContent({
    model: config.embeddingModel,
    contents: text.slice(0, config.maxTextChars),
    config: {
      taskType,
      outputDimensionality: config.embeddingDim,
      autoTruncate: true,
    },
  });
  const values = response.embeddings?.[0]?.values;
  if (!values?.length) throw new Error('Gemini did not return an embedding vector.');
  return values;
};

const ensureVectorIndex = async (): Promise<void> => {
  if (indexReadyPromise) return indexReadyPromise;

  indexReadyPromise = (async () => {
    const config = getConfig();
    const client = await getRedisClient();
    try {
      await client.sendCommand(['FT.INFO', config.indexName]);
      return;
    } catch {
      // First boot creates the index below.
    }

    await client.sendCommand([
      'FT.CREATE', config.indexName,
      'ON', 'HASH',
      'PREFIX', '1', config.keyPrefix,
      'SCHEMA',
      'chatId', 'TAG', 'SORTABLE',
      'sourceRole', 'TAG',
      'category', 'TAG',
      'text', 'TEXT',
      'summary', 'TEXT',
      'salience', 'NUMERIC', 'SORTABLE',
      'updatedAt', 'NUMERIC', 'SORTABLE',
      'embedding', 'VECTOR', 'HNSW', '10',
      'TYPE', 'FLOAT32',
      'DIM', String(config.embeddingDim),
      'DISTANCE_METRIC', 'COSINE',
      'M', '16',
      'EF_CONSTRUCTION', '200',
    ]);
  })();

  return indexReadyPromise;
};

const sanitizeLocalStore = (value: unknown): Record<string, StoredLocalMemory[]> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, StoredLocalMemory[]> = {};

  for (const [scopeId, records] of Object.entries(value as Record<string, unknown>)) {
    if (scopeId === FORBIDDEN_SHARED_SCOPE || !Array.isArray(records)) continue;
    result[scopeId] = records
      .filter(record => record && typeof record === 'object')
      .slice(-MAX_SCOPE_RECORDS) as StoredLocalMemory[];
  }

  return result;
};

export const loadLocalStore = async (): Promise<Record<string, StoredLocalMemory[]>> => {
  if (isLocalStoreLoaded) return localStoreCache;

  try {
    if (fs.existsSync(LOCAL_STORE_PATH)) {
      const content = await fs.promises.readFile(LOCAL_STORE_PATH, 'utf8');
      localStoreCache = sanitizeLocalStore(JSON.parse(content));
    }
  } catch (error) {
    console.warn('[LocalVectorMemory] Failed to load local vector memory file:', error);
    localStoreCache = {};
  }

  isLocalStoreLoaded = true;
  return localStoreCache;
};

export const saveLocalStore = async (): Promise<void> => {
  const currentWrite = writePromiseChain.then(async () => {
    const directory = path.dirname(LOCAL_STORE_PATH);
    const temporaryPath = `${LOCAL_STORE_PATH}.tmp`;
    await fs.promises.mkdir(directory, { recursive: true });
    await fs.promises.writeFile(temporaryPath, JSON.stringify(localStoreCache, null, 2), 'utf8');
    await fs.promises.rename(temporaryPath, LOCAL_STORE_PATH);
  });

  writePromiseChain = currentWrite.catch(error => {
    console.warn('[LocalVectorMemory] Failed to save local vector memory file:', error);
  });
  return currentWrite;
};

export const cosineSimilarity = (left: number[], right: number[]): number => {
  let dotProduct = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  const length = Math.min(left.length, right.length);

  for (let index = 0; index < length; index++) {
    dotProduct += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dotProduct / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
};

export const indexLocalVectorMemory = async (
  scopeId: string,
  records: VectorMemoryRecord[],
): Promise<void> => {
  assertExplicitScope(scopeId);
  const store = await loadLocalStore();
  const current = store[scopeId] || [];

  for (const record of records) {
    const text = record.text?.trim();
    if (!text || text.length < 6) continue;
    const id = record.id || stableRecordId(scopeId, { ...record, text });
    if (current.some(existing => existing.id === id)) continue;

    current.push({
      id,
      role: normalizeRole(record.role),
      category: record.category || inferCategory(text),
      text,
      summary: summarize(text),
      salience: scoreSalience(record),
      updatedAt: record.timestamp ? new Date(record.timestamp).getTime() : Date.now(),
      embedding: await embedText(text, 'RETRIEVAL_DOCUMENT'),
    });
  }

  current.sort((left, right) => {
    if (right.salience !== left.salience) return right.salience - left.salience;
    return right.updatedAt - left.updatedAt;
  });
  store[scopeId] = current.slice(0, MAX_SCOPE_RECORDS);
  delete store[FORBIDDEN_SHARED_SCOPE];
  await saveLocalStore();
};

export const retrieveLocalVectorMemory = async (scopeId: string, query: string) => {
  try {
    assertExplicitScope(scopeId);
    const store = await loadLocalStore();
    const records = store[scopeId] || [];
    if (records.length === 0) return { externalContext: undefined, hasStrongMatch: false };

    const config = getConfig();
    const queryEmbedding = await embedText(query, 'RETRIEVAL_QUERY');
    const matches = records
      .map(record => ({
        ...record,
        distance: 1 - cosineSimilarity(queryEmbedding, record.embedding),
      }))
      .filter(record => record.distance <= config.maxCosineDistance)
      .sort((left, right) => left.distance - right.distance)
      .slice(0, config.retrievalLimit);

    if (matches.length === 0) return { externalContext: undefined, hasStrongMatch: false };

    const lines = matches.map(memory => {
      const confidence = Math.max(0, 1 - memory.distance).toFixed(2);
      return `- [${memory.category}; ${memory.role}; semantic=${confidence}] ${memory.summary || memory.text}`;
    });

    return {
      externalContext: `Local semantic memory:\n${lines.join('\n')}`,
      hasStrongMatch: true,
    };
  } catch (error) {
    console.warn('[LocalVectorMemory] Retrieval failed:', error);
    return { externalContext: undefined, hasStrongMatch: false };
  }
};

const indexVectorMemoryRecordsSingle = async (
  scopeId: string,
  records: VectorMemoryRecord[],
): Promise<void> => {
  assertExplicitScope(scopeId);
  const config = getConfig();
  const indexable = records
    .map(record => ({ ...record, text: record.text?.trim() || '' }))
    .filter(record => record.text.length >= 6)
    .slice(-8);
  if (indexable.length === 0) return;

  if (isAgentMemoryConfigured()) {
    const client = getAgentMemoryClient();
    const sessionId = sanitizeAgentMemoryId(scopeId);

    for (const record of indexable) {
      await client.addSessionEvent({
        sessionId,
        actorId: normalizeRole(record.role) === 'user' ? 'user' : 'rafiq',
        role: normalizeRole(record.role) === 'user' ? 'USER' : 'ASSISTANT',
        content: [{ text: record.text.slice(0, config.maxTextChars) }],
        createdAt: record.timestamp ? new Date(record.timestamp) : new Date(),
        metadata: {
          category: record.category || inferCategory(record.text),
          salience: scoreSalience(record),
        },
      });
    }

    await client.bulkCreateLongTermMemories({
      memories: indexable.map(record => {
        const category = record.category || inferCategory(record.text);
        return {
          id: stableRecordId(scopeId, record),
          text: summarize(record.text),
          memoryType: normalizeRole(record.role) === 'user' ? 'semantic' : 'episodic',
          sessionId,
          ownerId: normalizeRole(record.role) === 'user' ? 'user' : 'rafiq',
          namespace: sanitizeAgentMemoryId(config.agentMemoryNamespace),
          topics: [category, normalizeRole(record.role), 'rafiq'],
        };
      }),
    });
    return;
  }

  if (!isRedisVectorMemoryConfigured()) {
    await indexLocalVectorMemory(scopeId, indexable);
    return;
  }

  await ensureVectorIndex();
  const client = await getRedisClient();
  for (const record of indexable) {
    const embedding = vectorToFloat32Buffer(await embedText(record.text, 'RETRIEVAL_DOCUMENT'));
    const category = record.category || inferCategory(record.text);
    const updatedAt = record.timestamp ? new Date(record.timestamp).getTime() : Date.now();

    await client.hSet(stableRedisKey(scopeId, record), {
      chatId: scopeId,
      sourceRole: normalizeRole(record.role),
      category,
      text: record.text.slice(0, config.maxTextChars),
      summary: summarize(record.text),
      salience: String(scoreSalience(record)),
      updatedAt: String(updatedAt),
      embedding,
    });
  }
};

export const indexVectorMemoryRecords = async (
  scopeId: string | undefined,
  records: VectorMemoryRecord[],
): Promise<void> => {
  const config = getConfig();
  if (!scopeId || !config.enabled) return;

  try {
    await indexVectorMemoryRecordsSingle(scopeId, records);
  } catch (error) {
    console.warn('[RedisVectorMemory] Indexing skipped:', error);
  }
};

const parseSearchResult = (raw: unknown): RetrievedMemory[] => {
  if (!Array.isArray(raw)) return [];
  const rows: RetrievedMemory[] = [];

  for (let index = 2; index < raw.length; index += 2) {
    const fields = raw[index + 1];
    if (!Array.isArray(fields)) continue;
    const document = new Map<string, string>();

    for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex += 2) {
      const key = Buffer.isBuffer(fields[fieldIndex])
        ? fields[fieldIndex].toString('utf8')
        : String(fields[fieldIndex]);
      const value = Buffer.isBuffer(fields[fieldIndex + 1])
        ? fields[fieldIndex + 1].toString('utf8')
        : String(fields[fieldIndex + 1]);
      document.set(key, value);
    }

    rows.push({
      chatId: document.get('chatId') || '',
      summary: document.get('summary') || '',
      text: document.get('text') || '',
      category: document.get('category') || 'general',
      role: document.get('sourceRole') || 'unknown',
      salience: Number(document.get('salience') || '0'),
      distance: Number(document.get('vector_score') || '1'),
    });
  }

  return rows;
};

const formatSemanticContext = (memories: RetrievedMemory[]): string | undefined => {
  const config = getConfig();
  const strongMemories = memories
    .filter(memory => memory.distance <= config.maxCosineDistance)
    .slice(0, config.retrievalLimit);
  if (strongMemories.length === 0) return undefined;

  const lines = strongMemories.map(memory => {
    const confidence = Math.max(0, 1 - memory.distance).toFixed(2);
    return `- [${memory.category}; ${memory.role}; semantic=${confidence}] ${memory.summary || memory.text}`;
  });
  return `Redis semantic memory:\n${lines.join('\n')}`;
};

export const retrieveVectorMemoryContext = async (
  scopeId: string | undefined,
  query: string,
) => {
  const config = getConfig();
  if (!scopeId || !query.trim() || !config.enabled) {
    return { externalContext: undefined, hasStrongMatch: false };
  }

  try {
    assertExplicitScope(scopeId);

    if (isAgentMemoryConfigured()) {
      const client = getAgentMemoryClient();
      const result = await client.searchLongTermMemory({
        text: query,
        similarityThreshold: Math.max(0, Math.min(1, 1 - config.maxCosineDistance)),
        filter: {
          namespace: { eq: sanitizeAgentMemoryId(config.agentMemoryNamespace) },
          sessionId: { eq: sanitizeAgentMemoryId(scopeId) },
        },
        filterOp: 'all',
        limit: config.retrievalLimit,
      });

      if (!result.items.length) return { externalContext: undefined, hasStrongMatch: false };
      const lines = result.items.slice(0, config.retrievalLimit).map(memory => {
        const topics = memory.topics?.length ? memory.topics.join(',') : 'semantic';
        return `- [${topics}] ${memory.text}`;
      });
      return {
        externalContext: `Redis Agent Memory:\n${lines.join('\n')}`,
        hasStrongMatch: true,
      };
    }

    if (!isRedisVectorMemoryConfigured()) {
      return retrieveLocalVectorMemory(scopeId, query);
    }

    await ensureVectorIndex();
    const client = await getRedisClient();
    const queryVector = vectorToFloat32Buffer(await embedText(query, 'RETRIEVAL_QUERY'));
    const raw = await client.sendCommand([
      'FT.SEARCH',
      config.indexName,
      `(@chatId:{${escapeTagValue(scopeId)}})=>[KNN ${config.retrievalLimit} @embedding $vector AS vector_score]`,
      'PARAMS', '2', 'vector', queryVector,
      'RETURN', '8', 'chatId', 'summary', 'text', 'category', 'sourceRole', 'salience', 'updatedAt', 'vector_score',
      'SORTBY', 'vector_score', 'ASC',
      'DIALECT', '2',
    ]);

    const memories = parseSearchResult(raw);
    const externalContext = formatSemanticContext(memories);
    return {
      externalContext,
      hasStrongMatch: Boolean(externalContext),
    };
  } catch (error) {
    console.warn('[RedisVectorMemory] Retrieval skipped:', error);
    return { externalContext: undefined, hasStrongMatch: false };
  }
};
