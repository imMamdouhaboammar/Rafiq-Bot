import { createHash } from "node:crypto";
import { Type, type Schema } from "@google/genai";
import { z } from "zod";
import { createGoogleGenAIClient } from "./googleClient.server.js";
import { GEMINI_SAFETY_OFF_SETTINGS } from './geminiSafety.server.js';
import { extractTargetReplyExamples, scrubPII } from "./chatStatistics.js";
import { parseWhatsAppChat, type ParsedMessage } from "./whatsappImporter.server.js";
import type { BotSettings, SoulMemorySeed, SoulSynthesisResult } from "../types.js";

export const PROGRESSIVE_CLONE_MODEL = "gemini-3.6-flash";
export const MAX_PROGRESSIVE_BATCH_BYTES = 2 * 1024 * 1024;

const MAX_MODEL_MESSAGES = 250;
const MAX_CLAIMS_PER_SECTION = 24;
const MAX_TIMELINE_EVENTS = 80;
const MAX_MEMORY_SEEDS = 60;
const MAX_CHAT_SNIPPETS = 80;
const MAX_REPLY_EXAMPLES = 24;
const MAX_MODEL_EVIDENCE_CHARS = 500;
export const MAX_AUTHENTIC_SNIPPET_CHARS = 2_000;

const BIO_SECTION_KEYS = [
  "identity",
  "personality",
  "interests",
  "relationships",
  "boundaries",
  "aspirations",
] as const;

export type ProgressiveBioSection = typeof BIO_SECTION_KEYS[number];
type AnalysisLanguage = "arabic" | "franco" | "english";

export interface ProgressiveEvidenceClaim {
  text: string;
  evidence: string;
  sourceBatch: number;
}

export interface ProgressiveRichBioSections {
  identity: ProgressiveEvidenceClaim[];
  personality: ProgressiveEvidenceClaim[];
  interests: ProgressiveEvidenceClaim[];
  relationships: ProgressiveEvidenceClaim[];
  boundaries: ProgressiveEvidenceClaim[];
  aspirations: ProgressiveEvidenceClaim[];
}

export interface ProgressiveTimelineEvent {
  id: string;
  title: string;
  details: string;
  when?: string;
  location?: string;
  evidence: string[];
  sourceBatch: number;
}

export interface ProgressiveSpeechStyle {
  toneSummary: string;
  signaturePhrases: string[];
  responsePatterns: string[];
  emojiPatterns: string[];
}

export interface ProgressiveChatSnippet {
  text: string;
  context?: string;
  timestamp?: string;
  tone?: string;
  sourceBatch: number;
}

export interface ProgressiveMemorySeed {
  text: string;
  category: "identity" | "preference" | "memory" | "goal" | "fact" | "emotion";
  subject: "user" | "persona" | "relationship";
  salience: number;
  evidence: string;
  sourceBatch: number;
}

export interface ProgressiveReplyExample {
  context: string;
  response: string;
  sourceBatch: number;
}

export interface ProgressiveCloneConfidence {
  overall: number;
  evidenceCoverage: number;
  batchCoverage: number;
  sourceMessageCount: number;
}

export interface ProgressiveCloneSnapshot {
  version: 1;
  targetName: string;
  totalBatches: number;
  sourceMessageCount: number;
  richBio: string;
  richBioSections: ProgressiveRichBioSections;
  timeline: ProgressiveTimelineEvent[];
  speechStyle: ProgressiveSpeechStyle;
  chatSnippets: ProgressiveChatSnippet[];
  memorySeeds: ProgressiveMemorySeed[];
  replyExamples: ProgressiveReplyExample[];
  confidence: ProgressiveCloneConfidence;
  overallConfidence: number;
  processedBatches: number[];
  analysis: {
    jobId: string;
    status: "partial" | "ready";
    processedBatches: number;
    totalBatches: number;
    capturedMemories: number;
    capturedEvents: number;
    capturedSnippets: number;
    updatedAt: string;
  };
}

export interface AnalyzeProgressiveCloneBatchInput {
  batchText: string;
  targetName: string;
  batchIndex: number;
  totalBatches: number;
  previousSnapshot?: ProgressiveCloneSnapshot;
}

export interface ProgressiveCloneBatchRouteRequest {
  jobId: string;
  targetName: string;
  batchIndex: number;
  totalBatches: number;
  text: string;
  priorSnapshot?: { serverSnapshot?: unknown } | ProgressiveCloneSnapshot;
}

export interface ProgressiveCloneBatchRouteResult {
  settingsPatch: Partial<BotSettings>;
  memorySeeds: SoulMemorySeed[];
  preview?: SoulSynthesisResult;
  serverSnapshot: ProgressiveCloneSnapshot;
}

export type ProgressiveCloneModelClient = {
  models: {
    generateContent: (request: unknown) => Promise<{ text?: string | null }>;
  };
};

export class ProgressiveCloneAnalysisError extends Error {
  readonly stage: "input" | "parsing" | "model" | "validation" | "evidence";

  constructor(
    stage: ProgressiveCloneAnalysisError["stage"],
    message: string,
    cause?: unknown,
  ) {
    super(`Progressive clone ${stage} failed: ${message}`, cause === undefined ? undefined : { cause });
    this.name = "ProgressiveCloneAnalysisError";
    this.stage = stage;
  }
}

