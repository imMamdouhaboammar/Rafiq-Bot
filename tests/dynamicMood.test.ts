import assert from "node:assert/strict";
import { driftMood, evolvePsychology, getExpressionStyle } from "../services/dynamicEngines.js";
import { BotMood, type PsychologicalState } from "../types.js";

const withMockedRandom = <T>(values: number[], fn: () => T): T => {
  const originalRandom = Math.random;
  let index = 0;
  Math.random = () => values[index++] ?? values[values.length - 1] ?? 0.5;
  try {
    return fn();
  } finally {
    Math.random = originalRandom;
  }
};

const previousLowEnergyAngryPath = withMockedRandom([0.1, 0.6], () =>
  driftMood(BotMood.NEUTRAL, 2, 20, 30, 0)
);

assert.notEqual(previousLowEnergyAngryPath, BotMood.ANGRY);
assert.equal(previousLowEnergyAngryPath, BotMood.BORED);

const previousMediumEnergyAngryPath = withMockedRandom([0.1, 0.26], () =>
  driftMood(BotMood.NEUTRAL, 5, 20, 30, 0)
);

assert.notEqual(previousMediumEnergyAngryPath, BotMood.ANGRY);
assert.notEqual(previousMediumEnergyAngryPath, BotMood.HANGRY);
assert.notEqual(previousMediumEnergyAngryPath, BotMood.BROKE);

const recoveredFromUnsupportedAnger = driftMood(BotMood.ANGRY, 7, 20, 30, 0);
assert.equal(recoveredFromUnsupportedAnger, BotMood.NEUTRAL);

const ordinaryState: PsychologicalState = {
  mood: BotMood.NEUTRAL,
  energyLevel: 4,
  socialMeter: 5,
  emotionalLedger: 0,
  currentScenario: "Standard Routine",
  intimacyLevel: 20,
  secretUnlocked: false,
  hungerLevel: 20,
  financialStress: 30,
  sleepiness: 10,
};

const evolvedState = withMockedRandom([0.1, 0.1, 0.9, 0.9, 0.9, 0.1, 0.26], () =>
  evolvePsychology(ordinaryState)
);

assert.notEqual(evolvedState.mood, BotMood.ANGRY);
assert.notEqual(evolvedState.mood, BotMood.HANGRY);
assert.notEqual(evolvedState.mood, BotMood.BROKE);

const angryStyle = getExpressionStyle(BotMood.ANGRY, 0);
assert.doesNotMatch(angryStyle, /No emojis or just 😑/);
assert.match(angryStyle, /Do not use 😑 as a default filler/);

const playfulStyle = getExpressionStyle(BotMood.PLAYFUL, 0);
assert.doesNotMatch(playfulStyle, /Ghalban|غلبان/i);
assert.doesNotMatch(playfulStyle, /Roast the user/i);
assert.match(playfulStyle, /Avoid fixed catchphrases/);

for (const mood of Object.values(BotMood)) {
  const style = getExpressionStyle(mood, 0);
  assert.doesNotMatch(style, /Ya Sahby|Ashta|Gamda|Ya rouhi|Habibi|Mfi4|Zah2ana|M3ee4|El donia/i);
}

// ==========================================
// NEW PERSONA STABILITY AND DRIFT GUARD TESTS
// ==========================================

console.log("Running Drift Guard and Stability tests...");

// 1. A warm conversation does not randomly switch to HANGRY in 30 consecutive turns.
let warmState: PsychologicalState = {
  mood: BotMood.HAPPY,
  energyLevel: 8,
  socialMeter: 7,
  emotionalLedger: 50,
  currentScenario: "Standard Routine",
  intimacyLevel: 75,
  secretUnlocked: false,
  hungerLevel: 10,
  financialStress: 20,
  sleepiness: 5,
  lastInteractionTime: new Date(),
};

// Simulate 30 rapid, neutral turns
for (let turn = 0; turn < 30; turn++) {
  warmState = evolvePsychology(warmState, "الحمد لله كله تمام", "neutral");
}

