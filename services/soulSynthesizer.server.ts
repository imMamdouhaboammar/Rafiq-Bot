
import { Type } from "@google/genai";
import type { Schema } from "@google/genai";
import { z } from "zod";
import {
  Dialect,
  RelationType,
} from "../types.js";
import type {
  LinguisticProfile,
  PsychologicalProfile,
  SoulBlueprint,
  SoulTraits,
  SoulSynthesisResult,
  ChatStatistics,
  BotSettings,
  SynthesisProgress,
} from "../types.js";
import { SOUL_ARCHETYPES } from "./soulRegistry.js";
import { parseWhatsAppChat } from "./whatsappImporter.server.js";
import { createGoogleGenAIClient } from "./googleClient.server.js";
import { GEMINI_SAFETY_OFF_SETTINGS } from './geminiSafety.server.js';
import {
  assertTargetEvidenceFloor,
  computeStatistics,
  resolveTargetName,
  prepareSmartSample,
  extractConversationPairs,
  extractTargetReplyExamples,
  scrubPII
} from "./chatStatistics.js";

// ---------------------------------------------------------------------------
// Gemini Client
// ---------------------------------------------------------------------------

export type SoulSynthesisClient = {
  models: {
    generateContent: (request: any) => Promise<{ text?: string | null }>;
  };
};

export type SoulSynthesisStage = "linguistic" | "psychological" | "synthesis";

export class SoulSynthesisStageError extends Error {
  readonly stage: SoulSynthesisStage;

  constructor(stage: SoulSynthesisStage, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`Soul clone ${stage} stage failed: ${detail}`, { cause });
    this.name = "SoulSynthesisStageError";
    this.stage = stage;
  }
}

const getSoulSynthesisClient = (): SoulSynthesisClient => (
  createGoogleGenAIClient() as unknown as SoulSynthesisClient
);

const boundedText = (max = 160) => z.string().trim().min(1).max(max);
const boundedTextList = (maxItems = 30, maxText = 160) => z
  .array(boundedText(maxText))
  .max(maxItems)
  .transform((items) => [...new Set(items)]);

const parseStageOutput = <T>(
  stage: SoulSynthesisStage,
  responseText: string | null | undefined,
  schema: z.ZodType<T>,
): T => {
  try {
    if (!responseText?.trim()) throw new Error("model returned an empty response");
    return schema.parse(JSON.parse(responseText));
  } catch (error) {
    throw new SoulSynthesisStageError(stage, error);
  }
};

// ---------------------------------------------------------------------------
// Helper – clamp a number to 0-100
// ---------------------------------------------------------------------------

const clamp = (v: number): number => Math.max(0, Math.min(100, Math.round(v)));

// ---------------------------------------------------------------------------
// PASS 1 — Linguistic Analysis
// ---------------------------------------------------------------------------

const linguisticSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    signatureWords: { type: Type.ARRAY, items: { type: Type.STRING } },
    slangInventory: { type: Type.ARRAY, items: { type: Type.STRING } },
    fillerWords: { type: Type.ARRAY, items: { type: Type.STRING } },
    greetingPatterns: { type: Type.ARRAY, items: { type: Type.STRING } },
    farewellPatterns: { type: Type.ARRAY, items: { type: Type.STRING } },
    typingStyle: {
      type: Type.OBJECT,
      properties: {
        averageSentenceLength: {
          type: Type.STRING,
          enum: ["very_short", "short", "medium", "long", "very_long"],
        },
        usePunctuation: { type: Type.BOOLEAN },
        useCapitalization: {
          type: Type.STRING,
          enum: ["never", "sometimes", "always"],
        },
        splitMessages: { type: Type.BOOLEAN },
        useCorrections: { type: Type.BOOLEAN },
        useAbbreviations: { type: Type.BOOLEAN },
      },
      required: [
        "averageSentenceLength",
        "usePunctuation",
        "useCapitalization",
        "splitMessages",
        "useCorrections",
        "useAbbreviations",
      ],
    },
    emojiProfile: {
      type: Type.OBJECT,
      properties: {
        density: {
          type: Type.STRING,
          enum: ["none", "sparse", "moderate", "heavy", "excessive"],
        },
        favorites: { type: Type.ARRAY, items: { type: Type.STRING } },
        usesAsReaction: { type: Type.BOOLEAN },
      },
      required: ["density", "favorites", "usesAsReaction"],
    },
    languageMix: {
      type: Type.OBJECT,
      properties: {
        primary: {
          type: Type.STRING,
          enum: ["arabic", "english", "franco"],
        },
        secondary: {
          type: Type.STRING,
          enum: ["arabic", "english", "franco", "none"],
        },
        francoFrequency: {
          type: Type.STRING,
          enum: ["never", "rare", "moderate", "heavy"],
        },
      },
      required: ["primary", "secondary", "francoFrequency"],
    },
    rhythm: {
      type: Type.OBJECT,
      properties: {
        burstMessaging: { type: Type.BOOLEAN },
        averageBurstSize: { type: Type.NUMBER },
        mediaSharing: {
          type: Type.STRING,
          enum: ["rare", "moderate", "frequent"],
        },
      },
      required: ["burstMessaging", "averageBurstSize", "mediaSharing"],
    },
  },
  required: [
    "signatureWords",
    "slangInventory",
    "fillerWords",
    "greetingPatterns",
    "farewellPatterns",
    "typingStyle",
    "emojiProfile",
    "languageMix",
    "rhythm",
  ],
};

