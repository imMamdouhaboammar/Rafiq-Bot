import './setupEnv.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import {
  indexLocalVectorMemory,
  loadLocalStore,
} from '../services/redisVectorMemory.server.js';

Object.defineProperty(GoogleGenAI.prototype, 'models', {
  get() {
    return {
      embedContent: async (params: any) => ({
        embeddings: [{
          values: new Array(params.config?.outputDimensionality || 768).fill(0.01),
        }],
      }),
    };
  },
  set() {},
  configurable: true,
});

const storePath = path.join(process.cwd(), 'tmp', 'local_vector_memory.json');
const previous = fs.existsSync(storePath) ? fs.readFileSync(storePath, 'utf8') : null;
await fs.promises.mkdir(path.dirname(storePath), { recursive: true });
await fs.promises.writeFile(storePath, JSON.stringify({
  global_shared_pool: [{ id: 'leaked-record' }],
  'bot-a': [],
}), 'utf8');

try {
  const store = await loadLocalStore();
  assert.equal('global_shared_pool' in store, false, 'legacy shared records must be discarded on load');

  const records = Array.from({ length: 260 }, (_, index) => ({
    id: `record-${index}`,
    role: 'user' as const,
    text: `معلومة اختبارية طويلة كفاية للفهرسة رقم ${index}`,
    salience: index / 260,
    timestamp: new Date(2026, 0, index + 1),
  }));
  await indexLocalVectorMemory('bot-a', records);

  const updatedStore = await loadLocalStore();
  assert.equal(updatedStore['bot-a'].length, 250, 'each explicit scope must remain bounded');
  assert.equal(updatedStore['bot-a'].some(record => record.id === 'record-259'), true);
  assert.equal(updatedStore['bot-a'].some(record => record.id === 'record-0'), false);
} finally {
  if (previous === null) {
    if (fs.existsSync(storePath)) fs.unlinkSync(storePath);
  } else {
    fs.writeFileSync(storePath, previous, 'utf8');
  }
}

console.log('Vector memory legacy cleanup tests passed.');