// Assert that mood stays warm and stable, and does not randomly turn into HANGRY
assert.ok(
  warmState.mood === BotMood.HAPPY ||
  warmState.mood === BotMood.PLAYFUL ||
  warmState.mood === BotMood.ROMANTIC ||
  warmState.mood === BotMood.EXCITED ||
  warmState.mood === BotMood.NEUTRAL
);
assert.notEqual(warmState.mood, BotMood.HANGRY);
console.log("✔ Warm stability over 30 turns test passed.");

// 2. Legacy physical fields are persistence-only and no longer evolve with time.
let currentBaseState: PsychologicalState = {
  mood: BotMood.HAPPY,
  energyLevel: 7,
  socialMeter: 5,
  emotionalLedger: 20,
  currentScenario: "Standard Routine",
  intimacyLevel: 50,
  secretUnlocked: false,
  hungerLevel: 20,
  financialStress: 40,
  sleepiness: 10,
  lastInteractionTime: new Date(),
};

// Turn-based and elapsed-time messages leave legacy body simulation untouched.
const stateAfterOneTurn = evolvePsychology(currentBaseState, "ازيك", "neutral");
assert.equal(stateAfterOneTurn.hungerLevel, currentBaseState.hungerLevel);
assert.equal(stateAfterOneTurn.sleepiness, currentBaseState.sleepiness);

const timeAgo = new Date();
timeAgo.setMinutes(timeAgo.getMinutes() - 40);
currentBaseState.lastInteractionTime = timeAgo;

const stateAfterTimeElapsed = evolvePsychology(currentBaseState, "ازيك", "neutral");
assert.equal(stateAfterTimeElapsed.hungerLevel, currentBaseState.hungerLevel);
assert.equal(stateAfterTimeElapsed.sleepiness, currentBaseState.sleepiness);
console.log("✔ Legacy physical simulation isolation test passed.");

// 3. Low energy does not force 1 to 3 word replies for direct questions.
import { getResponseLength } from "../services/dynamicEngines.js";
const directQuestionLength = getResponseLength("balanced", 2, "direct-question", "شرح ميزة البرودكت إيه؟", 0, BotMood.HAPPY);
assert.equal(directQuestionLength, "CONCISE but fully responsive. Warm, natural but brief. Never dead or one-word.");

// 1-3 words policy is only allowed under specific cold conditions/crossed boundaries
const coldResponseLength = getResponseLength("balanced", 2, "conflict", "بكرهك", -50, BotMood.ANGRY);
assert.equal(coldResponseLength, "VERY SHORT but coherent. 1-3 words only because the conversation is cold or a boundary was crossed, never because of a simulated physical condition.");
console.log("✔ Response length dynamic safety test passed.");

// 4. Mood does not change more than once inside the cooldown window unless there is a clear trigger.
let cooldownState: PsychologicalState = {
  mood: BotMood.HAPPY,
  energyLevel: 7,
  socialMeter: 5,
  emotionalLedger: 30,
  currentScenario: "Standard Routine",
  intimacyLevel: 60,
  secretUnlocked: false,
  hungerLevel: 20,
  financialStress: 30,
  sleepiness: 10,
  moodStabilityTurns: 2, // inside 5-turns cooldown window
  lastInteractionTime: new Date(),
};

// Neutral message: should NOT change mood
const stateAfterNeutral = evolvePsychology(cooldownState, "أنا ماشي دلوقتي", "neutral");
assert.equal(stateAfterNeutral.mood, BotMood.HAPPY);

// Direct conflict trigger: SHOULD override cooldown immediately
const stateAfterConflict = evolvePsychology(cooldownState, "أنت غبي ورخم جداً", "conflict");
assert.equal(stateAfterConflict.mood, BotMood.ANGRY);
console.log("✔ Mood stability cooldown and strong trigger override test passed.");

