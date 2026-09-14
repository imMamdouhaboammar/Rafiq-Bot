import assert from 'node:assert/strict';
import { consumeSseResponse } from '../services/sseStreamParser.js';

const responseFromChunks = (chunks: string[]): Response => {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  }), {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
};

const delivered: string[] = [];
const successful = await consumeSseResponse(
  responseFromChunks([
    'data: {"text":"hello ","urls":[{"title":"Source","uri":"https://example.com"}]}\n',
    '\ndata: {"te',
    'xt":"world","toolsUsed":["web_search"]}\n\ndata: [DONE]\n\n',
  ]),
  { onText: text => delivered.push(text) },
);

assert.deepEqual(delivered, ['hello ', 'world']);
assert.equal(successful.text, 'hello world');
assert.deepEqual(successful.urls, [{ title: 'Source', uri: 'https://example.com' }]);
assert.deepEqual(successful.toolsUsed, ['web_search']);

await assert.rejects(
  consumeSseResponse(
    responseFromChunks(['data: {"text":"provider failed","isError":true}\n\n']),
    { onText: () => undefined },
  ),
  /provider failed/,
  'server error chunks must reject instead of being treated as malformed JSON',
);

console.log('SSE stream parser tests passed.');
