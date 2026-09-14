import assert from 'node:assert/strict';
import { executeWebSearch } from '../services/tools/webSearchTool.server.js';

const previousProvider = process.env.RAFIQ_WEB_SEARCH_PROVIDER;
const previousApiKey = process.env.RAFIQ_WEB_SEARCH_API_KEY;
const previousEngineId = process.env.RAFIQ_WEB_SEARCH_ENGINE_ID;

delete process.env.RAFIQ_WEB_SEARCH_PROVIDER;
delete process.env.RAFIQ_WEB_SEARCH_API_KEY;
delete process.env.RAFIQ_WEB_SEARCH_ENGINE_ID;

try {
  const result = await executeWebSearch({ query: 'Rafiq test query', maxResults: 5 });
  assert.equal(result.provider, 'unavailable');
  assert.deepEqual(result.results, []);
  assert.equal(result.query, 'Rafiq test query');
} finally {
  if (previousProvider === undefined) delete process.env.RAFIQ_WEB_SEARCH_PROVIDER;
  else process.env.RAFIQ_WEB_SEARCH_PROVIDER = previousProvider;

  if (previousApiKey === undefined) delete process.env.RAFIQ_WEB_SEARCH_API_KEY;
  else process.env.RAFIQ_WEB_SEARCH_API_KEY = previousApiKey;

  if (previousEngineId === undefined) delete process.env.RAFIQ_WEB_SEARCH_ENGINE_ID;
  else process.env.RAFIQ_WEB_SEARCH_ENGINE_ID = previousEngineId;
}

console.log('Web search honesty tests passed.');