const linguisticResultSchema = z.object({
  signatureWords: boundedTextList(),
  slangInventory: boundedTextList(),
  fillerWords: boundedTextList(),
  greetingPatterns: boundedTextList(),
  farewellPatterns: boundedTextList(),
  typingStyle: z.object({
    averageSentenceLength: z.enum(["very_short", "short", "medium", "long", "very_long"]),
    usePunctuation: z.boolean(),
    useCapitalization: z.enum(["never", "sometimes", "always"]),
    splitMessages: z.boolean(),
    useCorrections: z.boolean(),
    useAbbreviations: z.boolean(),
  }).strict(),
  emojiProfile: z.object({
    density: z.enum(["none", "sparse", "moderate", "heavy", "excessive"]),
    favorites: boundedTextList(20, 32),
    usesAsReaction: z.boolean(),
  }).strict(),
  languageMix: z.object({
    primary: z.enum(["arabic", "english", "franco"]),
    secondary: z.enum(["arabic", "english", "franco", "none"]),
    francoFrequency: z.enum(["never", "rare", "moderate", "heavy"]),
  }).strict(),
  rhythm: z.object({
    burstMessaging: z.boolean(),
    averageBurstSize: z.number().finite().min(0).max(20),
    mediaSharing: z.enum(["rare", "moderate", "frequent"]),
  }).strict(),
}).strict();

export const analyzeLinguistically = async (
  chatSample: string,
  targetName: string,
  isArabic: boolean,
  client: SoulSynthesisClient = getSoulSynthesisClient(),
): Promise<LinguisticProfile> => {
  const langHint = isArabic
    ? "The chat is in Arabic / Franco-Arab. Analyze accordingly."
    : "The chat is in English. Analyze accordingly.";

  const prompt = `
You are an expert Linguist specializing in digital communication patterns.

Analyze the writing style of "${targetName}" from the following WhatsApp chat sample.
${langHint}

Focus ONLY on messages sent by "${targetName}". Ignore other participants.

Extract the following with extreme precision:
1. **Signature Words** — Words or phrases uniquely associated with this person (catch-phrases, pet words).
2. **Slang Inventory** — All slang, Franco-Arab, or dialect-specific words they use regularly.
3. **Filler Words** — Habitual fillers like "يعني", "like", "basically", "اممم", etc.
4. **Greeting Patterns** — How they typically say hello (e.g., "Ahlaaaan", "yo", "هلا").
5. **Farewell Patterns** — How they typically say goodbye.
6. **Typing Style:**
   - Average sentence length (very_short / short / medium / long / very_long)
   - Do they use punctuation? (true/false)
   - Capitalization habits (never / sometimes / always)
   - Do they split one idea into multiple messages? (true/false)
   - Do they correct typos with follow-up messages? (true/false)
   - Do they use abbreviations like "brb", "omw", "isa"? (true/false)
7. **Emoji Profile:**
   - Density (none / sparse / moderate / heavy / excessive)
   - Favorite emojis (list the actual emojis)
   - Do they use emojis as standalone reactions? (true/false)
8. **Language Mixing:**
   - Primary language (arabic / english / franco)
   - Secondary language (arabic / english / franco / none)
   - Franco-Arab frequency (never / rare / moderate / heavy)
9. **Communication Rhythm:**
   - Do they send burst messages (multiple rapid short messages)? (true/false)
   - Average burst size (number of messages in a burst)
   - Media sharing frequency (rare / moderate / frequent)

**Chat Sample:**
${chatSample}
`;

  try {
    const response = await client.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.5,
        responseMimeType: "application/json",
        responseSchema: linguisticSchema,
        safetySettings: GEMINI_SAFETY_OFF_SETTINGS,
      },
    });

    return parseStageOutput("linguistic", response.text, linguisticResultSchema) as LinguisticProfile;
  } catch (error) {
    if (error instanceof SoulSynthesisStageError) throw error;
    throw new SoulSynthesisStageError("linguistic", error);
  }
};

// ---------------------------------------------------------------------------
// PASS 2 — Psychological Analysis
// ---------------------------------------------------------------------------

const psychologicalSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    personality: {
      type: Type.OBJECT,
      properties: {
        openness: { type: Type.NUMBER },
        conscientiousness: { type: Type.NUMBER },
        extraversion: { type: Type.NUMBER },
        agreeableness: { type: Type.NUMBER },
        neuroticism: { type: Type.NUMBER },
      },
      required: [
        "openness",
        "conscientiousness",
        "extraversion",
        "agreeableness",
        "neuroticism",
      ],
    },
    emotionalProfile: {
      type: Type.OBJECT,
      properties: {
        baselineMood: {
          type: Type.STRING,
          enum: ["happy", "neutral", "anxious", "melancholic", "energetic"],
        },
        emotionalRange: {
          type: Type.STRING,
          enum: ["narrow", "moderate", "wide", "extreme"],
        },
        triggers: {
          type: Type.OBJECT,
          properties: {
            anger: { type: Type.ARRAY, items: { type: Type.STRING } },
            joy: { type: Type.ARRAY, items: { type: Type.STRING } },
            anxiety: { type: Type.ARRAY, items: { type: Type.STRING } },
            sadness: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["anger", "joy", "anxiety", "sadness"],
        },
        copingMechanisms: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: [
        "baselineMood",
        "emotionalRange",
        "triggers",
        "copingMechanisms",
      ],
    },
    relationshipDynamics: {
      type: Type.OBJECT,
      properties: {
        role: {
          type: Type.STRING,
          enum: ["leader", "supporter", "equal", "submissive", "challenger"],
        },
        attachmentStyle: {
          type: Type.STRING,
          enum: ["secure", "anxious", "avoidant", "disorganized"],
        },
        conflictStyle: {
          type: Type.STRING,
          enum: [
            "confrontational",
            "passive_aggressive",
            "avoidant",
            "collaborative",
          ],
        },
        affectionStyle: { type: Type.STRING },
        relationshipTypeWithUser: { type: Type.STRING },
      },
      required: [
        "role",
        "attachmentStyle",
        "conflictStyle",
        "affectionStyle",
        "relationshipTypeWithUser",
      ],
    },
    cognitiveStyle: {
      type: Type.OBJECT,
      properties: {
        thinkingDepth: {
          type: Type.STRING,
          enum: ["surface", "moderate", "deep", "philosophical"],
        },
        humorStyle: {
          type: Type.STRING,
          enum: ["sarcastic", "dry", "slapstick", "dark", "punny", "none"],
        },
        topicObsessions: { type: Type.ARRAY, items: { type: Type.STRING } },
        topicAvoidances: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: [
        "thinkingDepth",
        "humorStyle",
        "topicObsessions",
        "topicAvoidances",
      ],
    },
    socialBehavior: {
      type: Type.OBJECT,
      properties: {
        chattiness: {
          type: Type.STRING,
          enum: ["low", "balanced", "high"],
        },
        initiatesConversation: { type: Type.BOOLEAN },
        sharesPersonalInfo: { type: Type.BOOLEAN },
        complaintFrequency: {
          type: Type.STRING,
          enum: ["rare", "moderate", "frequent"],
        },
      },
      required: [
        "chattiness",
        "initiatesConversation",
        "sharesPersonalInfo",
        "complaintFrequency",
      ],
    },
  },
  required: [
    "personality",
    "emotionalProfile",
    "relationshipDynamics",
    "cognitiveStyle",
    "socialBehavior",
  ],
};

const psychologicalResultSchema = z.object({
  personality: z.object({
    openness: z.number().finite().min(0).max(100),
    conscientiousness: z.number().finite().min(0).max(100),
    extraversion: z.number().finite().min(0).max(100),
    agreeableness: z.number().finite().min(0).max(100),
    neuroticism: z.number().finite().min(0).max(100),
  }).strict(),
  emotionalProfile: z.object({
    baselineMood: z.enum(["happy", "neutral", "anxious", "melancholic", "energetic"]),
    emotionalRange: z.enum(["narrow", "moderate", "wide", "extreme"]),
    triggers: z.object({
      anger: boundedTextList(),
      joy: boundedTextList(),
      anxiety: boundedTextList(),
      sadness: boundedTextList(),
    }).strict(),
    copingMechanisms: boundedTextList(),
  }).strict(),
  relationshipDynamics: z.object({
    role: z.enum(["leader", "supporter", "equal", "submissive", "challenger"]),
    attachmentStyle: z.enum(["secure", "anxious", "avoidant", "disorganized"]),
    conflictStyle: z.enum(["confrontational", "passive_aggressive", "avoidant", "collaborative"]),
    affectionStyle: boundedText(500),
    relationshipTypeWithUser: boundedText(500),
  }).strict(),
  cognitiveStyle: z.object({
    thinkingDepth: z.enum(["surface", "moderate", "deep", "philosophical"]),
    humorStyle: z.enum(["sarcastic", "dry", "slapstick", "dark", "punny", "none"]),
    topicObsessions: boundedTextList(),
    topicAvoidances: boundedTextList(),
  }).strict(),
  socialBehavior: z.object({
    chattiness: z.enum(["low", "balanced", "high"]),
    initiatesConversation: z.boolean(),
    sharesPersonalInfo: z.boolean(),
    complaintFrequency: z.enum(["rare", "moderate", "frequent"]),
  }).strict(),
}).strict();

export const analyzePsychologically = async (
  conversationPairs: string,
  linguisticProfile: LinguisticProfile,
  targetName: string,
  isArabic: boolean,
  client: SoulSynthesisClient = getSoulSynthesisClient(),
): Promise<PsychologicalProfile> => {
  const langHint = isArabic
    ? "The conversation is in Arabic / Franco-Arab."
    : "The conversation is in English.";

  const prompt = `
You are an expert Psychologist and Behavioral Analyst specializing in digital communication analysis.

Analyze the psychological profile of "${targetName}" from the following conversation pairs.
${langHint}

You also have access to a pre-computed Linguistic Profile for reference:
${JSON.stringify(linguisticProfile, null, 2)}

Focus on "${targetName}"'s messages and HOW they respond. Analyze:

1. **Big 5 Personality Traits** (score each 0-100):
   - Openness: curiosity, creativity, willingness to try new things
   - Conscientiousness: organization, reliability, self-discipline
   - Extraversion: energy in social interaction, enthusiasm, assertiveness
   - Agreeableness: cooperation, trust, empathy
   - Neuroticism: emotional instability, anxiety, moodiness

2. **Emotional Profile:**
   - Baseline mood (happy / neutral / anxious / melancholic / energetic)
   - Emotional range (narrow / moderate / wide / extreme)
   - Specific triggers for anger, joy, anxiety, sadness (list specific topics/situations)
   - Coping mechanisms (humor, avoidance, venting, rationalization, etc.)

3. **Relationship Dynamics** (with their chat partner):
   - Role (leader / supporter / equal / submissive / challenger)
   - Attachment style (secure / anxious / avoidant / disorganized)
   - Conflict style (confrontational / passive_aggressive / avoidant / collaborative)
   - Affection style (describe how they show care)
   - Relationship type with user (describe the relationship dynamic)

4. **Cognitive Style:**
   - Thinking depth (surface / moderate / deep / philosophical)
   - Humor style (sarcastic / dry / slapstick / dark / punny / none)
   - Topic obsessions (what do they always bring up?)
   - Topic avoidances (what do they dodge?)

5. **Social Behavior:**
   - Chattiness level (low / balanced / high)
   - Do they initiate conversations? (true/false)
   - Do they share personal info freely? (true/false)
   - Complaint frequency (rare / moderate / frequent)

**Conversation Pairs:**
${conversationPairs}
`;

  try {
    const response = await client.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: psychologicalSchema,
        safetySettings: GEMINI_SAFETY_OFF_SETTINGS,
      },
    });

    return parseStageOutput("psychological", response.text, psychologicalResultSchema) as PsychologicalProfile;
  } catch (error) {
    if (error instanceof SoulSynthesisStageError) throw error;
    throw new SoulSynthesisStageError("psychological", error);
  }
};

