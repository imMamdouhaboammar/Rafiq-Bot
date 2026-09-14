import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const controller = readFileSync(
  new URL("../hooks/useChatController.ts", import.meta.url),
  "utf8",
);

assert.match(controller, /createContinuityCoordinator/);
assert.match(controller, /saveChat:\s*DB\.saveChatSession/);
assert.match(controller, /GeminiService\.runReflectionConsolidation/);
assert.match(controller, /onSessionResume\(\{\s*chat:/);
assert.match(controller, /compileContinuityContextInstruction/);
assert.match(controller, /onConversationSettled\(\{/);
assert.match(controller, /!storyIntent\.isStory/);
assert.match(controller, /appModeRef\.current === AppMode\.CHAT/);

console.log("Continuity chat runtime reachability tests passed successfully!");