const evidenceClaimSchema = z.object({
  text: z.string().trim().min(3).max(600),
  evidence: z.string().trim().min(1).max(500),
  sourceBatch: z.number().int().nonnegative(),
}).strict();

const richBioSectionsSchema = z.object(Object.fromEntries(
  BIO_SECTION_KEYS.map((key) => [key, z.array(evidenceClaimSchema).max(MAX_CLAIMS_PER_SECTION)]),
) as Record<ProgressiveBioSection, z.ZodArray<typeof evidenceClaimSchema>>).strict();

const timelineEventSchema = z.object({
  id: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(240),
  details: z.string().trim().min(1).max(1_500),
  when: z.string().trim().min(1).max(160).optional(),
  location: z.string().trim().min(1).max(240).optional(),
  evidence: z.array(z.string().trim().min(1).max(500)).min(1).max(4),
  sourceBatch: z.number().int().nonnegative(),
}).strict();

const speechStyleSchema = z.object({
  toneSummary: z.string().trim().min(1).max(2_000),
  signaturePhrases: z.array(z.string().trim().min(1).max(160)).max(40),
  responsePatterns: z.array(z.string().trim().min(1).max(500)).max(30),
  emojiPatterns: z.array(z.string().trim().min(1).max(160)).max(30),
}).strict();

const chatSnippetSchema = z.object({
  text: z.string().trim().min(1).max(MAX_AUTHENTIC_SNIPPET_CHARS),
  context: z.string().trim().min(1).max(500).optional(),
  timestamp: z.string().trim().min(1).max(160).optional(),
  tone: z.string().trim().min(1).max(160).optional(),
  sourceBatch: z.number().int().nonnegative(),
}).strict();

const memorySeedSchema = z.object({
  text: z.string().trim().min(3).max(500),
  category: z.enum(["identity", "preference", "memory", "goal", "fact", "emotion"]),
  subject: z.enum(["user", "persona", "relationship"]),
  salience: z.number().finite().min(0).max(1),
  evidence: z.string().trim().min(1).max(500),
  sourceBatch: z.number().int().nonnegative(),
}).strict();

const replyExampleSchema = z.object({
  context: z.string().trim().min(1).max(500),
  response: z.string().trim().min(1).max(500),
  sourceBatch: z.number().int().nonnegative(),
}).strict();

const confidenceSchema = z.object({
  overall: z.number().finite().min(0).max(100),
  evidenceCoverage: z.number().finite().min(0).max(100),
  batchCoverage: z.number().finite().min(0).max(100),
  sourceMessageCount: z.number().int().nonnegative(),
}).strict();

const snapshotSchema = z.object({
  version: z.literal(1),
  targetName: z.string().trim().min(1).max(160),
  totalBatches: z.number().int().positive().max(10_000),
  sourceMessageCount: z.number().int().nonnegative(),
  richBio: z.string().trim().max(12_000),
  richBioSections: richBioSectionsSchema,
  timeline: z.array(timelineEventSchema).max(MAX_TIMELINE_EVENTS),
  speechStyle: speechStyleSchema,
  chatSnippets: z.array(chatSnippetSchema).max(MAX_CHAT_SNIPPETS),
  memorySeeds: z.array(memorySeedSchema).max(MAX_MEMORY_SEEDS),
  replyExamples: z.array(replyExampleSchema).max(MAX_REPLY_EXAMPLES),
  confidence: confidenceSchema,
  overallConfidence: z.number().finite().min(0).max(100),
  processedBatches: z.array(z.number().int().nonnegative()).max(10_000),
  analysis: z.object({
    jobId: z.string().trim().min(1).max(160),
    status: z.enum(["partial", "ready"]),
    processedBatches: z.number().int().nonnegative(),
    totalBatches: z.number().int().positive(),
    capturedMemories: z.number().int().nonnegative(),
    capturedEvents: z.number().int().nonnegative(),
    capturedSnippets: z.number().int().nonnegative(),
    updatedAt: z.string().datetime(),
  }).strict(),
}).strict();

const inputSchema = z.object({
  batchText: z.string().min(1),
  targetName: z.string().trim().min(1).max(160),
  batchIndex: z.number().int().nonnegative(),
  totalBatches: z.number().int().positive().max(10_000),
  previousSnapshot: z.unknown().optional(),
}).strict().superRefine((input, context) => {
  if (input.batchIndex >= input.totalBatches) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "batchIndex must be less than totalBatches" });
  }
  if (Buffer.byteLength(input.batchText, "utf8") > MAX_PROGRESSIVE_BATCH_BYTES) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "batchText exceeds the 2 MiB batch limit" });
  }
  if (input.batchIndex > 0 && input.previousSnapshot === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "later batches require previousSnapshot" });
  }
});

const routeRequestSchema = z.object({
  jobId: z.string().trim().min(1).max(160),
  targetName: z.string().trim().min(1).max(160),
  batchIndex: z.number().int().nonnegative(),
  totalBatches: z.number().int().positive().max(10_000),
  text: z.string().min(1),
  priorSnapshot: z.unknown().optional(),
}).strict();

const modelClaimSchema = z.object({
  // A real WhatsApp signature can legitimately be a short acknowledgement or
  // emoji. Keep it through model parsing; the later evidence checks decide
  // whether it belongs in the cumulative profile.
  text: z.string().trim().min(1).max(600),
  evidence: z.string().trim().min(1).max(500),
}).strict();

const modelSalienceSchema = z.number().finite().min(0).max(100).transform(value => (
  value > 1 ? value / 100 : value
));

