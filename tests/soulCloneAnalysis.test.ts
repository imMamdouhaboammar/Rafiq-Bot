import assert from "node:assert/strict";
import type { LinguisticProfile, PsychologicalProfile, SoulBlueprint } from "../types.js";
import {
  SoulSynthesisStageError,
  analyzeLinguistically,
  synthesizeSoul,
  synthesizeSoulFromChat,
  type SoulSynthesisClient,
} from "../services/soulSynthesizer.server.js";

const failingClient: SoulSynthesisClient = {
  models: {
    async generateContent() {
      throw new Error("provider offline");
    },
  },
};

await assert.rejects(
  () => analyzeLinguistically("Target: hello", "Target", false, failingClient),
  (error: unknown) => {
    assert.ok(error instanceof SoulSynthesisStageError);
    assert.equal(error.stage, "linguistic");
    assert.match(error.message, /provider offline/);
    return true;
  },
  "provider failure must propagate instead of returning a generic linguistic profile",
);

const fullExport: string[] = [];
for (let index = 0; index < 20; index++) {
  const minute = String(index * 2).padStart(2, "0");
  const replyMinute = String(index * 2 + 1).padStart(2, "0");
  fullExport.push(`01/02/2024, 10:${minute} AM - Other: context ${index}`);
  fullExport.push(`01/02/2024, 10:${replyMinute} AM - Target: observed reply ${index}`);
}

await assert.rejects(
  () => synthesizeSoulFromChat(fullExport.join("\n"), "Target", undefined, failingClient),
  (error: unknown) => {
    assert.ok(error instanceof SoulSynthesisStageError);
    assert.equal(error.stage, "linguistic");
    return true;
  },
  "the complete pipeline must fail closed when its provider fails",
);

const linguisticProfile: LinguisticProfile = {
  signatureWords: ["right"],
  slangInventory: ["mate"],
  fillerWords: ["like"],
  greetingPatterns: ["hey"],
  farewellPatterns: ["later"],
  typingStyle: {
    averageSentenceLength: "short",
    usePunctuation: false,
    useCapitalization: "sometimes",
    splitMessages: true,
    useCorrections: false,
    useAbbreviations: false,
  },
  emojiProfile: { density: "sparse", favorites: ["🙂"], usesAsReaction: true },
  languageMix: { primary: "english", secondary: "none", francoFrequency: "never" },
  rhythm: { burstMessaging: true, averageBurstSize: 2, mediaSharing: "rare" },
};

const psychologicalProfile: PsychologicalProfile = {
  personality: {
    openness: 60,
    conscientiousness: 55,
    extraversion: 50,
    agreeableness: 65,
    neuroticism: 35,
  },
  emotionalProfile: {
    baselineMood: "neutral",
    emotionalRange: "moderate",
    triggers: { anger: [], joy: [], anxiety: [], sadness: [] },
    copingMechanisms: ["clarification"],
  },
  relationshipDynamics: {
    role: "equal",
    attachmentStyle: "secure",
    conflictStyle: "collaborative",
    affectionStyle: "checks in directly",
    relationshipTypeWithUser: "friend",
  },
  cognitiveStyle: {
    thinkingDepth: "moderate",
    humorStyle: "dry",
    topicObsessions: [],
    topicAvoidances: [],
  },
  socialBehavior: {
    chattiness: "balanced",
    initiatesConversation: true,
    sharesPersonalInfo: false,
    complaintFrequency: "rare",
  },
};

const baseBlueprint: SoulBlueprint = {
  identity: {
    name: "Target",
    inferredGender: "male",
    inferredAge: 30,
    bio: "I answer directly, keep messages brief, and clarify details before making assumptions.",
  },
  impersonationProfile: "Observed style uses brief direct replies, light dry humor, sparse emoji, and clarification questions. It avoids unsupported personal claims and adapts its wording to the immediate context. ".repeat(2),
  soulTraits: { chaos: 30, empathy: 60, slang: 40, intellect: 55, positivity: 55 },
  bestArchetypeId: "amira_default",
  config: {
    chattiness: "balanced",
    fragmentedMessages: true,
    dialect: "franko",
    relationshipType: "friend",
    voiceTone: "flat",
    voicePitch: 1,
    voiceSpeed: 1,
  },
  memorySeeds: [
    { text: "Target prefers direct answers.", category: "preference", salience: 0.8, subject: "persona" },
    { text: "Target clarifies plans before agreeing.", category: "identity", salience: 0.8, subject: "persona" },
    { text: "The relationship uses regular check-ins.", category: "memory", salience: 0.7, subject: "relationship" },
    { text: "The user often asks about arrival times.", category: "fact", salience: 0.6, subject: "user" },
    { text: "They prefer practical planning.", category: "preference", salience: 0.7, subject: "relationship" },
  ],
};

const clientReturning = (value: unknown): SoulSynthesisClient => ({
  models: {
    async generateContent() {
      return { text: JSON.stringify(value) };
    },
  },
});

const observedExamples = [{ context: "Are you coming?", response: "yeah, ten minutes" }];

await assert.rejects(
  () => synthesizeSoul(
    linguisticProfile,
    psychologicalProfile,
    "Target",
    "Target: yeah, ten minutes",
    false,
    observedExamples,
    clientReturning({
      ...baseBlueprint,
      identity: {
        ...baseBlueprint.identity,
        bio: "My personality was extracted from our chat, so this is a generic description of me.",
      },
      impersonationProfile: "Talk casually and use emojis naturally. ".repeat(8),
    }),
  ),
  (error: unknown) => {
    assert.ok(error instanceof SoulSynthesisStageError);
    assert.equal(error.stage, "synthesis");
    assert.match(error.message, /generic placeholder/);
    return true;
  },
  "known generic fallback blueprints must be rejected",
);

await assert.rejects(
  () => synthesizeSoul(
    linguisticProfile,
    psychologicalProfile,
    "Target",
    "Target: yeah, ten minutes",
    false,
    observedExamples,
    clientReturning({
      ...baseBlueprint,
      soulTraits: { ...baseBlueprint.soulTraits, chaos: 101 },
    }),
  ),
  (error: unknown) => {
    assert.ok(error instanceof SoulSynthesisStageError);
    assert.equal(error.stage, "synthesis");
    return true;
  },
  "out-of-range model output must not enter settings",
);

const validatedBlueprint = await synthesizeSoul(
  linguisticProfile,
  psychologicalProfile,
  "Target",
  "Target: yeah, ten minutes",
  false,
  observedExamples,
  clientReturning(baseBlueprint),
);
assert.deepEqual(
  validatedBlueprint.replyExamples,
  observedExamples,
  "validated blueprints must carry observed reply evidence, not model-invented examples",
);

console.log("Soul clone analysis tests passed.");
