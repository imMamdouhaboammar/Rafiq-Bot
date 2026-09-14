import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const controllerSource = await readFile(new URL('../hooks/useChatController.ts', import.meta.url), 'utf8');
const serviceSource = await readFile(new URL('../services/geminiService.ts', import.meta.url), 'utf8');
const devServerSource = await readFile(new URL('../server.ts', import.meta.url), 'utf8');
const vercelStreamSource = await readFile(new URL('../api/gemini-stream.ts', import.meta.url), 'utf8');

assert.match(serviceSource, /signal:\s*options\?\.signal/);
assert.match(serviceSource, /createGeminiStreamRequestOptions/);
assert.match(
  controllerSource,
  /GeminiService\.createGeminiStreamRequestOptions\(lease\.signal\)/,
  'the active chat stream must receive the current generation lease signal',
);
assert.match(controllerSource, /if \(isAbortLikeError\(error\)\) throw error/);
assert.match(controllerSource, /classifyConversationRoute\(conversationText/);
assert.match(controllerSource, /messageText:\s*conversationText/);
assert.match(devServerSource, /args\[13\][^\n]*dynamicsInstruction/);
assert.match(vercelStreamSource, /args\[13\][^\n]*dynamicsInstruction/);

console.log('Streaming cancellation and response-quality reachability tests passed.');