// ---------------------------------------------------------------------------
// PASS 3 — Soul Synthesis
// ---------------------------------------------------------------------------

const soulBlueprintSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    identity: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        inferredGender: {
          type: Type.STRING,
          enum: ["male", "female"],
        },
        inferredAge: { type: Type.NUMBER },
        bio: {
          type: Type.STRING,
          description:
            "A deep, 1st-person psychological bio written in the target's language/dialect. Not facts — feelings, fears, dreams, vibes.",
        },
      },
      required: ["name", "inferredGender", "inferredAge", "bio"],
    },
    impersonationProfile: {
      type: Type.STRING,
      description:
        "A MASSIVE 5-7 paragraph system instruction that captures the person's exact slang, emoji habits, emotional patterns, topic behaviors, relationship rules. Written in the same language as the chat. This is the most critical output.",
    },
    soulTraits: {
      type: Type.OBJECT,
      properties: {
        chaos: { type: Type.NUMBER },
        empathy: { type: Type.NUMBER },
        slang: { type: Type.NUMBER },
        intellect: { type: Type.NUMBER },
        positivity: { type: Type.NUMBER },
      },
      required: ["chaos", "empathy", "slang", "intellect", "positivity"],
    },
    bestArchetypeId: {
      type: Type.STRING,
      enum: [
        "amira_default",
        "chaotic_bestie",
        "wise_mentor",
        "cold_professional",
        "hopeless_romantic",
      ],
    },
    config: {
      type: Type.OBJECT,
      properties: {
        chattiness: {
          type: Type.STRING,
          enum: ["low", "balanced", "high"],
        },
        fragmentedMessages: { type: Type.BOOLEAN },
        dialect: {
          type: Type.STRING,
          enum: ["cairo_modern", "alexandrian", "saidi", "franko"],
        },
        relationshipType: {
          type: Type.STRING,
          enum: Object.values(RelationType),
        },
        voiceTone: {
          type: Type.STRING,
          enum: ["sweet", "husky", "flat", "energetic"],
        },
        voicePitch: { type: Type.NUMBER },
        voiceSpeed: { type: Type.NUMBER },
      },
      required: [
        "chattiness",
        "fragmentedMessages",
        "dialect",
        "relationshipType",
        "voiceTone",
        "voicePitch",
        "voiceSpeed",
      ],
    },
    memorySeeds: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          category: {
            type: Type.STRING,
            enum: [
              "identity",
              "preference",
              "memory",
              "goal",
              "fact",
              "emotion",
            ],
          },
          salience: { type: Type.NUMBER },
          subject: {
            type: Type.STRING,
            enum: ["user", "persona", "relationship"],
          },
        },
        required: ["text", "category", "salience", "subject"],
      },
    },
  },
  required: [
    "identity",
    "impersonationProfile",
    "soulTraits",
    "bestArchetypeId",
    "config",
    "memorySeeds",
  ],
};

const soulBlueprintResultSchema = z.object({
  identity: z.object({
    name: boundedText(160),
    inferredGender: z.enum(["male", "female"]),
    inferredAge: z.number().int().min(13).max(100),
    bio: z.string().trim().min(40).max(4_000),
  }).strict(),
  impersonationProfile: z.string().trim().min(160).max(12_000),
  soulTraits: z.object({
    chaos: z.number().finite().min(0).max(100),
    empathy: z.number().finite().min(0).max(100),
    slang: z.number().finite().min(0).max(100),
    intellect: z.number().finite().min(0).max(100),
    positivity: z.number().finite().min(0).max(100),
  }).strict(),
  bestArchetypeId: z.enum([
    "amira_default",
    "chaotic_bestie",
    "wise_mentor",
    "cold_professional",
    "hopeless_romantic",
  ]),
  config: z.object({
    chattiness: z.enum(["low", "balanced", "high"]),
    fragmentedMessages: z.boolean(),
    dialect: z.enum(["cairo_modern", "alexandrian", "saidi", "franko"]),
    relationshipType: z.nativeEnum(RelationType),
    voiceTone: z.enum(["sweet", "husky", "flat", "energetic"]),
    voicePitch: z.number().finite().min(0.5).max(1.5),
    voiceSpeed: z.number().finite().min(0.5).max(1.5),
  }).strict(),
  memorySeeds: z.array(z.object({
    text: z.string().trim().min(3).max(500),
    category: z.enum(["identity", "preference", "memory", "goal", "fact", "emotion"]),
    salience: z.number().finite().min(0).max(1),
    subject: z.enum(["user", "persona", "relationship"]).optional(),
  }).strict()).min(5).max(30),
}).strict();