interface ProgressiveModelClaim {
  text: string;
  evidence: string;
}

interface ProgressiveModelResult {
  richBioSections: Record<ProgressiveBioSection, ProgressiveModelClaim[]>;
  timeline: Array<{
    title: string;
    details: string;
    when: string | null;
    location: string | null;
    evidence: string[];
  }>;
  speechStyle: {
    tone: ProgressiveModelClaim[];
    signaturePhrases: ProgressiveModelClaim[];
    responsePatterns: ProgressiveModelClaim[];
    emojiPatterns: ProgressiveModelClaim[];
  };
  memorySeeds: Array<Omit<ProgressiveMemorySeed, "sourceBatch">>;
}

const modelResultSchema = z.object({
  richBioSections: z.object(Object.fromEntries(
    BIO_SECTION_KEYS.map((key) => [key, z.array(modelClaimSchema).max(12)]),
  ) as Record<ProgressiveBioSection, z.ZodArray<typeof modelClaimSchema>>).strict(),
  timeline: z.array(z.object({
    title: z.string().trim().min(1).max(240),
    details: z.string().trim().min(1).max(1_500),
    when: z.string().trim().min(1).max(160).nullable(),
    location: z.string().trim().min(1).max(240).nullable(),
    evidence: z.array(z.string().trim().min(1).max(500)).min(1).max(4),
  }).strict()).max(20),
  speechStyle: z.object({
    tone: z.array(modelClaimSchema).min(1).max(10),
    signaturePhrases: z.array(modelClaimSchema).max(20),
    responsePatterns: z.array(modelClaimSchema).max(15),
    emojiPatterns: z.array(modelClaimSchema).max(15),
  }).strict(),
  memorySeeds: z.array(z.object({
    text: z.string().trim().min(3).max(500),
    category: z.enum(["identity", "preference", "memory", "goal", "fact", "emotion"]),
    subject: z.enum(["user", "persona", "relationship"]),
    salience: modelSalienceSchema,
    evidence: z.string().trim().min(1).max(500),
  }).strict()).max(20),
}).strict();

const modelResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    richBioSections: {
      type: Type.OBJECT,
      properties: Object.fromEntries(BIO_SECTION_KEYS.map((key) => [key, {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: { text: { type: Type.STRING }, evidence: { type: Type.STRING } },
          required: ["text", "evidence"],
        },
      }])),
      required: [...BIO_SECTION_KEYS],
    },
    timeline: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          details: { type: Type.STRING },
          when: { type: Type.STRING, nullable: true },
          location: { type: Type.STRING, nullable: true },
          evidence: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["title", "details", "when", "location", "evidence"],
      },
    },
    speechStyle: {
      type: Type.OBJECT,
      properties: Object.fromEntries(["tone", "signaturePhrases", "responsePatterns", "emojiPatterns"].map((key) => [key, {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: { text: { type: Type.STRING }, evidence: { type: Type.STRING } },
          required: ["text", "evidence"],
        },
      }])),
      required: ["tone", "signaturePhrases", "responsePatterns", "emojiPatterns"],
    },
    memorySeeds: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          category: { type: Type.STRING, enum: ["identity", "preference", "memory", "goal", "fact", "emotion"] },
          subject: { type: Type.STRING, enum: ["user", "persona", "relationship"] },
          salience: { type: Type.NUMBER },
          evidence: { type: Type.STRING },
        },
        required: ["text", "category", "subject", "salience", "evidence"],
      },
    },
  },
  required: ["richBioSections", "timeline", "speechStyle", "memorySeeds"],
};

const SENSITIVE_PATTERN = /(?:\b(?:api[_ -]?key|access[_ -]?token|password|secret)\b\s*[:=]|\bsk-[a-z0-9_-]{12,})/i;
const ARABIC_CHARACTER_PATTERN = /[\u0600-\u06FF]/;
const FRANCO_PATTERN = /(?:\b[a-z]*[23789][a-z]+\b|\b(?:ana|msh|mesh|3andy|7aga|keda|ya3ny|3ayz|2oly|ba7eb)\b)/i;

const SECTION_HEADINGS: Record<AnalysisLanguage, Record<ProgressiveBioSection, string>> = {
  arabic: {
    identity: "هويتي",
    personality: "شخصيتي",
    interests: "اهتماماتي",
    relationships: "علاقاتي",
    boundaries: "حدودي",
    aspirations: "طموحاتي",
  },
  franco: {
    identity: "Haweyty",
    personality: "Shakhseyty",
    interests: "Ehtemamaty",
    relationships: "3ala2aty",
    boundaries: "7odody",
    aspirations: "Tomo7aty",
  },
  english: {
    identity: "My identity",
    personality: "My personality",
    interests: "My interests",
    relationships: "My relationships",
    boundaries: "My boundaries",
    aspirations: "My aspirations",
  },
};

const SPEECH_HEADINGS: Record<AnalysisLanguage, {
  signaturePhrases: string;
  responsePatterns: string;
  emojiPatterns: string;
  pendingTone: string;
}> = {
  arabic: {
    signaturePhrases: "عباراتي المميزة",
    responsePatterns: "طريقتي في الرد",
    emojiPatterns: "استخدامي للإيموجي",
    pendingTone: "لسه بجمع ملامح أسلوبي من كلامي الحقيقي",
  },
  franco: {
    signaturePhrases: "Kalematy el momayaza",
    responsePatterns: "Tare2ety fel rad",
    emojiPatterns: "Estekhdamy lel emoji",
    pendingTone: "Lessa bagama3 malame7 oslooby men kalamy el 7a2ee2y",
  },
  english: {
    signaturePhrases: "My signature phrases",
    responsePatterns: "How I respond",
    emojiPatterns: "How I use emoji",
    pendingTone: "I am still building my style profile from my authentic messages",
  },
};

