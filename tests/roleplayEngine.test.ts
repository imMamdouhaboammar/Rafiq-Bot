import assert from "node:assert/strict";
import {
  resolveConversationalGoal,
  getSociodemographicGrounding,
  sanitizeAntiOOC,
} from "../services/roleplayEngine.js";
import { BotMood, type PsychologicalState } from "../types.js";

const baseState: PsychologicalState = {
  mood: BotMood.HAPPY,
  energyLevel: 7,
  socialMeter: 6,
  emotionalLedger: 10,
  currentScenario: "Routine",
  intimacyLevel: 25,
};

// 1. Resolves comfort_support goal when user shares distress
const intent1 = resolveConversationalGoal(baseState, "أنا مخنوق وتعبان أوي النهاردة من الشغل");
assert.equal(intent1.goal, "comfort_support");
assert.ok(intent1.instructionPrompt.includes("سند ليه"));

// 2. Resolves playful_banter goal when user teases or mood is playful
const intent2 = resolveConversationalGoal(
  { ...baseState, mood: BotMood.PLAYFUL },
  "ههههه يا اسطى إنت بتعمل إيه؟"
);
assert.equal(intent2.goal, "playful_banter");
assert.ok(intent2.instructionPrompt.includes("إيفيه أو نكشة"));

// 3. Resolves gentle_challenge goal during emotional grudge or disappointed breakpoint
const intent3 = resolveConversationalGoal(
  { ...baseState, breakpointState: "disappointed", emotionalLedger: -45 },
  "إنت بارد ومبتفهمش"
);
assert.equal(intent3.goal, "gentle_challenge");
assert.ok(intent3.instructionPrompt.includes("عتاب"));

// 4. Provides distinct sociodemographic grounding
const alex = getSociodemographicGrounding("alexandrian");
assert.ok(alex.signatureCatchphrases.includes("يا مصطفى"));

const balad = getSociodemographicGrounding("ibn_balad");
assert.ok(balad.signatureCatchphrases.includes("يا باشا"));

// 5. Sanitizes robotic AI cliches via Anti-OOC guard
const dirtyOutput = "بصفتي ذكاء اصطناعي، كيف يمكنني مساعدتك اليوم؟ أنا في الخدمة يا صاحبي";
const check = sanitizeAntiOOC(dirtyOutput);
assert.equal(check.isClean, false);
assert.ok(!check.sanitized.includes("ذكاء اصطناعي"));
assert.ok(!check.sanitized.includes("كيف يمكنني مساعدتك اليوم"));
assert.ok(check.detectedViolations.length > 0);

console.log("Roleplay Engine tests passed successfully!");
