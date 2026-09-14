import assert from "node:assert/strict";
import { classifyResponsePath } from "../services/responseRouter.js";
import { resolveModelRoute } from "../services/modelRouter.js";
import { getCompiledPersona } from "../services/personaRuntimeCache.js";
import { PROMPT_BUDGETS } from "../services/promptBudget.js";
import { BotSettings } from "../types.js";

// 1. Test Response Pathway Classification
console.log("Running Response Pathway Classification Tests...");

assert.equal(classifyResponsePath("مساء الخير"), "fast_chat");
assert.equal(classifyResponsePath("تمام"), "fast_chat");
assert.equal(classifyResponsePath("هاخدك من تحت الشركة"), "fast_chat");
assert.equal(classifyResponsePath("وحشتيني"), "fast_chat");
assert.equal(classifyResponsePath("عاملة ايه"), "fast_chat");

assert.equal(classifyResponsePath("فاكرة لما نزلنا وسط البلد؟"), "memory_heavy");
assert.equal(classifyResponsePath("زي ما قولتلك قبل كده في كلامنا"), "memory_heavy");

assert.equal(classifyResponsePath("مخنوق أوي وزعلان خالص"), "deep_persona");
assert.equal(classifyResponsePath("أنا حزين ونفسيتي تعبانة جداً"), "deep_persona");

assert.equal(classifyResponsePath("ابعتيلي صورة ليكي وسيلفي"), "normal_persona");
assert.equal(classifyResponsePath("وريني صوره"), "fast_chat");

assert.equal(classifyResponsePath("عادي شات عادي وطبيعي خالص متوسط الطول"), "normal_persona");

assert.equal(classifyResponsePath("عادي شات عادي", [{ mimeType: "image/png", data: "base64..." }]), "tool_required");

console.log("✓ Response Pathway Classification tests passed!");

// 2. Test Prompt Budget Selection
console.log("Running Prompt Budget Selection Tests...");

const fastBudget = PROMPT_BUDGETS["fast_chat"];
assert.equal(fastBudget.maxSystemTokens, 2400);
assert.equal(fastBudget.maxMemoryItems, 0);
assert.equal(fastBudget.maxRecentMessages, 8);
assert.equal(fastBudget.includeFullSoul, false);
assert.equal(fastBudget.includeCompressedSoul, true);
assert.equal(fastBudget.includeExamples, false);

const deepBudget = PROMPT_BUDGETS["deep_persona"];
assert.equal(deepBudget.maxSystemTokens, 3200);
assert.equal(deepBudget.maxMemoryItems, 6);
assert.equal(deepBudget.maxRecentMessages, 20);
assert.equal(deepBudget.includeFullSoul, false);
assert.equal(deepBudget.includeCompressedSoul, true);
assert.equal(deepBudget.includeExamples, true);

console.log("✓ Prompt Budget tests passed!");

// 3. Test Persona Cache and Reusability
console.log("Running Persona Cache & Reusability Tests...");

const settings: BotSettings = {
  botName: "Kenzy",
  botGender: "female",
  botAge: 21,
  botBio: "شاب مصري هادي بيعشق القهوة...",
  soulId: "amira_default",
  soulTraits: {
    chaos: 30,
    empathy: 75,
    slang: 70,
    intellect: 50,
    positivity: 50,
  },
  model: "gemini-2.5-flash",
  thinkingLevel: "medium",
  fragmentedMessages: true,
};

const compiled1 = getCompiledPersona(settings);
const compiled2 = getCompiledPersona(settings);

// Reusing same cached object
assert.equal(compiled1, compiled2);
assert.equal(compiled1.displayName, "Kenzy");
assert.equal(compiled1.personaId, "Kenzy");

// Cache invalidates if settings change
const updatedSettings = { ...settings, botName: "Kenzy Updated" };
const compiled3 = getCompiledPersona(updatedSettings);
assert.notEqual(compiled1, compiled3);
assert.equal(compiled3.displayName, "Kenzy Updated");
assert.equal(compiled3.personaId, "Kenzy Updated");

console.log("✓ Persona Cache tests passed!");

// 4. Test Model Routing
console.log("Running Model Routing Tests...");

const routeFastWithoutThinking = resolveModelRoute("fast_chat", settings.model);
assert.equal(routeFastWithoutThinking.useThinking, false);
assert.equal(routeFastWithoutThinking.maxOutputTokens, 8192);

const routeFast = resolveModelRoute("fast_chat", settings.model, settings.thinkingLevel);
assert.equal(routeFast.useThinking, true, "an explicit user thinking level must be honored on fast chat");
assert.equal(routeFast.maxOutputTokens, 8192);

const routeDeep = resolveModelRoute("deep_persona", settings.model, settings.thinkingLevel);
assert.equal(routeDeep.useThinking, true);
assert.equal(routeDeep.maxOutputTokens, 8192);

console.log("✓ Model Routing tests passed!");
console.log("ALL LATENCY PIPELINE TESTS PASSED SUCCESSFULY!");