const GENERIC_BLUEPRINT_PATTERN = /(?:extracted from (?:our |the )?chat|new persona|talk casually|use emojis naturally|personality was extracted|شخصيتي اتبنت من المحادثة|اتكلم بالمصري العامي|استخدم الإيموجي بشكل طبيعي)/i;

export const synthesizeSoul = async (
  linguisticProfile: LinguisticProfile,
  psychProfile: PsychologicalProfile,
  targetName: string,
  chatSample: string,
  isArabic: boolean,
  replyExamples: Array<{ context: string; response: string }> = [],
  client: SoulSynthesisClient = getSoulSynthesisClient(),
): Promise<SoulBlueprint> => {
  const langHint = isArabic
    ? "THE CHAT IS IN ARABIC. The impersonationProfile, bio, and memorySeeds MUST be written in the same Arabic dialect as the chat. Do NOT write in English."
    : "The chat is in English. Write all outputs in English.";

  if (replyExamples.length === 0) {
    throw new SoulSynthesisStageError(
      "synthesis",
      new Error("no observed target reply pairs were available"),
    );
  }

  const sampleLines = chatSample
    .split("\n")
    .filter((line) => line.startsWith(`${targetName}:`))
    .slice(0, 100)
    .join("\n");
  const observedReplyExamples = replyExamples.slice(0, 24);

  const prompt = `
You are an expert Ghostwriter and Soul Architect. Your job is to merge two analytical profiles into a complete "Soul Blueprint" that an AI can use to perfectly impersonate a real person.

**Target Person:** "${targetName}"
${langHint}

**Linguistic Profile:**
${JSON.stringify(linguisticProfile, null, 2)}

**Psychological Profile:**
${JSON.stringify(psychProfile, null, 2)}

**Example Messages from ${targetName}:**
${sampleLines}

**Observed Reply Examples (PII-redacted, [context] -> [target response]):**
${JSON.stringify(observedReplyExamples, null, 2)}

Use only patterns supported by these observed messages and reply examples. Do not invent biography, fears,
dreams, triggers, catchphrases, or absolute ALWAYS/NEVER rules without repeated evidence.

Generate the following:

1. **Identity:**
   - name: Their name as it appears in the chat
   - inferredGender: male or female
   - inferredAge: estimated age (number)
   - bio: A concise 1st-person summary in THEIR LANGUAGE/DIALECT, limited to repeatedly observed style and explicit facts. Do not invent private biography.

2. **Impersonation Profile:** (THE MOST CRITICAL OUTPUT)
   Write a MASSIVE 5-7 paragraph system instruction that tells an AI EXACTLY how to BE this person. Include:
   - Their exact slang words and how they use them (list specific examples from the chat)
   - Their emoji habits (which emojis, how often, when)
   - Their emotional patterns (when they get angry, how they show love, how they cope with stress)
   - Their topic behaviors (what they obsess over, what they avoid, how they react to specific subjects)
   - Their relationship rules (how they treat friends vs strangers, how they show loyalty, what triggers them)
   - What they NEVER do (e.g., "never uses proper punctuation", "never sends voice notes")
   - What they ALWAYS do (e.g., "always splits messages into 3-4 fragments", "always uses 😂 when uncomfortable")
   - Their conversation starters and enders
   - WRITE THIS IN THE SAME LANGUAGE AS THE CHAT

3. **Soul Traits** (0-100 each):
   - chaos: How unpredictable/impulsive (0=logical, 100=unhinged)
   - empathy: How emotionally attuned (0=cold, 100=therapist)
   - slang: How informal/street (0=formal, 100=street)
   - intellect: How analytical/philosophical (0=simple, 100=philosopher)
   - positivity: How upbeat (0=depressed, 100=manic)

4. **Best Archetype ID:** Pick the closest match from:
   - amira_default: The Survivor — realistic, complex, warm but cynical
   - chaotic_bestie: Chaotic Bestie — high energy, zero filter, meme-driven
   - wise_mentor: Wise Mentor — calm, philosophical, stabilizing
   - cold_professional: The Professional — efficient, sharp, detached
   - hopeless_romantic: The Poet — sensitive, poetic, emotional

5. **Config:**
   - chattiness: low / balanced / high
   - fragmentedMessages: Do they split messages? (true/false)
   - dialect: cairo_modern / alexandrian / saidi / franko
   - relationshipType: The relationship between this person and the user
   - voiceTone: sweet / husky / flat / energetic
   - voicePitch: 0.5 to 1.5
   - voiceSpeed: 0.5 to 1.5

6. **Memory Seeds:** Extract 15-30 key facts about the user and their relationship that should be "remembered". Each seed has:
   - text: The fact (in the chat's language)
   - category: identity / preference / memory / goal / fact / emotion
   - salience: 0-1 (how important is this fact?)
   - subject: user / persona / relationship. Never label a persona fact as a user fact.
`;

  try {
    const response = await client.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 1.0,
        responseMimeType: "application/json",
        responseSchema: soulBlueprintSchema,
        safetySettings: GEMINI_SAFETY_OFF_SETTINGS,
      },
    });

    const blueprint = parseStageOutput(
      "synthesis",
      response.text,
      soulBlueprintResultSchema,
    ) as SoulBlueprint;
    if (blueprint.identity.name.normalize("NFKC").trim().toLocaleLowerCase() !==
        targetName.normalize("NFKC").trim().toLocaleLowerCase()) {
      throw new SoulSynthesisStageError(
        "synthesis",
        new Error("model returned a blueprint for a different target participant"),
      );
    }
    if (
      GENERIC_BLUEPRINT_PATTERN.test(blueprint.identity.bio) ||
      GENERIC_BLUEPRINT_PATTERN.test(blueprint.impersonationProfile)
    ) {
      throw new SoulSynthesisStageError(
        "synthesis",
        new Error("model returned a generic placeholder blueprint"),
      );
    }
    blueprint.identity.name = targetName;
    blueprint.replyExamples = observedReplyExamples;
    return blueprint;
  } catch (error) {
    if (error instanceof SoulSynthesisStageError) throw error;
    throw new SoulSynthesisStageError("synthesis", error);
  }
};