const normalizeKey = (value: string): string => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
const normalizeName = (value: string): string => normalizeKey(value);

const detectAnalysisLanguage = (messages: Array<Pick<ParsedMessage, "content">>): AnalysisLanguage => {
  const counts: Record<AnalysisLanguage, number> = { arabic: 0, franco: 0, english: 0 };
  for (const message of messages) {
    const content = message.content.trim();
    if (!content) continue;
    if (ARABIC_CHARACTER_PATTERN.test(content)) counts.arabic += 1;
    else if (FRANCO_PATTERN.test(content)) counts.franco += 1;
    else counts.english += 1;
  }
  return (Object.entries(counts) as Array<[AnalysisLanguage, number]>)
    .sort((left, right) => right[1] - left[1])[0]?.[0] || "english";
};

const languageInstruction = (language: AnalysisLanguage): string => {
  if (language === "arabic") {
    return "Write all analytical prose in first-person Arabic using the target's exact observed colloquial dialect. Do not switch to MSA or another regional dialect.";
  }
  if (language === "franco") {
    return "Write all analytical prose in first-person Franco-Arab, matching the target's observed spelling and Arabic dialect in Latin characters.";
  }
  return "Write all analytical prose in first-person English, matching the target's observed register and vocabulary.";
};

const hasExpectedLanguage = (text: string, language: AnalysisLanguage): boolean => {
  if (language === "arabic") return ARABIC_CHARACTER_PATTERN.test(text);
  if (language === "franco") {
    return !ARABIC_CHARACTER_PATTERN.test(text) && FRANCO_PATTERN.test(text);
  }
  return !ARABIC_CHARACTER_PATTERN.test(text) && !FRANCO_PATTERN.test(text);
};

const hasFirstPersonVoice = (text: string, language: AnalysisLanguage): boolean => {
  if (language === "arabic") {
    return /(?:^|[\s،,.!؟])(?:أنا|انا|إني|اني|عندي|بحب|بفضل|بفضّل|بميل|بتكلم|برد|بستخدم|ببدأ|بختم|بقول|بعمل|بخطط|بحافظ|مش)(?:$|[\s،,.!؟])/u.test(text);
  }
  return /\b(?:i|i'm|i’m|i've|i’ve|my|me|ana|3andy|ba7eb|bafaddal|batkallem|barod|ba2ol)\b/i.test(text);
};

const assertAnalyticalVoice = (
  text: string,
  language: AnalysisLanguage,
  field: string,
): void => {
  if (!hasExpectedLanguage(text, language) || !hasFirstPersonVoice(text, language)) {
    throw new ProgressiveCloneAnalysisError(
      "validation",
      `${field} must use first-person ${language} matching the target chat`,
    );
  }
};

const stableId = (...parts: string[]): string => createHash("sha256")
  .update(parts.join("\u0000"))
  .digest("hex")
  .slice(0, 24);

const mergeBounded = <T>(
  previous: T[],
  incoming: T[],
  keyOf: (item: T) => string,
  limit: number,
): T[] => {
  const byKey = new Map<string, T>();
  for (const item of [...previous, ...incoming]) {
    const key = keyOf(item);
    if (!byKey.has(key)) byKey.set(key, item);
  }
  return [...byKey.values()].slice(-limit);
};

const selectEvenly = <T>(items: T[], limit: number): T[] => {
  if (items.length <= limit) return items;
  if (limit === 1) return [items[items.length - 1]];
  return Array.from({ length: limit }, (_, index) => (
    items[Math.round(index * (items.length - 1) / (limit - 1))]
  ));
};

const emptySections = (): ProgressiveRichBioSections => ({
  identity: [],
  personality: [],
  interests: [],
  relationships: [],
  boundaries: [],
  aspirations: [],
});

const renderRichBio = (
  sections: ProgressiveRichBioSections,
  language: AnalysisLanguage,
): string => BIO_SECTION_KEYS
  .map((section) => {
    const claims = sections[section];
    if (claims.length === 0) return "";
    const title = SECTION_HEADINGS[language][section];
    return `## ${title}\n${claims.map((claim) => `- ${claim.text}`).join("\n")}`;
  })
  .filter(Boolean)
  .join("\n\n")
  .slice(0, 12_000);

const parsePreviousSnapshot = (
  input: z.infer<typeof inputSchema>,
): ProgressiveCloneSnapshot | undefined => {
  if (input.previousSnapshot === undefined) return undefined;
  try {
    const snapshot = snapshotSchema.parse(input.previousSnapshot) as ProgressiveCloneSnapshot;
    if (normalizeName(snapshot.targetName) !== normalizeName(input.targetName)) {
      throw new Error("previousSnapshot belongs to a different target");
    }
    if (snapshot.totalBatches !== input.totalBatches) {
      throw new Error("previousSnapshot totalBatches does not match this job");
    }
    return snapshot;
  } catch (error) {
    throw new ProgressiveCloneAnalysisError(
      "input",
      error instanceof Error ? error.message : "invalid previousSnapshot",
      error,
    );
  }
};