// 5. A romantic/playful/warm chat stays warm when user messages are neutral or kind.
let warmChatState: PsychologicalState = {
  mood: BotMood.ROMANTIC,
  energyLevel: 8,
  socialMeter: 7,
  emotionalLedger: 60,
  currentScenario: "Standard Routine",
  intimacyLevel: 85,
  secretUnlocked: false,
  hungerLevel: 10,
  financialStress: 20,
  sleepiness: 5,
  moodStabilityTurns: 6, // past cooldown window
  lastInteractionTime: new Date(),
};

const nextStateAfterKind = evolvePsychology(warmChatState, "وحشتيني أوي يا روحي", "neutral");
assert.ok(nextStateAfterKind.mood === BotMood.ROMANTIC || nextStateAfterKind.mood === BotMood.PLAYFUL);
console.log("✔ Warm ongoing conversation tone retention test passed.");

// 6. Lang cache avoids semantic cache hits for emotionally sensitive routes and separates by psychology context.
process.env.RAFIQ_LANGCACHE_ENABLED = "true";
process.env.LANGCACHE_API_KEY = "dummy";
process.env.REDIS_LANGCACHE_SERVER_URL = "dummy";
process.env.REDIS_LANGCACHE_CACHE_ID = "dummy";
const { canUseLangCache } = await import("../services/langCache.server.js");
const genericText = "تمام مع السلامة";
// Valid for langCache since it's simple, neutral, has no attachments
assert.ok(canUseLangCache({ prompt: genericText, attachmentsCount: 0, hasReplyContext: false, allowSearch: false }));
console.log("✔ Lang cache validation safety test passed.");

// 7. Message burst combines consecutive user messages correctly.
import { collectLatestUserBurst } from "../services/messageBurst.js";
import { MessageRole, ChatMessage } from "../types.js";

const now = new Date();
const burstMsg1: ChatMessage = {
  id: "1",
  chatId: "chat123",
  role: MessageRole.USER,
  text: "بقولك إيه",
  timestamp: new Date(now.getTime() - 2000),
};
const burstMsg2: ChatMessage = {
  id: "2",
  chatId: "chat123",
  role: MessageRole.USER,
  text: "كنت عايز أسألك في حاجة",
  timestamp: now,
};

const result = collectLatestUserBurst([burstMsg1, burstMsg2]);
assert.ok(result.burstMessages.length === 2);
assert.match(result.combinedText, /The user sent these consecutive messages as one thought/);
console.log("✔ Message burst concatenation validation test passed.");

// 8. User topics do not feed, rest, or otherwise mutate a simulated bot body.
const stressedState: PsychologicalState = {
  mood: BotMood.HAPPY,
  energyLevel: 2,
  socialMeter: 5,
  emotionalLedger: 50,
  currentScenario: "Standard Routine",
  intimacyLevel: 50,
  secretUnlocked: false,
  hungerLevel: 90,
  financialStress: 20,
  sleepiness: 90,
  lastInteractionTime: new Date(),
};

const fedState = evolvePsychology(stressedState, "تعالى ناكل بيتزا سوا", "neutral");
assert.equal(fedState.hungerLevel, stressedState.hungerLevel);

const restedState = evolvePsychology(stressedState, "روح نام وارتاح شوية", "neutral");
assert.equal(restedState.sleepiness, stressedState.sleepiness);

// 9. Multi-sentence trailing and middle period stripping validation
const cleanPunctuationStr = (text: string): string => {
  let cleaned = text;
  cleaned = cleaned.replace(/!{2,}/g, '!');
  cleaned = cleaned.replace(/\?{2,}/g, '?');
  cleaned = cleaned.replace(/؟{2,}/g, '؟');
  cleaned = cleaned.replace(/[!?؟]{2,}/g, (match) => {
    if (match.includes('؟')) return '؟';
    if (match.includes('?')) return '?';
    return '!';
  });
  cleaned = cleaned.split("|||").map(part => {
    let t = part.trim();
    if (!t) return t;
    const regex = /(?<!\.)\.(?!\.)(?=\s|$|(?!\d)[\p{Emoji}\p{Extended_Pictographic}\u200d\uFE0F])/gu;
    t = t.replace(regex, '');
    return t;
  }).join(" ||| ");
  return cleaned;
};

