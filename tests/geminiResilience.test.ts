import assert from 'node:assert/strict';
import {
  getChatModelFallbackChain,
  PRO_3_1_MODEL,
  FLASH_3_8_MODEL,
  FLASH_2_5_MODEL,
  PRO_2_5_MODEL,
  FLASH_1_5_MODEL,
} from '../services/geminiModels.js';
import { resolveGoogleAiConfiguration } from '../services/googleClient.server.js';
import { cleanChainOfThoughtLeaks, generateContentStreamWithResilience } from '../services/geminiService.server.js';

// Test 1: getChatModelFallbackChain for Pro model
const proChain = getChatModelFallbackChain(PRO_3_1_MODEL);
assert.equal(proChain[0], PRO_3_1_MODEL, 'First model must be requested Pro model');
assert.ok(proChain.includes(FLASH_3_8_MODEL), 'Must include 3.8 Flash in fallback');
assert.ok(proChain.includes(FLASH_2_5_MODEL), 'Must include 2.5 Flash in fallback');
assert.ok(proChain.includes(PRO_2_5_MODEL), 'Must include 2.5 Pro in fallback for Pro requests');
assert.ok(proChain.includes(FLASH_1_5_MODEL), 'Must include 1.5 Flash in fallback');

// Test 2: getChatModelFallbackChain for Flash model
const flashChain = getChatModelFallbackChain(FLASH_3_8_MODEL);
assert.equal(flashChain[0], FLASH_3_8_MODEL, 'First model must be requested Flash model');
assert.ok(flashChain.includes(FLASH_2_5_MODEL), 'Must include 2.5 Flash in fallback');
assert.ok(flashChain.includes(FLASH_1_5_MODEL), 'Must include 1.5 Flash in fallback');

// Test 3: resolveGoogleAiConfiguration supports GEMINI_API_KEY and Vertex AI
const configFromGeminiKey = resolveGoogleAiConfiguration({ GEMINI_API_KEY: 'test-gemini-key-456' });
assert.deepEqual(configFromGeminiKey, { mode: 'api_key', apiKey: 'test-gemini-key-456' });

const configFromVertex = resolveGoogleAiConfiguration({ GOOGLE_CLOUD_PROJECT: 'test-gcp-project' });
assert.deepEqual(configFromVertex, { mode: 'vertex', project: 'test-gcp-project', location: 'global' });

// Test 4: cleanChainOfThoughtLeaks cleans thought tags and system instructions
const noisyReply = "الحمد لله يا صاحبي، كل تمام ||| [system prompt: do not sound like an ai] ||| اخبارك انت ايه؟";
const cleaned = cleanChainOfThoughtLeaks(noisyReply);
assert.ok(!cleaned.includes("system prompt"), 'Must strip system prompt leaks');
assert.ok(cleaned.includes("الحمد لله يا صاحبي"), 'Must preserve authentic reply');
assert.ok(cleaned.includes("اخبارك انت ايه؟"), 'Must preserve authentic conversation');

// Test 5: streaming fallback covers failures thrown during async iteration
const requestedModels: string[] = [];
const throwingBeforeText = async function* () {
  throw new Error('primary stream iteration failed');
};
const fallbackText = async function* () {
  yield { text: 'fallback reply' };
};
const fakeAi = {
  models: {
    generateContentStream: async ({ model }: { model: string }) => {
      requestedModels.push(model);
      return requestedModels.length === 1 ? throwingBeforeText() : fallbackText();
    },
  },
};

const { stream } = await generateContentStreamWithResilience(fakeAi, {
  model: PRO_3_1_MODEL,
  contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
  config: {},
});
const streamedChunks: any[] = [];
for await (const chunk of stream) {
  streamedChunks.push(chunk);
}
assert.deepEqual(streamedChunks, [{ text: 'fallback reply' }]);
assert.equal(requestedModels[0], PRO_3_1_MODEL);
assert.equal(requestedModels[1], FLASH_3_8_MODEL);

console.log('Gemini resilience and fallback chain tests passed successfully.');
