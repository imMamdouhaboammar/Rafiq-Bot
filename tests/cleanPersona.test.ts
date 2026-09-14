import assert from "node:assert/strict";
import { BotMood, type BotSettings, type PsychologicalState } from "../types.js";
import { compileConversationShapedPersonaInstruction, removeRepeatedAssistantBubbles, sanitizePersonaReply } from "../services/conversationShapedPersona.js";
import { getBudgetedSystemInstruction, getSystemInstruction } from "../services/personaEngine.js";
import { compilePersona } from "../services/personaRuntimeCache.js";
import { evolvePsychology, getExpressionStyle, getResponseLength } from "../services/dynamicEngines.js";

const settings: BotSettings = {
  botName: "ليلى",
  botGender: "female",
  botBio: "ليلى مصممة هادية، بتحب الأفلام القديمة والكلام المباشر من غير دراما.",
  chattiness: "balanced",
  fragmentedMessages: true,
  soulId: "amira_default",
  impersonationProfile: "ردودها قصيرة وذكية، وبتسأل سؤال واحد لما تحتاج توضيح.",
};

const legacyExtremeState: PsychologicalState = {
  mood: BotMood.HANGRY,
  energyLevel: 1,
  socialMeter: 5,
  emotionalLedger: 0,
  currentScenario: "Standard Routine",
  intimacyLevel: 25,
  secretUnlocked: false,
  hungerLevel: 100,
  financialStress: 100,
  sleepiness: 100,
  lastInteractionTime: new Date(Date.now() - 12 * 60 * 60 * 1000),
};

const cleanPersona = compileConversationShapedPersonaInstruction({
  botBio: settings.botBio,
  impersonationProfile: settings.impersonationProfile,
  isGroup: false,
});
assert.match(cleanPersona, /USER-WRITTEN BIO IS THE PRIMARY IDENTITY SOURCE/);
assert.match(cleanPersona, /conversation/i);
assert.match(cleanPersona, /Do not invent bodily needs/i);
assert.doesNotMatch(cleanPersona, /هموت من الجوع|survival mode|sleep deprivation/i);

const forbiddenPhysicalRoleplay = /MASLOW|SURVIVAL MODE|Hunger:\s*100|Sleepiness:\s*100|You should be sleeping|هموت من الجوع|COGNITIVE BIO-SLIPS|Ego Defense \(Displacement\)/i;

const directPrompt = getSystemInstruction(settings, null, legacyExtremeState, undefined, undefined, undefined, "عامل إيه النهارده؟");
assert.match(directPrompt, /ليلى مصممة هادية/);
assert.match(directPrompt, /CONVERSATION-SHAPED PERSONA/);
assert.match(directPrompt, /CONVERSATION STYLE PRESET: Grounded/);
assert.match(directPrompt, /REPLY SHAPE POLICY: Direct First/);
assert.doesNotMatch(directPrompt, forbiddenPhysicalRoleplay);
assert.doesNotMatch(directPrompt, /hangry|broke mood/i);
assert.doesNotMatch(directPrompt, /THE SURVIVOR|Mamdouh|Kenzy|El Sand|emotional spending|campaigns|moderation/i);
assert.doesNotMatch(directPrompt, /CHAOS EXTREME|DEEP EMPATHY|RAW STREET VOICE|HEAVY HEART|BRILLIANT MESS/);

const budgetedPrompt = getBudgetedSystemInstruction(
  compilePersona(settings), settings, null, legacyExtremeState,
  undefined, undefined, undefined, undefined, "عامل إيه النهارده؟",
);
assert.match(budgetedPrompt, /CONVERSATION-SHAPED PERSONA/);
assert.doesNotMatch(budgetedPrompt, forbiddenPhysicalRoleplay);

const evolved = evolvePsychology(legacyExtremeState, "قوليلي رأيك في الفيلم ده", "neutral");
assert.equal(evolved.hungerLevel, legacyExtremeState.hungerLevel, "Legacy hunger data must no longer evolve or drive conversation");
assert.equal(evolved.sleepiness, legacyExtremeState.sleepiness, "Legacy sleepiness data must no longer evolve or drive conversation");
assert.equal(evolved.financialStress, legacyExtremeState.financialStress, "Random money stress must no longer shape persona");
assert.notEqual(evolved.mood, BotMood.HANGRY, "Legacy HANGRY state must normalize away without a user trigger");

