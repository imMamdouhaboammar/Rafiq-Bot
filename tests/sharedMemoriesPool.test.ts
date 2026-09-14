import './setupEnv.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GoogleGenAI } from '@google/genai';
import {
  indexVectorMemoryRecords,
  loadLocalStore,
  retrieveVectorMemoryContext,
} from '../services/redisVectorMemory.server.js';
import { MessageRole } from '../types.js';

Object.defineProperty(GoogleGenAI.prototype, 'models', {
  get() {
    return {
      embedContent: async (params: any) => {
        const text = String(params.contents || '');
        const dim = params.config?.outputDimensionality || 768;
        const values = new Array(dim).fill(0);
        for (let index = 0; index < Math.min(text.length, dim); index++) {
          values[index] = text.charCodeAt(index) / 255;
        }
        const norm = Math.sqrt(values.reduce((total, value) => total + value * value, 0));
        if (norm > 0) {
          for (let index = 0; index < values.length; index++) values[index] /= norm;
        }
        return { embeddings: [{ values }] };
      },
    };
  },
  set() {},
  configurable: true,
});

async function runTests() {
  console.log('Starting vector memory isolation tests...');

  const localStorePath = './tmp/local_vector_memory.json';
  const backupContent = fs.existsSync(localStorePath)
    ? fs.readFileSync(localStorePath, 'utf8')
    : null;

  if (fs.existsSync(localStorePath)) fs.writeFileSync(localStorePath, '{}', 'utf8');
  const store = await loadLocalStore();
  for (const key of Object.keys(store)) delete store[key];

  try {
    const botAChatId = 'bot-a-test-chat';
    const botBChatId = 'bot-b-test-chat';
    const memoryRecord = {
      id: 'fact-1',
      role: MessageRole.USER,
      text: 'ممدوح بيحب يشرب شاي بالنعناع الصبح بدري',
      category: 'preference',
      timestamp: new Date(),
      salience: 0.9,
    };

    await indexVectorMemoryRecords(botAChatId, [memoryRecord]);

    const botAResult = await retrieveVectorMemoryContext(
      botAChatId,
      'ممدوح بيحب يشرب ايه؟ شاي بالنعناع',
    );
    assert.equal(botAResult.hasStrongMatch, true);
    assert.match(botAResult.externalContext ?? '', /شاي بالنعناع/i);

    const botBResult = await retrieveVectorMemoryContext(
      botBChatId,
      'ممدوح بيحب يشرب ايه؟ شاي بالنعناع',
    );
    assert.equal(botBResult.hasStrongMatch, false, 'bot B must not retrieve bot A memory');
    assert.equal(botBResult.externalContext, undefined);

    const currentStore = await loadLocalStore();
    assert.equal('global_shared_pool' in currentStore, false, 'global shared memory storage is forbidden');
    assert.equal(botAChatId in currentStore, true);
    assert.equal(botBChatId in currentStore, false);

    console.log('Vector memory isolation tests passed.');
  } finally {
    if (backupContent === null) {
      if (fs.existsSync(localStorePath)) fs.unlinkSync(localStorePath);
    } else {
      fs.writeFileSync(localStorePath, backupContent, 'utf8');
    }
  }
}

runTests().catch(error => {
  console.error('Vector memory isolation test failed:', error);
  process.exit(1);
});
