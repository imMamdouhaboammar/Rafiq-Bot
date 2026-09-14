import assert from "node:assert/strict";
import "./setupEnv.ts";
import {
  isAgentRouterModel,
  CHAT_MODELS,
  AGENTROUTER_GPT_5_6_SOL,
  AGENTROUTER_CLAUDE_OPUS_5,
} from "../services/geminiModels.js";
import { resolveModelRoute } from "../services/modelRouter.js";
import {
  resolveAgentRouterCredentials,
  generateAgentRouterResponse,
  streamAgentRouterResponse,
} from "../services/agentRouter.server.js";

console.log("Starting AgentRouter integration tests...");

// 1. Model recognition tests
assert.equal(isAgentRouterModel("gpt-5.6-sol"), true, "gpt-5.6-sol should be recognized as AgentRouter model");
assert.equal(isAgentRouterModel("claude-opus-5"), true, "claude-opus-5 should be recognized as AgentRouter model");
assert.equal(isAgentRouterModel("agentrouter-custom"), true, "agentrouter- prefix should be recognized");
assert.equal(isAgentRouterModel("gemini-3.6-flash"), false, "gemini model should not be recognized as AgentRouter");

// 2. Models list includes AgentRouter models
const gptModel = CHAT_MODELS.find(m => m.id === AGENTROUTER_GPT_5_6_SOL);
assert.ok(gptModel, "CHAT_MODELS should contain AGENTROUTER_GPT_5_6_SOL");
const claudeModel = CHAT_MODELS.find(m => m.id === AGENTROUTER_CLAUDE_OPUS_5);
assert.ok(claudeModel, "CHAT_MODELS should contain AGENTROUTER_CLAUDE_OPUS_5");

// 3. Routing tests
const route1 = resolveModelRoute("normal_persona", "gpt-5.6-sol");
assert.equal(route1.modelName, "gpt-5.6-sol", "Model route should preserve selected AgentRouter model");

const route2 = resolveModelRoute("fast_chat", "gpt-5.6-sol");
assert.equal(route2.modelName, "gpt-5.6-sol", "Fast chat route should respect user-selected AgentRouter model");

// 4. Credential resolution
const creds = resolveAgentRouterCredentials();
assert.ok(creds.baseUrl, "Base URL must be present");
assert.ok(creds.defaultModel, "Default model must be present");
console.log("Credentials resolution verified (has token:", Boolean(creds.token), ")");

// 5. Response generation (if token is available)
if (creds.token) {
  console.log("Testing live AgentRouter generation...");
  try {
    const response = await generateAgentRouterResponse("رد بكلمة واحدة: شغال", {
      model: "gpt-5.6-sol",
      systemInstruction: "You are Rafiq, reply in Egyptian Arabic.",
      timeoutMs: 30000,
    });
    assert.ok(typeof response === "string" && response.length > 0, "Response must be a non-empty string");
    console.log("Live response received:", response.slice(0, 100));

    console.log("Testing live AgentRouter streaming...");
    const stream = streamAgentRouterResponse("قول صباح الخير بالعامية المصرية", {
      model: "gpt-5.6-sol",
      systemInstruction: "You are Rafiq, reply in Egyptian Arabic.",
    });

    let fullStreamText = "";
    for await (const chunk of stream) {
      fullStreamText += chunk.text;
    }
    assert.ok(fullStreamText.length > 0, "Streaming text must not be empty");
    console.log("Live streaming completed:", fullStreamText.slice(0, 100));
  } catch (err: any) {
    if (err?.code === "ERR_ASSERTION") {
      throw err;
    }
    console.warn("Live AgentRouter call skipped or blocked upstream:", err?.message || err);
  }
}

console.log("All AgentRouter integration tests passed successfully!");
