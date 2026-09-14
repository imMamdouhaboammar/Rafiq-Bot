import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (relativePath: string): string => readFileSync(
  new URL(relativePath, import.meta.url),
  "utf8",
);

const client = read("../services/geminiService.ts");
const vercelApi = read("../api/gemini.ts");
const devServer = read("../server.ts");
const dailyStageDirector = read("../services/dailyStageDirector.ts");

assert.match(client, /runReflectionConsolidation/);
assert.match(client, /rpc\(['"]runReflectionConsolidation['"]/);

assert.match(vercelApi, /runReflectionConsolidation:\s*ReflectionEngine\.runReflectionConsolidation/);
assert.match(vercelApi, /validateReflectionArgs/);
assert.match(vercelApi, /consumeReflectionQuota/);

assert.match(devServer, /ReflectionEngine/);
assert.match(devServer, /runReflectionConsolidation:\s*ReflectionEngine\.runReflectionConsolidation/);

// Vercel executes emitted server modules with strict Node ESM resolution.
assert.match(dailyStageDirector, /from ['"]\.\.\/types\.js['"]/);

// Functional testing of reflection payload validation
const { validateReflectionArgs } = await import("../api/gemini.js");

const validPayload = {
  chatId: "chat-123",
  botId: "bot-123",
  botName: "رفيق",
  currentState: {
    mood: "neutral",
    intimacyLevel: 10,
    emotionalLedger: 5,
  },
  messages: [
    {
      id: "msg-1",
      chatId: "chat-123",
      role: "user",
      text: "ازيك يا رفيق",
      timestamp: new Date().toISOString(),
    },
  ],
};

assert.equal(validateReflectionArgs([validPayload]), true);

// Rejects empty messages array
assert.equal(validateReflectionArgs([{ ...validPayload, messages: [] }]), false);

// Rejects oversized message array (> 30)
const thirtyOneMessages = Array.from({ length: 31 }, (_, i) => ({
  id: `msg-${i}`,
  chatId: "chat-123",
  role: "user",
  text: `رسالة ${i}`,
  timestamp: new Date().toISOString(),
}));
assert.equal(validateReflectionArgs([{ ...validPayload, messages: thirtyOneMessages }]), false);

// Rejects unrecognized fields in messages
assert.equal(validateReflectionArgs([{
  ...validPayload,
  messages: [{ ...validPayload.messages[0], unexpectedField: "danger" }],
}]), false);

// Rejects missing currentState
assert.equal(validateReflectionArgs([{ ...validPayload, currentState: undefined }]), false);

console.log("Reflection RPC reachability tests passed successfully!");