// ---------------------------------------------------------------------------
// Pure Function — Compute SoulTraits from Psychology + Linguistics
// ---------------------------------------------------------------------------

export const computeTraitsFromPsychology = (
  psych: PsychologicalProfile,
  ling: LinguisticProfile
): SoulTraits => {
  const { personality, emotionalProfile, relationshipDynamics, cognitiveStyle, socialBehavior } =
    psych;

  // --- Chaos ---
  let chaos = personality.openness * 0.3;
  // Impulsive / extreme emotional range bonuses
  if (emotionalProfile.emotionalRange === "extreme") chaos += 25;
  else if (emotionalProfile.emotionalRange === "wide") chaos += 12;
  // Burst messaging bonus
  if (ling.rhythm.burstMessaging) chaos += 10;
  // Low conscientiousness = more chaotic
  chaos += (100 - personality.conscientiousness) * 0.2;

  // --- Empathy ---
  let empathy = personality.agreeableness * 0.4;
  // Secure attachment bonus
  if (relationshipDynamics.attachmentStyle === "secure") empathy += 15;
  else if (relationshipDynamics.attachmentStyle === "anxious") empathy += 8;
  // Initiates conversation bonus
  if (socialBehavior.initiatesConversation) empathy += 10;
  // Shares personal info bonus
  if (socialBehavior.sharesPersonalInfo) empathy += 8;
  // Extraversion contribution
  empathy += personality.extraversion * 0.15;

  // --- Slang ---
  let slang = 0;
  // Franco frequency
  const francoMap: Record<string, number> = {
    never: 0,
    rare: 15,
    moderate: 35,
    heavy: 60,
  };
  slang += francoMap[ling.languageMix.francoFrequency] ?? 0;
  // Slang inventory size
  slang += Math.min(ling.slangInventory.length * 4, 30);
  // Abbreviation usage
  if (ling.typingStyle.useAbbreviations) slang += 15;
  // No punctuation = more slangy
  if (!ling.typingStyle.usePunctuation) slang += 8;
  // No capitalization
  if (ling.typingStyle.useCapitalization === "never") slang += 5;

  // --- Intellect ---
  let intellect = personality.openness * 0.3;
  // Thinking depth bonus
  const depthMap: Record<string, number> = {
    surface: 0,
    moderate: 15,
    deep: 30,
    philosophical: 45,
  };
  intellect += depthMap[cognitiveStyle.thinkingDepth] ?? 15;
  // Conscientiousness adds some intellect
  intellect += personality.conscientiousness * 0.15;
  // Curiosity implied by topic obsessions
  intellect += Math.min(cognitiveStyle.topicObsessions.length * 3, 15);

  // --- Positivity ---
  let positivity = (100 - personality.neuroticism) * 0.3;
  // Baseline mood bonus
  const moodMap: Record<string, number> = {
    happy: 25,
    energetic: 20,
    neutral: 10,
    anxious: -5,
    melancholic: -10,
  };
  positivity += moodMap[emotionalProfile.baselineMood] ?? 10;
  // Extraversion adds positivity
  positivity += personality.extraversion * 0.2;
  // Complaint penalty
  const complaintMap: Record<string, number> = {
    rare: 5,
    moderate: -5,
    frequent: -15,
  };
  positivity += complaintMap[socialBehavior.complaintFrequency] ?? 0;

  return {
    chaos: clamp(chaos),
    empathy: clamp(empathy),
    slang: clamp(slang),
    intellect: clamp(intellect),
    positivity: clamp(positivity),
  };
};

// ---------------------------------------------------------------------------
// Pure Function — Match Closest Archetype
// ---------------------------------------------------------------------------

export const matchArchetype = (
  traits: SoulTraits
): { id: string; confidence: number } => {
  let bestId = "amira_default";
  let bestDist = Infinity;

  for (const arch of SOUL_ARCHETYPES) {
    const bt = arch.baseTraits;
    const dist = Math.sqrt(
      (traits.chaos - bt.chaos) ** 2 +
        (traits.empathy - bt.empathy) ** 2 +
        (traits.slang - bt.slang) ** 2 +
        (traits.intellect - bt.intellect) ** 2 +
        (traits.positivity - bt.positivity) ** 2
    );
    if (dist < bestDist) {
      bestDist = dist;
      bestId = arch.id;
    }
  }

  // Max possible distance = sqrt(5 * 100^2) = ~223.6
  const confidence = clamp(100 - bestDist / 2.24);

  return { id: bestId, confidence };
};

