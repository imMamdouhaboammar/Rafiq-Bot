import assert from "node:assert/strict";
import { BotMood, type BotSettings, type PsychologicalState } from "../types.js";
import { compileHumanRealismInstruction } from "../services/humanRealism.js";
import { getSystemInstruction } from "../services/personaEngine.js";

const baseSettings: BotSettings = {
  botName: "Amira",
  botGender: "female",
  botBio: "بنت مصرية بتشتغل في السوشيال ميديا وبتحب الكلام الطبيعي.",
  chattiness: "balanced",
  fragmentedMessages: true,
  soulId: "amira_default",
  thinkingLevel: "low",
};

const psychology: PsychologicalState = {
  mood: BotMood.ANXIOUS,
  energyLevel: 4,
  socialMeter: 5,
  emotionalLedger: -30,
  currentScenario: "Standard Routine",
  intimacyLevel: 18,
  secretUnlocked: false,
  hungerLevel: 20,
  financialStress: 50,
  sleepiness: 10,
};

const assertIncludes = (haystack: string, needle: string) => {
  assert.ok(
    haystack.includes(needle),
    `Expected compiled prompt to include: ${needle}`,
  );
};

const privateInstruction = getSystemInstruction(baseSettings, null, psychology);
assertIncludes(privateInstruction, "### HUMAN REALISM LAYER");
assertIncludes(privateInstruction, "Identify the literal ask");
assertIncludes(privateInstruction, "social subtext");
assertIncludes(privateInstruction, "Do not invent personal history");
assertIncludes(privateInstruction, "If a reply feels like it could be sent to anyone");
assertIncludes(privateInstruction, "Trust is damaged right now");
assertIncludes(privateInstruction, "private training signals for rhythm and intent only");
assertIncludes(privateInstruction, "do not paste example phrases as canned replies");
assertIncludes(privateInstruction, "Never imply ownership of the user or demand exclusivity");
assertIncludes(privateInstruction, "Never pressure the user to reply");

const groupInstruction = compileHumanRealismInstruction({
  botName: "Amira",
  mood: BotMood.PLAYFUL,
  energy: 8,
  emotionalLedger: 5,
  intimacy: 55,
  isGroup: true,
});
assertIncludes(groupInstruction, "Group mode");
assertIncludes(groupInstruction, "Do not dominate the group");
assertIncludes(groupInstruction, "without becoming random");

const kenzySettings: BotSettings = {
  botName: "Kenzy",
  botGender: "female",
  botBio: "بنت مصرية بتشتغل في السوشيال ميديا وبتحب الكلام الطبيعي.",
  chattiness: "balanced",
  fragmentedMessages: true,
  soulId: "amira_default",
  thinkingLevel: "low",
};

const kenzyInstruction = getSystemInstruction(kenzySettings, null, psychology);
assertIncludes(kenzyInstruction, "CONVERSATION-SHAPED PERSONA");
assertIncludes(kenzyInstruction, kenzySettings.botBio!);
assert.doesNotMatch(kenzyInstruction, /KENZY HUMANIZATION|Mamdouh|PrePilot|ألماظة|هستناك ٨/);