const getSafeTargetMessages = (
  messages: ParsedMessage[],
  targetName: string,
  maxContentLength: number,
): ParsedMessage[] => messages.filter((message) => {
  if (normalizeName(message.sender) !== normalizeName(targetName)) return false;
  const content = message.content.trim();
  if (!content || content.length > maxContentLength || SENSITIVE_PATTERN.test(content)) return false;
  return scrubPII(content) === content;
});

const getExactEvidence = (
  evidence: string,
  allowedEvidence: Map<string, ParsedMessage[]>,
): ParsedMessage[] | undefined => allowedEvidence.get(evidence.trim());

const buildChatSnippets = (
  messages: ParsedMessage[],
  safeTargetMessages: ParsedMessage[],
  targetName: string,
  batchIndex: number,
): ProgressiveChatSnippet[] => {
  const safeSet = new Set(safeTargetMessages);
  const snippets: ProgressiveChatSnippet[] = [];
  for (let index = 0; index < messages.length; index++) {
    const target = messages[index];
    if (!safeSet.has(target)) continue;
    const previous = messages[index - 1];
    const context = previous && normalizeName(previous.sender) !== normalizeName(targetName)
      ? scrubPII(previous.content).trim().slice(0, 500)
      : undefined;
    snippets.push({
      text: target.content.trim(),
      ...(context && !SENSITIVE_PATTERN.test(context) ? { context } : {}),
      timestamp: target.date.toISOString(),
      sourceBatch: batchIndex,
    });
  }
  return selectEvenly(snippets, 30);
};

const buildPrompt = (
  input: z.infer<typeof inputSchema>,
  evidenceMessages: ParsedMessage[],
  replyExamples: Array<{ context: string; response: string }>,
  analysisLanguage: AnalysisLanguage,
  previous?: ProgressiveCloneSnapshot,
): string => {
  const previousSummary = previous ? JSON.stringify({
    richBio: previous.richBio,
    timeline: previous.timeline.map(({ title, when, location }) => ({ title, when, location })),
    speechStyle: previous.speechStyle,
    memorySeeds: previous.memorySeeds.map(({ text, subject, category }) => ({ text, subject, category })),
  }).slice(0, 20_000) : "none";

  return `You analyze one chronological WhatsApp batch for the exact target "${input.targetName}".
This is batch ${input.batchIndex + 1} of ${input.totalBatches}.
${input.batchIndex === 0
    ? "Return useful identity, personality, tone, and response-style evidence immediately."
    : "Enrich the cumulative profile with new facts, changes over time, relationships, and events; avoid restating prior claims."}
${languageInstruction(analysisLanguage)}

STRICT EVIDENCE RULES:
- Every claim, timeline event, style observation, and memory seed must cite an evidence string copied EXACTLY from TARGET_MESSAGES.content.
- Write rich-bio claims, timeline details, tone descriptions, response patterns, and emoji-pattern descriptions in first person.
- Start each analytical description with an explicit first-person form such as I, أنا, or Ana.
- Keep signature phrases and every evidence string verbatim; never translate, rewrite, or shorten them.
- In speechStyle.responsePatterns: capture authentic WhatsApp rhythm, average message brevity (~3-5 words per bubble, short punchy clauses, micro-nudges like "فينك" / ".", teasing banter, grounded empathy).
- In speechStyle.emojiPatterns: note realistic emoji usage (e.g. natural predominance of 😂, absence of decorative bot emojis).
- Memory salience must be a decimal from 0.0 to 1.0 (for example 0.85, not 85).
- Never infer a location unless its exact text appears inside cited evidence; otherwise return null.
- when must be null, an exact sentAt timestamp, or text copied from cited evidence.
- Do not invent chat snippets, quotations, biography, secrets, diagnoses, fears, or relationships.
- If evidence is insufficient for a section, return an empty array.
- Memory subject is user, persona, or relationship. Pronouns alone are not enough to change subject.

PREVIOUS_CUMULATIVE_PROFILE:
${previousSummary}

TARGET_MESSAGES:
${JSON.stringify(evidenceMessages.map((message) => ({
  content: message.content.trim(),
  sentAt: message.date.toISOString(),
})), null, 2)}

OBSERVED_REPLY_PAIRS:
${JSON.stringify(replyExamples, null, 2)}
`;
};

const parseModelResult = (responseText: string | null | undefined): ProgressiveModelResult => {
  try {
    if (!responseText?.trim()) throw new Error("model returned an empty response");
    return modelResultSchema.parse(JSON.parse(responseText)) as ProgressiveModelResult;
  } catch (error) {
    throw new ProgressiveCloneAnalysisError(
      "validation",
      error instanceof Error ? error.message : "malformed model response",
      error,
    );
  }
};