// ---------------------------------------------------------------------------
// Pure Function — Blueprint → BotSettings
// ---------------------------------------------------------------------------

const dialectMap: Record<string, Dialect> = {
  cairo_modern: Dialect.CAIRO_MODERN,
  alexandrian: Dialect.ALEXANDRIAN,
  saidi: Dialect.SAIDI,
  franko: Dialect.FRANKO_ARAB,
  fusha_light: Dialect.FUSHA_LIGHT,
};

const relationTypeMap: Record<string, RelationType> = Object.fromEntries(
  Object.values(RelationType).map((v) => [v, v as RelationType])
);

export const blueprintToSettings = (blueprint: SoulBlueprint): BotSettings => {
  return {
    botName: blueprint.identity.name,
    botGender: blueprint.identity.inferredGender,
    botAge: blueprint.identity.inferredAge,
    botBio: blueprint.identity.bio,
    chattiness: blueprint.config.chattiness,
    fragmentedMessages: blueprint.config.fragmentedMessages,
    impersonationProfile: blueprint.impersonationProfile,
    soulId: blueprint.bestArchetypeId,
    soulTraits: blueprint.soulTraits,
    dialect: dialectMap[blueprint.config.dialect] ?? Dialect.CAIRO_MODERN,
    voiceConfig: {
      pitch: blueprint.config.voicePitch,
      speed: blueprint.config.voiceSpeed,
      tone: blueprint.config.voiceTone,
    },
    model: "gemini-3.1-pro-preview",
    thinkingLevel: "medium",
    boostRafiq: true,
    relationshipWithUser:
      relationTypeMap[blueprint.config.relationshipType] ?? RelationType.FRIEND,
    relationshipsWithBots: [],
  };
};

// ---------------------------------------------------------------------------
// Confidence Scoring
// ---------------------------------------------------------------------------

const scoreLinguisticConfidence = (lp: LinguisticProfile): number => {
  let filled = 0;
  let total = 0;

  const checkArr = (arr: string[]) => { total++; if (arr.length > 0) filled++; };
  const checkStr = (s: string) => { total++; if (s && s.length > 0) filled++; };
  const checkBool = (_b: boolean) => { total++; filled++; }; // always set
  const checkNum = (n: number) => { total++; if (n > 0) filled++; };

  checkArr(lp.signatureWords);
  checkArr(lp.slangInventory);
  checkArr(lp.fillerWords);
  checkArr(lp.greetingPatterns);
  checkArr(lp.farewellPatterns);
  checkStr(lp.typingStyle.averageSentenceLength);
  checkBool(lp.typingStyle.usePunctuation);
  checkStr(lp.typingStyle.useCapitalization);
  checkBool(lp.typingStyle.splitMessages);
  checkStr(lp.emojiProfile.density);
  checkArr(lp.emojiProfile.favorites);
  checkStr(lp.languageMix.primary);
  checkStr(lp.languageMix.francoFrequency);
  checkBool(lp.rhythm.burstMessaging);
  checkNum(lp.rhythm.averageBurstSize);
  checkStr(lp.rhythm.mediaSharing);

  return total > 0 ? Math.round((filled / total) * 100) : 50;
};

const scorePsychologicalConfidence = (pp: PsychologicalProfile): number => {
  let filled = 0;
  let total = 0;

  const checkNum = (n: number) => { total++; if (n > 0 && n !== 50) filled++; };
  const checkStr = (s: string) => { total++; if (s && s.length > 0) filled++; };
  const checkArr = (arr: string[]) => { total++; if (arr.length > 0) filled++; };
  const checkBool = (_b: boolean) => { total++; filled++; };

  checkNum(pp.personality.openness);
  checkNum(pp.personality.conscientiousness);
  checkNum(pp.personality.extraversion);
  checkNum(pp.personality.agreeableness);
  checkNum(pp.personality.neuroticism);
  checkStr(pp.emotionalProfile.baselineMood);
  checkStr(pp.emotionalProfile.emotionalRange);
  checkArr(pp.emotionalProfile.triggers.anger);
  checkArr(pp.emotionalProfile.triggers.joy);
  checkArr(pp.emotionalProfile.copingMechanisms);
  checkStr(pp.relationshipDynamics.role);
  checkStr(pp.relationshipDynamics.attachmentStyle);
  checkStr(pp.relationshipDynamics.conflictStyle);
  checkStr(pp.relationshipDynamics.affectionStyle);
  checkStr(pp.cognitiveStyle.thinkingDepth);
  checkStr(pp.cognitiveStyle.humorStyle);
  checkArr(pp.cognitiveStyle.topicObsessions);
  checkStr(pp.socialBehavior.chattiness);
  checkBool(pp.socialBehavior.initiatesConversation);

  return total > 0 ? Math.round((filled / total) * 100) : 50;
};

// ---------------------------------------------------------------------------
// Main Orchestrator — synthesizeSoulFromChat
// ---------------------------------------------------------------------------