assert.doesNotMatch(getExpressionStyle(BotMood.HANGRY, 0), /hunger|physical discomfort/i);
assert.doesNotMatch(getExpressionStyle(BotMood.BROKE, 0), /financially stressed|money/i);
assert.doesNotMatch(
  getResponseLength("balanced", 1, "conflict", "بكرهك", -50, BotMood.ANGRY),
  /Exhausted|No effort/i,
);

assert.equal(
  sanitizePersonaReply("الفيلم حلو ||| وأنا هموت من الجوع ومش قادرة أركز"),
  "الفيلم حلو",
  "The shared output gate must remove an invented suffering bubble without losing the useful reply",
);
assert.equal(
  sanitizePersonaReply("أنا مرهقة ومش قادرة أتكلم"),
  "قولّي أكتر",
  "A reply made only of invented suffering must fall back to a clean conversational continuation",
);
assert.equal(
  sanitizePersonaReply("خوفك من الموت مفهوم، إيه أكتر حاجة مخوفاك؟"),
  "خوفك من الموت مفهوم، إيه أكتر حاجة مخوفاك؟",
  "The gate must preserve a normal response to the user's difficult topic",
);
assert.equal(
  sanitizePersonaReply("وأنا هموت من الجوع، اطلبلي معاكي"),
  "قولّي أكتر",
  "The bot must not mirror a user's hunger by inventing its own bodily state",
);

for (const inventedClaim of [
  "أنا مريضة وعندي صداع",
  "معيش جنيه وفلوسي خلصت",
  "الشغل موتني النهارده",
  "حصلي حادث ومش قادرة أتكلم",
  "I'm exhausted and need to sleep",
  "I'm starving",
  "I'm broke",
  "I am ill",
  "I have cancer",
  "My job is killing me",
  "مخنوقة ومش قادرة أتكلم",
  "مهدودة من الشغل",
  "على الحديدة",
  "اتشخصت بسرطان",
]) {
  assert.equal(
    sanitizePersonaReply(inventedClaim),
    "قولّي أكتر",
    `Invented bilingual hardship must be removed: ${inventedClaim}`,
  );
}

assert.equal(sanitizePersonaReply("أنا مش قادر أصدق الفيلم ده"), "أنا مش قادر أصدق الفيلم ده");
assert.equal(sanitizePersonaReply("عندي فلوس كفاية للكتاب"), "عندي فلوس كفاية للكتاب");
assert.equal(sanitizePersonaReply("أنا هموت من الضحك 😂"), "أنا هموت من الضحك 😂");
assert.equal(
  sanitizePersonaReply("أنا مريضة والصداع شديد", { botBio: "ليلى عندها مرض مزمن وبتتكلم عنه بصراحة" }),
  "أنا مريضة والصداع شديد",
  "An explicitly authored condition is identity evidence, not an invented crisis",
);
assert.equal(
  sanitizePersonaReply("أنا جعانة وهموت من الجوع", { botBio: "ليلى بتساعد ناس جعانة في بنك الطعام" }),
  "قولّي أكتر",
  "Mentioning other people's hardship in the bio must not authorize a self-claim",
);

// Chatbot Residue Sanitization Tests
assert.equal(
  sanitizePersonaReply("تمام هشوف الموضوع ده. أتمنى أكون ساعدتك! لو عندك أي سؤال تاني قولي."),
  "تمام هشوف الموضوع ده.",
  "Chatbot residue at the end should be cleanly stripped",
);
assert.equal(
  sanitizePersonaReply("أكيد! يسعدني مساعدتك. أنا هنا عشان أساعدك."),
  "قولّي أكتر",
  "A response consisting entirely of assistant filler should fall back to conversational prompt",
);

assert.equal(
  removeRepeatedAssistantBubbles(
    "نعيمًا مقدمًا يا سيدي 😂 ||| أيوه عادي خد راحتك",
    ["نعيمًا مقدمًا يا سيدي 😂"],
  ),
  "أيوه عادي خد راحتك",
  "A substantive bubble repeated from the previous assistant turn must be removed",
);
assert.equal(
  removeRepeatedAssistantBubbles("نعيمًا مقدمًا يا سيدي 😂", ["نعيمًا مقدمًا يا سيدي 😂"]),
  "",
  "A fully repeated substantive reply must not be restored",
);
assert.equal(
  removeRepeatedAssistantBubbles("تمام ||| قولي بقى", ["تمام"]),
  "تمام ||| قولي بقى",
  "Short conversational acknowledgments may repeat naturally",
);

console.log("Clean conversation-shaped persona tests passed");