const analyzeWithClient = async (
  rawInput: AnalyzeProgressiveCloneBatchInput,
  clientFactory: () => ProgressiveCloneModelClient,
): Promise<ProgressiveCloneSnapshot> => {
  let input: z.infer<typeof inputSchema>;
  try {
    input = inputSchema.parse(rawInput);
  } catch (error) {
    throw new ProgressiveCloneAnalysisError(
      "input",
      error instanceof Error ? error.message : "invalid batch input",
      error,
    );
  }

  const previous = parsePreviousSnapshot(input);
  if (previous?.processedBatches.includes(input.batchIndex)) return previous;

  let messages: ParsedMessage[];
  try {
    messages = parseWhatsAppChat(input.batchText);
  } catch (error) {
    throw new ProgressiveCloneAnalysisError(
      "parsing",
      error instanceof Error ? error.message : "could not parse WhatsApp batch",
      error,
    );
  }
  if (messages.length === 0) {
    throw new ProgressiveCloneAnalysisError("parsing", "batch contains no readable WhatsApp messages");
  }

  const participantNames = new Set(messages.map((message) => normalizeName(message.sender)));
  if (!participantNames.has(normalizeName(input.targetName))) {
    throw new ProgressiveCloneAnalysisError(
      "input",
      `target participant "${input.targetName}" was not found exactly in this batch`,
    );
  }

  const allTargetMessages = messages.filter(
    (message) => normalizeName(message.sender) === normalizeName(input.targetName),
  );
  const analysisLanguage = detectAnalysisLanguage(allTargetMessages);
  const safeEvidenceMessages = getSafeTargetMessages(
    messages,
    input.targetName,
    MAX_MODEL_EVIDENCE_CHARS,
  );
  const safeSnippetMessages = getSafeTargetMessages(
    messages,
    input.targetName,
    MAX_AUTHENTIC_SNIPPET_CHARS,
  );
  if (safeEvidenceMessages.length === 0) {
    throw new ProgressiveCloneAnalysisError(
      "evidence",
      "batch has no bounded, non-sensitive target messages available for analysis",
    );
  }

  const modelMessages = selectEvenly(safeEvidenceMessages, MAX_MODEL_MESSAGES);
  const allowedEvidence = new Map<string, ParsedMessage[]>();
  for (const message of modelMessages) {
    const text = message.content.trim();
    allowedEvidence.set(text, [...(allowedEvidence.get(text) || []), message]);
  }

  const batchReplyExamples = extractTargetReplyExamples(messages, input.targetName, MAX_REPLY_EXAMPLES)
    .filter((example) => !SENSITIVE_PATTERN.test(example.context) && !SENSITIVE_PATTERN.test(example.response));

  let response: { text?: string | null };
  try {
    response = await clientFactory().models.generateContent({
      model: PROGRESSIVE_CLONE_MODEL,
      contents: [{ role: "user", parts: [{ text: buildPrompt(
        input,
        modelMessages,
        batchReplyExamples,
        analysisLanguage,
        previous,
      ) }] }],
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: modelResponseSchema,
        safetySettings: GEMINI_SAFETY_OFF_SETTINGS,
      },
    });
  } catch (error) {
    throw new ProgressiveCloneAnalysisError(
      "model",
      error instanceof Error ? error.message : "Gemini Flash request failed",
      error,
    );
  }

  const modelResult = parseModelResult(response.text);
  const serializedModelResult = JSON.stringify(modelResult);
  if (
    SENSITIVE_PATTERN.test(serializedModelResult) ||
    scrubPII(serializedModelResult) !== serializedModelResult
  ) {
    throw new ProgressiveCloneAnalysisError(
      "validation",
      "model output contained sensitive or personally identifying data",
    );
  }
  const previousSections = previous?.richBioSections || emptySections();
  const richBioSections = emptySections();
  for (const section of BIO_SECTION_KEYS) {
    const incoming = modelResult.richBioSections[section].flatMap((claim) => {
      if (!getExactEvidence(claim.evidence, allowedEvidence)) return [];
      assertAnalyticalVoice(claim.text, analysisLanguage, `richBioSections.${section}`);
      return [{ ...claim, sourceBatch: input.batchIndex }];
    });
    richBioSections[section] = mergeBounded(
      previousSections[section],
      incoming,
      (claim) => `${normalizeKey(claim.text)}|${normalizeKey(claim.evidence)}`,
      MAX_CLAIMS_PER_SECTION,
    );
  }

  const incomingTimeline: ProgressiveTimelineEvent[] = modelResult.timeline.flatMap((event) => {
    const evidenceGroups = event.evidence.map((evidence) => getExactEvidence(evidence, allowedEvidence));
    if (evidenceGroups.some((matches) => !matches)) return [];
    const evidenceMessages = evidenceGroups.flatMap((matches) => matches || []);
    if (event.location && !event.evidence.some((evidence) => normalizeKey(evidence).includes(normalizeKey(event.location!)))) {
      return [];
    }
    if (event.when) {
      const matchesTimestamp = evidenceMessages.some((message) => message.date.toISOString() === event.when);
      const matchesEvidence = event.evidence.some((evidence) => normalizeKey(evidence).includes(normalizeKey(event.when!)));
      if (!matchesTimestamp && !matchesEvidence) {
        return [];
      }
    }
    if (!hasExpectedLanguage(event.title, analysisLanguage)) {
      throw new ProgressiveCloneAnalysisError(
        "validation",
        `timeline title must match the target's ${analysisLanguage} chat language`,
      );
    }
    assertAnalyticalVoice(event.details, analysisLanguage, "timeline.details");
    return [{
      id: stableId(input.targetName, event.title, event.evidence.join("|")),
      title: event.title,
      details: event.details,
      ...(event.when ? { when: event.when } : {}),
      ...(event.location ? { location: event.location } : {}),
      evidence: event.evidence,
      sourceBatch: input.batchIndex,
    }];
  });

  const validateStyleClaims = (claims: Array<{ text: string; evidence: string }>) => claims.filter(
    (claim) => Boolean(getExactEvidence(claim.evidence, allowedEvidence)),
  );
  const incomingTone = validateStyleClaims(modelResult.speechStyle.tone);
  incomingTone.forEach((claim) => assertAnalyticalVoice(claim.text, analysisLanguage, "speechStyle.tone"));
  const incomingPhrases = validateStyleClaims(modelResult.speechStyle.signaturePhrases).filter(
    (phrase) => normalizeKey(phrase.evidence).includes(normalizeKey(phrase.text)),
  );
  const incomingResponsePatterns = validateStyleClaims(modelResult.speechStyle.responsePatterns);
  const incomingEmojiPatterns = validateStyleClaims(modelResult.speechStyle.emojiPatterns);
  incomingResponsePatterns.forEach((claim) => assertAnalyticalVoice(
    claim.text,
    analysisLanguage,
    "speechStyle.responsePatterns",
  ));
  incomingEmojiPatterns.forEach((claim) => assertAnalyticalVoice(
    claim.text,
    analysisLanguage,
    "speechStyle.emojiPatterns",
  ));
  const previousStyle = previous?.speechStyle;
  const speechStyle: ProgressiveSpeechStyle = {
    toneSummary: mergeBounded(
      previousStyle?.toneSummary ? previousStyle.toneSummary.split("; ") : [],
      incomingTone.map((claim) => claim.text),
      normalizeKey,
      12,
    ).join("; ").slice(0, 2_000) || SPEECH_HEADINGS[analysisLanguage].pendingTone,
    signaturePhrases: mergeBounded(
      previousStyle?.signaturePhrases || [], incomingPhrases.map((claim) => claim.text), normalizeKey, 40,
    ),
    responsePatterns: mergeBounded(
      previousStyle?.responsePatterns || [], incomingResponsePatterns.map((claim) => claim.text), normalizeKey, 30,
    ),
    emojiPatterns: mergeBounded(
      previousStyle?.emojiPatterns || [], incomingEmojiPatterns.map((claim) => claim.text), normalizeKey, 30,
    ),
  };

  const incomingMemories: ProgressiveMemorySeed[] = modelResult.memorySeeds.flatMap((seed) => (
    getExactEvidence(seed.evidence, allowedEvidence)
      ? [{ ...seed, sourceBatch: input.batchIndex }]
      : []
  ));
  const memorySeeds = mergeBounded(
    previous?.memorySeeds || [],
    incomingMemories,
    (seed) => `${seed.subject}|${seed.category}|${normalizeKey(seed.text)}|${normalizeKey(seed.evidence)}`,
    MAX_MEMORY_SEEDS,
  );

  const chatSnippets = mergeBounded(
    previous?.chatSnippets || [],
    buildChatSnippets(messages, safeSnippetMessages, input.targetName, input.batchIndex),
    (snippet) => `${snippet.timestamp || ""}|${normalizeKey(snippet.text)}`,
    MAX_CHAT_SNIPPETS,
  );
  const replyExamples = mergeBounded(
    previous?.replyExamples || [],
    batchReplyExamples.map((example) => ({ ...example, sourceBatch: input.batchIndex })),
    (example) => `${normalizeKey(example.context)}|${normalizeKey(example.response)}`,
    MAX_REPLY_EXAMPLES,
  );
  const timeline = mergeBounded(
    previous?.timeline || [], incomingTimeline, (event) => event.id, MAX_TIMELINE_EVENTS,
  );
  const processedBatches = [...new Set([...(previous?.processedBatches || []), input.batchIndex])]
    .sort((left, right) => left - right);
  const sourceMessageCount = (previous?.sourceMessageCount || 0) + allTargetMessages.length;
  const evidenceItemCount = BIO_SECTION_KEYS.reduce(
    (count, section) => count + richBioSections[section].length,
    timeline.length + memorySeeds.length + speechStyle.responsePatterns.length + chatSnippets.length + replyExamples.length,
  );
  if (evidenceItemCount === 0) {
    throw new ProgressiveCloneAnalysisError("evidence", "model returned no evidence-backed enrichment");
  }

  const batchCoverage = Math.round(processedBatches.length / input.totalBatches * 100);
  const evidenceCoverage = Math.min(100, Math.round(
    (Math.min(sourceMessageCount, 50) / 50 * 60) + (Math.min(evidenceItemCount, 20) / 20 * 40),
  ));
  const overall = Math.min(100, Math.round(evidenceCoverage * 0.75 + batchCoverage * 0.25));
  const latestTimestamp = messages.reduce(
    (latest, message) => message.date.getTime() > latest.getTime() ? message.date : latest,
    messages[0].date,
  ).toISOString();
  const jobId = previous?.analysis.jobId || `clone-${stableId(input.targetName, String(input.totalBatches), input.batchText)}`;

  const snapshot: ProgressiveCloneSnapshot = {
    version: 1,
    targetName: input.targetName,
    totalBatches: input.totalBatches,
    sourceMessageCount,
    richBio: renderRichBio(richBioSections, analysisLanguage),
    richBioSections,
    timeline,
    speechStyle,
    chatSnippets,
    memorySeeds,
    replyExamples,
    confidence: { overall, evidenceCoverage, batchCoverage, sourceMessageCount },
    overallConfidence: overall,
    processedBatches,
    analysis: {
      jobId,
      status: processedBatches.length === input.totalBatches ? "ready" : "partial",
      processedBatches: processedBatches.length,
      totalBatches: input.totalBatches,
      capturedMemories: memorySeeds.length,
      capturedEvents: timeline.length,
      capturedSnippets: chatSnippets.length,
      updatedAt: latestTimestamp,
    },
  };

  try {
    return snapshotSchema.parse(snapshot) as ProgressiveCloneSnapshot;
  } catch (error) {
    throw new ProgressiveCloneAnalysisError(
      "validation",
      error instanceof Error ? error.message : "cumulative snapshot is invalid",
      error,
    );
  }
};