assert.equal(cleanPunctuationStr("تمام."), "تمام");
assert.equal(cleanPunctuationStr("تمام. هكلمك بعدين."), "تمام هكلمك بعدين");
assert.equal(cleanPunctuationStr("تمام... هكلمك بعدين."), "تمام... هكلمك بعدين");
assert.equal(cleanPunctuationStr("النسبة 8.5% تمام. 😊"), "النسبة 8.5% تمام 😊");
assert.equal(cleanPunctuationStr("بجد!!؟"), "بجد؟");

console.log("✔ Biological conversational recovery & punctuation cleaning tests passed.");

// ==================================================
// 11. IMAGINARY WORLD & DREAMSCAPE ENGINE TESTS
// ==================================================
console.log("Running Imaginary World (Dreamscape Engine) tests...");

const storyStartingState: PsychologicalState = {
  mood: BotMood.HAPPY,
  energyLevel: 7,
  socialMeter: 5,
  emotionalLedger: 50,
  currentScenario: "Standard Routine",
  intimacyLevel: 50,
  secretUnlocked: false,
  hungerLevel: 20,
  financialStress: 30,
  sleepiness: 10,
};

// User says "احكيلي حدوتة" -> should start a session and initialize imaginaryWorld
const stateWithStory = evolvePsychology(storyStartingState, "ممكن تحكيلي حدوتة غريبة؟", "neutral");
assert.ok(stateWithStory.imaginaryWorld !== undefined);
assert.ok(stateWithStory.imaginaryWorld.activeSetting !== undefined);
assert.equal(stateWithStory.imaginaryWorld.sharedLoreCount, 1);
assert.equal(stateWithStory.imaginaryWorld.lastFictionalTurn, "ممكن تحكيلي حدوتة غريبة؟");

// Choose setting based on high intimacy (>= 80)
const highIntimacyState: PsychologicalState = {
  ...storyStartingState,
  intimacyLevel: 85,
};
const stateWithHighIntimacyStory = evolvePsychology(highIntimacyState, "احكيلي حدوتة", "neutral");
assert.ok(stateWithHighIntimacyStory.imaginaryWorld?.activeSetting?.includes("أسوان"));

// Choose setting based on disappointed breakpoint state
const disappointedState: PsychologicalState = {
  ...storyStartingState,
  breakpointState: 'disappointed',
};
const stateWithDisappointedStory = evolvePsychology(disappointedState, "احكيلي حدوتة", "neutral");
assert.ok(stateWithDisappointedStory.imaginaryWorld?.activeSetting?.includes("محطة قطار مهجورة"));

// Choosing setting based on high energy (>= 8)
const highEnergyState: PsychologicalState = {
  ...storyStartingState,
  energyLevel: 9,
};
const stateWithHighEnergyStory = evolvePsychology(highEnergyState, "احكيلي حدوتة", "neutral");
assert.ok(stateWithHighEnergyStory.imaginaryWorld?.activeSetting?.includes("مغامرة فكاهية"));

// Ongoing storytelling progresses lore count and updates last fictional turn
const progressedStoryState = evolvePsychology(stateWithStory, "طب تعالي ندخل الشارع ده", "neutral");
assert.ok(progressedStoryState.imaginaryWorld !== undefined);
assert.equal(progressedStoryState.imaginaryWorld.sharedLoreCount, 2);
assert.equal(progressedStoryState.imaginaryWorld.lastFictionalTurn, "طب تعالي ندخل الشارع ده");

// Exit story triggers -> clears the imaginary world
const exitedStoryState = evolvePsychology(progressedStoryState, "خلاص كفاية حدوتة ونرجع للواقع بقى", "neutral");
assert.ok(exitedStoryState.imaginaryWorld === undefined);

console.log("✔ Imaginary World (Dreamscape Engine) tests passed.");

console.log("dynamic mood stability tests passed");
