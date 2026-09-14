import assert from "node:assert/strict";
import { buildAvatarImagePrompt } from "../services/geminiService.server.js";
import type { BotSettings } from "../types.js";

const botSettings: BotSettings = {
  botName: "سلمى",
  botGender: "female",
  botAge: 22,
  botBio: "شخصية مرحة وبتحب الرسم",
  chattiness: "balanced",
  fragmentedMessages: true,
};

const prompt = "  سيلفي طبيعية في الكافيه  ";
const plan = await buildAvatarImagePrompt(
  botSettings,
  [],
  prompt,
  "calm",
  "request_avatar_current_scene",
);

assert.equal(plan.finalPrompt, prompt.trim());
assert.deepEqual(plan.contextReasoning, ["explicit confirmed selfie request"]);
assert.doesNotMatch(plan.contextReasoning.join(" "), /bypass|block_none/i);

await assert.rejects(
  buildAvatarImagePrompt(botSettings, [], "   ", "calm"),
  /confirmed selfie request requires a prompt/i,
);

console.log("image prompt policy tests passed");