export const createProgressiveCloneBatchAnalyzer = (
  client: ProgressiveCloneModelClient,
): ((input: AnalyzeProgressiveCloneBatchInput) => Promise<ProgressiveCloneSnapshot>) => (
  (input) => analyzeWithClient(input, () => client)
);

export const analyzeProgressiveCloneSnapshotBatch = (
  input: AnalyzeProgressiveCloneBatchInput,
): Promise<ProgressiveCloneSnapshot> => analyzeWithClient(
  input,
  () => createGoogleGenAIClient() as unknown as ProgressiveCloneModelClient,
);

const formatSpeechStyle = (
  style: ProgressiveSpeechStyle,
  language: AnalysisLanguage,
): string => {
  const headings = SPEECH_HEADINGS[language];
  return [
    style.toneSummary,
    style.signaturePhrases.length > 0
      ? `${headings.signaturePhrases}: ${style.signaturePhrases.join("، ")}`
      : "",
    style.responsePatterns.length > 0
      ? `${headings.responsePatterns}: ${style.responsePatterns.join("، ")}`
      : "",
    style.emojiPatterns.length > 0
      ? `${headings.emojiPatterns}: ${style.emojiPatterns.join("، ")}`
      : "",
  ].filter(Boolean).join("\n");
};

const unwrapPriorServerSnapshot = (
  value: ProgressiveCloneBatchRouteRequest["priorSnapshot"],
): ProgressiveCloneSnapshot | undefined => {
  if (!value) return undefined;
  if ("version" in value) return value as ProgressiveCloneSnapshot;
  return value.serverSnapshot as ProgressiveCloneSnapshot | undefined;
};