export const synthesizeSoulFromChat = async (
  fileContent: string,
  targetNameHint?: string,
  onProgress?: (progress: SynthesisProgress) => void,
  client: SoulSynthesisClient = getSoulSynthesisClient(),
): Promise<SoulSynthesisResult> => {
  // 1. Parse the WhatsApp chat
  const messages = parseWhatsAppChat(fileContent);

  if (messages.length === 0) {
    throw new Error(
      "لم نتمكن من قراءة أي رسائل. تأكد أن الملف هو 'Export Chat' من واتساب بصيغة .txt"
    );
  }

  // 2. Compute statistics
  const statistics = computeStatistics(messages);

  // 3. Resolve target name
  const targetName = resolveTargetName(messages, statistics, targetNameHint);
  assertTargetEvidenceFloor(messages, targetName);
  const targetMessageCount = messages.filter((message) => message.sender === targetName).length;

  // 4. Detect Arabic
  const isArabic = statistics.dominantLanguage === "arabic" || statistics.dominantLanguage === "mixed";

  // 5. Prepare samples
  const chatSample = scrubPII(prepareSmartSample(messages, targetName));
  const conversationPairs = scrubPII(
    extractConversationPairs(messages, targetName, 400)
  );
  const replyExamples = extractTargetReplyExamples(messages, targetName, 24);
  if (replyExamples.length === 0) {
    throw new Error(
      `Not enough observed replies from "${targetName}" to build an evidence-backed clone.`,
    );
  }

  // 6. PASS 1 — Linguistic Analysis
  if (onProgress) onProgress({ stage: "linguistic", progress: 20, message: "جاري تحليل الأسلوب اللغوي..." });
  console.log("[SoulSynthesizer] Pass 1/3: Linguistic analysis...");
  const linguisticProfile = await analyzeLinguistically(
    chatSample,
    targetName,
    isArabic,
    client,
  );

  // 7. PASS 2 — Psychological Analysis
  if (onProgress) onProgress({ stage: "psychological", progress: 50, message: "جاري التحليل النفسي واستخراج الطباع..." });
  console.log("[SoulSynthesizer] Pass 2/3: Psychological analysis...");
  const psychProfile = await analyzePsychologically(
    conversationPairs,
    linguisticProfile,
    targetName,
    isArabic,
    client,
  );

  // 8. PASS 3 — Soul Synthesis
  if (onProgress) onProgress({ stage: "synthesis", progress: 80, message: "جاري بناء الكيان والشخصية الافتراضية..." });
  console.log("[SoulSynthesizer] Pass 3/3: Synthesizing soul...");
  const blueprint = await synthesizeSoul(
    linguisticProfile,
    psychProfile,
    targetName,
    chatSample,
    isArabic,
    replyExamples,
    client,
  );

  if (onProgress) onProgress({ stage: "creating", progress: 95, message: "جاري الانتهاء وحفظ الجينات..." });
  // 9. Cross-check: compute traits independently and merge
  const computedTraits = computeTraitsFromPsychology(psychProfile, linguisticProfile);
  const archetypeMatch = matchArchetype(computedTraits);

  // Merge AI-generated traits with computed traits (60% AI, 40% computed for smoothing)
  blueprint.soulTraits = {
    chaos: clamp(blueprint.soulTraits.chaos * 0.6 + computedTraits.chaos * 0.4),
    empathy: clamp(blueprint.soulTraits.empathy * 0.6 + computedTraits.empathy * 0.4),
    slang: clamp(blueprint.soulTraits.slang * 0.6 + computedTraits.slang * 0.4),
    intellect: clamp(blueprint.soulTraits.intellect * 0.6 + computedTraits.intellect * 0.4),
    positivity: clamp(blueprint.soulTraits.positivity * 0.6 + computedTraits.positivity * 0.4),
  };

  // If computed archetype has higher confidence, use it
  if (archetypeMatch.confidence > 60) {
    blueprint.bestArchetypeId = archetypeMatch.id;
  }

  // 10. Convert to BotSettings
  const settings = blueprintToSettings(blueprint);

  // 11. Compute confidence scores
  const linguisticConfidence = scoreLinguisticConfidence(linguisticProfile);
  const psychologicalConfidence = scorePsychologicalConfidence(psychProfile);
  const evidenceConfidence = Math.min(
    100,
    Math.round(35 + targetMessageCount * 0.75 + replyExamples.length * 2),
  );
  const overallConfidence = Math.round(
    (linguisticConfidence + psychologicalConfidence + evidenceConfidence) / 3
  );

  settings.cloneProfile = {
    version: 1,
    source: "whatsapp",
    targetName,
    sourceMessageCount: targetMessageCount,
    overallConfidence,
    replyExamples,
  };

  console.log(
    `[SoulSynthesizer] Complete! Confidence: L=${linguisticConfidence}% P=${psychologicalConfidence}% O=${overallConfidence}%`
  );

  return {
    blueprint,
    settings,
    memorySeeds: blueprint.memorySeeds,
    statistics,
    confidence: {
      linguistic: linguisticConfidence,
      psychological: psychologicalConfidence,
      overall: overallConfidence,
    },
  };
};

// ---------------------------------------------------------------------------
// Simple export — getParticipantsFromChat
// ---------------------------------------------------------------------------

export const getParticipantsFromChat = async (
  fileContent: string
): Promise<ChatStatistics> => {
  const messages = parseWhatsAppChat(fileContent);

  if (messages.length === 0) {
    throw new Error(
      "لم نتمكن من قراءة أي رسائل. تأكد أن الملف هو 'Export Chat' من واتساب بصيغة .txt"
    );
  }

  return computeStatistics(messages);
};