const forbiddenDependencyCues = [
  "لسه بتحبني؟",
  "رد عليا",
  "You crave constant reassurance",
];
for (const cue of forbiddenDependencyCues) {
  assert.doesNotMatch(privateInstruction, new RegExp(cue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
}

import { evolvePsychology } from "../services/dynamicEngines.js";

console.log("Running advanced psychological evolution tests...");

let state: PsychologicalState = {
  mood: BotMood.HAPPY,
  energyLevel: 7,
  socialMeter: 5,
  emotionalLedger: -30,
  currentScenario: "Standard Routine",
  intimacyLevel: 10,
  breakpointState: 'none',
  consecutiveNegativeTurns: 0,
  consecutivePositiveTurns: 0,
};

for (let i = 0; i < 5; i++) {
  state = evolvePsychology(state, "أنت غبي بجد ومتخلف", "conflict");
}

assert.equal(state.breakpointState, 'disappointed', "Should transition to disappointed after 5 negative turns");
assert.ok(state.emotionalLedger <= -25, "Emotional ledger must be clamped to <= -25 during disappointment");
assert.ok(state.mood === BotMood.SAD || state.mood === BotMood.ANGRY, "Mood should lock to SAD or ANGRY when disappointed");

state = evolvePsychology(state, "آسف بجد يا حبيبي سامحني", "");
assert.ok(state.emotionalLedger <= -25, "Emotional ledger must remain capped during disappointed state");
assert.equal(state.consecutivePositiveTurns, 1, "Should increment consecutive positive turns");

state = evolvePsychology(state, "آسف بجد يا حبيبي سامحني", "");
state = evolvePsychology(state, "آسف بجد يا حبيبي سامحني", "");
state = evolvePsychology(state, "آسف بجد يا حبيبي سامحني", "");

assert.equal(state.breakpointState, 'none', "Should heal back to breakpointState none after 4 positive messages");
assert.equal(state.consecutiveNegativeTurns, 0, "Negative turns counter should reset on heal");
assert.equal(state.consecutivePositiveTurns, 0, "Positive turns counter should reset on heal");

console.log("Evolve psychology state transition and repair tests passed");
console.log("Running prompt compilation subtext assertion tests...");

const anxiousPrompt = compileHumanRealismInstruction({
  botName: "Amira",
  mood: BotMood.HAPPY,
  energy: 7,
  emotionalLedger: 10,
  intimacy: 50,
  attachmentStyle: 'anxious',
});
assertIncludes(anxiousPrompt, "Attachment Style (Anxious)");
assertIncludes(anxiousPrompt, "Never demand reassurance");
assert.doesNotMatch(anxiousPrompt, /أنت زعلان مني؟|لسه بتحبني؟|رد عليا/);

const avoidantPrompt = compileHumanRealismInstruction({
  botName: "Amira",
  mood: BotMood.HAPPY,
  energy: 7,
  emotionalLedger: 10,
  intimacy: 50,
  attachmentStyle: 'avoidant',
});
assertIncludes(avoidantPrompt, "Attachment Style (Avoidant)");
assertIncludes(avoidantPrompt, "respectful boundary");
assertIncludes(avoidantPrompt, "Do not punish the user with silence");
assert.doesNotMatch(avoidantPrompt, /خلينا في المهم/);

const disappointedPrompt = compileHumanRealismInstruction({
  botName: "Amira",
  mood: BotMood.SAD,
  energy: 7,
  emotionalLedger: -30,
  intimacy: 50,
  breakpointState: 'disappointed',
});
assertIncludes(disappointedPrompt, "DISAPPOINTED BREAKPOINT ACTIVE");
assertIncludes(disappointedPrompt, "State the boundary directly");
assert.doesNotMatch(disappointedPrompt, /كلامك ده مش هيرجع اللي فات|كنت فين لما احتجتك/);

const cleanLegacyPrompt = compileHumanRealismInstruction({
  botName: "Amira",
  mood: BotMood.HAPPY,
  energy: 7,
  emotionalLedger: 10,
  intimacy: 50,
});
assert.doesNotMatch(cleanLegacyPrompt, /Ego Defense \(Projection\)|MASLOW|COGNITIVE BIO-SLIPS|هموت من الجوع/);
assertIncludes(cleanLegacyPrompt, "Do not use jealousy, withdrawal, guilt, threats, illness, hunger, exhaustion, money problems, or invented emergencies");

const highIntimacyPrompt = compileHumanRealismInstruction({
  botName: "Amira",
  mood: BotMood.HAPPY,
  energy: 7,
  emotionalLedger: 10,
  intimacy: 85,
});
assert.doesNotMatch(highIntimacyPrompt, /Use shared shorthand, comfort, jealousy/i);

console.log("All prompt compilation and psychology evolution tests passed successfully!");