const toRouteResult = (
  snapshot: ProgressiveCloneSnapshot,
): ProgressiveCloneBatchRouteResult => {
  const analysisLanguage = detectAnalysisLanguage([{ content: [
    snapshot.richBio,
    snapshot.speechStyle.toneSummary,
    ...snapshot.speechStyle.responsePatterns,
  ].join("\n") }]);
  return {
    settingsPatch: {
    botName: snapshot.targetName,
    botBio: snapshot.richBio || undefined,
    impersonationProfile: formatSpeechStyle(snapshot.speechStyle, analysisLanguage),
    cloneProfile: {
      version: 1,
      source: "whatsapp",
      targetName: snapshot.targetName,
      sourceMessageCount: snapshot.sourceMessageCount,
      overallConfidence: snapshot.overallConfidence,
      replyExamples: snapshot.replyExamples.map(({ context, response }) => ({ context, response })),
      richBio: snapshot.richBio || undefined,
      timeline: snapshot.timeline,
      speechStyle: snapshot.speechStyle,
      chatSnippets: snapshot.chatSnippets,
      memorySeeds: snapshot.memorySeeds.map(({ text, category, salience, subject }) => ({
        text,
        category,
        salience,
        subject,
      })),
      analysis: snapshot.analysis,
    },
  },
  memorySeeds: snapshot.memorySeeds.map(({ text, category, salience, subject }) => ({
    text,
    category,
    salience,
    subject,
  })),
  preview: undefined,
    serverSnapshot: snapshot,
  };
};

const analyzeRouteWithClient = async (
  request: ProgressiveCloneBatchRouteRequest,
  client: ProgressiveCloneModelClient,
): Promise<ProgressiveCloneBatchRouteResult> => {
  let parsedRequest: ProgressiveCloneBatchRouteRequest;
  try {
    parsedRequest = routeRequestSchema.parse(request) as ProgressiveCloneBatchRouteRequest;
  } catch (error) {
    throw new ProgressiveCloneAnalysisError(
      "input",
      error instanceof Error ? error.message : "invalid route request",
      error,
    );
  }
  const snapshot = await analyzeWithClient({
    batchText: parsedRequest.text,
    targetName: parsedRequest.targetName,
    batchIndex: parsedRequest.batchIndex,
    totalBatches: parsedRequest.totalBatches,
    previousSnapshot: unwrapPriorServerSnapshot(parsedRequest.priorSnapshot),
  }, () => client);
  const routeSnapshot = snapshot.analysis.jobId === parsedRequest.jobId ? snapshot : {
    ...snapshot,
    analysis: { ...snapshot.analysis, jobId: parsedRequest.jobId },
  };
  return toRouteResult(routeSnapshot);
};

export const createProgressiveCloneBatchRouteAnalyzer = (
  client: ProgressiveCloneModelClient,
): ((request: ProgressiveCloneBatchRouteRequest) => Promise<ProgressiveCloneBatchRouteResult>) => (
  (request) => analyzeRouteWithClient(request, client)
);

export const analyzeProgressiveCloneBatch = (
  request: ProgressiveCloneBatchRouteRequest,
): Promise<ProgressiveCloneBatchRouteResult> => analyzeRouteWithClient(
  request,
  createGoogleGenAIClient() as unknown as ProgressiveCloneModelClient,
);
