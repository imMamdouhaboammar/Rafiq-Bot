
import { z } from "zod";
import { CompanionContinuityStateSchema } from "./services/companionContinuity.js";

export enum MessageRole {
  USER = 'user',
  MODEL = 'model'
}

export enum AppMode {
  CHAT = 'CHAT',
  LIVE_VOICE = 'LIVE_VOICE',
  VEO_VIDEO = 'VEO_VIDEO',
  IMAGE_GEN = 'IMAGE_GEN',
  STUDIO = 'STUDIO',
  SLOW_BURN_STORY = 'SLOW_BURN_STORY'
}

export enum RelationType {
  // Family
  BROTHER = 'brother',
  SISTER = 'sister',
  FATHER = 'father',
  MOTHER = 'mother',
  SON = 'son',
  DAUGHTER = 'daughter',
  COUSIN = 'cousin',
  
  // Friendship
  FRIEND = 'friend',
  BEST_FRIEND = 'best_friend',
  CHILDHOOD_FRIEND = 'childhood_friend',
  
  // Romantic / Complicated
  PARTNER = 'partner',
  FIANCE = 'fiance',
  SPOUSE = 'spouse',
  EX = 'ex',
  SITUATIONSHIP = 'situationship',
  CRUSH = 'crush',
  SECRET_ADMIRER = 'secret_admirer',
  
  // Professional / Social
  COLLEAGUE = 'colleague',
  MANAGER = 'manager',
  MENTOR = 'mentor',
  STUDENT = 'student',
  NEIGHBOR = 'neighbor',
  
  // Antagonistic
  ENEMY = 'enemy',
  RIVAL = 'rival',
  STRANGER = 'stranger'
}

export type ChattinessLevel = 'low' | 'balanced' | 'high';

export enum BotMood {
  HAPPY = 'happy',
  SAD = 'sad',
  ANGRY = 'angry',
  EXCITED = 'excited',
  ROMANTIC = 'romantic',
  ANXIOUS = 'anxious',
  NEUTRAL = 'neutral',
  PLAYFUL = 'playful',
  BORED = 'bored',
  HANGRY = 'hangry',
  BROKE = 'broke'
}

export interface ImageGenConfig {
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  size: "1K" | "2K" | "4K";
}

export type StudioStyle = 'realistic' | 'cartoon' | 'anime' | 'oil_painting' | 'watercolor' | 'sketch' | 'digital_art' | 'cinematic';

export interface StudioConfig {
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  size: "1K" | "2K" | "4K";
  style?: StudioStyle;
  enhancePrompt?: boolean;
}

export interface StudioMessage {
  prompt: string;
  config: StudioConfig;
  referenceImage?: string;
}

// --- SOUL ENGINE TYPES ---

export interface SoulTraits {
  chaos: number;      // 0 (Logical) -> 100 (Unhinged)
  empathy: number;    // 0 (Cold) -> 100 (Therapist)
  slang: number;      // 0 (Formal) -> 100 (Street)
  intellect: number;  // 0 (Simple) -> 100 (Philosopher)
  positivity: number; // 0 (Depressed) -> 100 (Manic)
}

export const AdaptiveFacetStateSchema = z.object({
  offsetBps: z.number().int().min(-1500).max(1500).default(0),
  confidenceBps: z.number().int().min(0).max(10000).default(0),
  evidenceCount: z.number().int().min(0).default(0),
});

export const AdaptivePersonalityEvidenceSchema = z.object({
  messageId: z.string(),
  sessionKey: z.string(),
  facet: z.enum(['warmth', 'humor', 'directness', 'expressiveness', 'initiative']),
  direction: z.union([z.literal(-1), z.literal(1)]),
  strength: z.number().int().min(1).max(3),
  confidenceBps: z.number().int().min(0).max(10000),
  kind: z.enum(['explicit_preference', 'correction', 'repeated_pattern']),
  observedAt: z.coerce.date(),
});

export const AdaptivePersonalityStateSchema = z.object({
  enabled: z.boolean().default(true),
  version: z.number().int().min(1).default(1),
  facets: z.object({
    warmth: AdaptiveFacetStateSchema.default({ offsetBps: 0, confidenceBps: 0, evidenceCount: 0 }),
    humor: AdaptiveFacetStateSchema.default({ offsetBps: 0, confidenceBps: 0, evidenceCount: 0 }),
    directness: AdaptiveFacetStateSchema.default({ offsetBps: 0, confidenceBps: 0, evidenceCount: 0 }),
    expressiveness: AdaptiveFacetStateSchema.default({ offsetBps: 0, confidenceBps: 0, evidenceCount: 0 }),
    initiative: AdaptiveFacetStateSchema.default({ offsetBps: 0, confidenceBps: 0, evidenceCount: 0 }),
  }),
  evidence: z.array(AdaptivePersonalityEvidenceSchema).default([]),
  processedMessageIds: z.array(z.string()).default([]),
  observeAfter: z.coerce.date().optional(),
  lastObservedUserAt: z.coerce.date().optional(),
  currentSessionKey: z.string().optional(),
  lastBatchId: z.string().optional(),
  lastRunAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  runDay: z.string().optional(),
  runsToday: z.number().int().min(0).default(0),
  dailyDeltaBps: z.record(z.number().int()).default({}),
  observationCount: z.number().int().min(0).default(0),
  summary: z.string().default('لسه بيتعرف على إيقاع الكلام وحدوده.'),
});

export interface VoiceConfig {
    pitch: number; // 0.5 to 1.5
    speed: number; // 0.5 to 1.5
    tone: 'sweet' | 'husky' | 'flat' | 'energetic';
}

export enum Dialect {
    CAIRO_MODERN = 'cairo_modern',
    ALEXANDRIAN = 'alexandrian',
    SAIDI = 'saidi',
    FUSHA_LIGHT = 'fusha_light',
    FRANKO_ARAB = 'franko'
}

export interface SoulDefinition {
  id: string;
  name: string;
  description: string;
  emoji: string;
  baseTraits: SoulTraits; // Default values
  systemPromptBase: string; // The core identity block
  vibe?: string;
  tempo?: string;
  attachmentStyle?: string;
  conflictStyle?: string;
  strengths?: string[];
  blindSpots?: string[];
  signatureBehaviors?: string[];
}

export interface MemoryEntry {
  id: string;
  chatId: string;
  sourceMessageId: string;
  sourceRole: MessageRole;
  text: string;
  summary: string;
  normalizedText: string;
  keywords: string[];
  category: 'identity' | 'preference' | 'memory' | 'goal' | 'fact' | 'emotion' | 'general';
  salience: number;
  createdAt: Date;
  updatedAt: Date;
}

// --- Zod Schemas ---

export const VisualSeedSchema = z.object({
  palette: z.string(),
  lighting: z.string(),
  tone: z.string(),
  seed: z.string(),
});

export type AttachmentCategory = 'image' | 'audio' | 'video' | 'document' | 'code' | 'spreadsheet' | 'archive' | 'other';

export const AttachmentSchema = z.object({
  file: z.any().optional(), 
  mimeType: z.string(),
  previewUrl: z.string(),
  base64: z.string().optional(),
  fileName: z.string().optional(),
  fileSize: z.number().optional(),
  category: z.enum(['image', 'audio', 'video', 'document', 'code', 'spreadsheet', 'archive', 'other']).optional(),
  extractedText: z.string().optional(),
  pageCount: z.number().optional(),
});

export const BotRelationshipSchema = z.object({
  targetBotId: z.string(),
  type: z.nativeEnum(RelationType),
});

export const ImaginaryWorldSchema = z.object({
  activeSetting: z.string().optional(),
  sharedLoreCount: z.number().default(0),
  lastFictionalTurn: z.string().optional(),
}).optional();

export const PsychologicalStateSchema = z.object({
  mood: z.nativeEnum(BotMood).default(BotMood.HAPPY),
  energyLevel: z.number().min(0).max(10).default(7),
  socialMeter: z.number().min(0).max(10).default(5),
  emotionalLedger: z.number().min(-100).max(100).default(10),
  currentScenario: z.string().default("Standard Routine"),
  intimacyLevel: z.number().min(0).max(100).default(10),
  lastInteractionTime: z.coerce.date().optional(),
  secretUnlocked: z.boolean().default(false),
  hungerLevel: z.number().min(0).max(100).optional(),
  financialStress: z.number().min(0).max(100).optional(),
  sleepiness: z.number().min(0).max(100).optional(),
  lastMoodChangedAt: z.coerce.date().optional(),
  moodStabilityTurns: z.number().default(0),
  lastMoodChangeReason: z.string().optional(),
  lastPhysicalStateMention: z.object({
    hungerAt: z.coerce.date().optional(),
    sleepAt: z.coerce.date().optional(),
    moneyAt: z.coerce.date().optional(),
  }).optional(),
  breakpointState: z.enum(['none', 'disappointed']).default('none').optional(),
  consecutiveNegativeTurns: z.number().default(0).optional(),
  consecutivePositiveTurns: z.number().default(0).optional(),
  disgustScore: z.number().min(0).max(100).default(0),
  tier: z.enum(['standard', 'pro']).default('pro'),
  isPro: z.boolean().default(true),
  isBlocked: z.boolean().default(false),
  blockedAt: z.coerce.date().optional(),
  blockReason: z.string().optional(),
  currentActivity: z.string().optional(),
  currentAvailability: z.enum(['free', 'busy', 'intermittent', 'dormant']).default('free').optional(),
  imaginaryWorld: ImaginaryWorldSchema,
});

export const CloneReplyExampleSchema = z.object({
  context: z.string().trim().min(1).max(500),
  response: z.string().trim().min(1).max(500),
});

export const CloneTimelineEventSchema = z.object({
  id: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(240),
  details: z.string().trim().min(1).max(1_500),
  when: z.string().trim().min(1).max(160).optional(),
  location: z.string().trim().min(1).max(240).optional(),
  evidence: z.array(z.string().trim().min(1).max(500)).max(4).default([]),
  sourceBatch: z.number().int().nonnegative(),
});

export const CloneChatSnippetSchema = z.object({
  text: z.string().trim().min(1).max(2_000),
  context: z.string().trim().min(1).max(500).optional(),
  timestamp: z.string().trim().min(1).max(160).optional(),
  tone: z.string().trim().min(1).max(160).optional(),
  sourceBatch: z.number().int().nonnegative(),
});

export const CloneSpeechStyleSchema = z.object({
  toneSummary: z.string().trim().min(1).max(2_000),
  signaturePhrases: z.array(z.string().trim().min(1).max(160)).max(40).default([]),
  responsePatterns: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
  emojiPatterns: z.array(z.string().trim().min(1).max(160)).max(30).default([]),
});

export const CloneAnalysisProgressSchema = z.object({
  jobId: z.string().trim().min(1).max(160),
  status: z.enum(['initializing', 'analyzing', 'ready', 'partial', 'error']),
  processedBatches: z.number().int().nonnegative(),
  totalBatches: z.number().int().positive(),
  capturedMemories: z.number().int().nonnegative().default(0),
  capturedEvents: z.number().int().nonnegative().default(0),
  capturedSnippets: z.number().int().nonnegative().default(0),
  updatedAt: z.string().datetime(),
  error: z.string().trim().max(1_000).optional(),
});

export const CloneProfileSchema = z.object({
  version: z.literal(1),
  source: z.literal('whatsapp'),
  targetName: z.string().trim().min(1).max(160),
  sourceMessageCount: z.number().int().positive(),
  overallConfidence: z.number().min(0).max(100),
  replyExamples: z.array(CloneReplyExampleSchema).min(1).max(24),
  richBio: z.string().trim().max(12_000).optional(),
  timeline: z.array(CloneTimelineEventSchema).max(80).optional(),
  speechStyle: CloneSpeechStyleSchema.optional(),
  chatSnippets: z.array(CloneChatSnippetSchema).max(80).optional(),
  memorySeeds: z.array(z.object({
    text: z.string().trim().min(3).max(500),
    category: z.enum(['identity', 'preference', 'memory', 'goal', 'fact', 'emotion']),
    salience: z.number().finite().min(0).max(1),
    subject: z.enum(['user', 'persona', 'relationship']).optional(),
  }).strict()).max(60).optional(),
  analysis: CloneAnalysisProgressSchema.optional(),
});

export const BotSettingsSchema = z.object({
  botName: z.string().min(1),
  botGender: z.enum(['male', 'female']),
  botAge: z.number().optional(),
  botBio: z.string().optional(),
  avatarUrl: z.string().optional(),
  chattiness: z.enum(['low', 'balanced', 'high']).default('balanced'),
  fragmentedMessages: z.boolean().default(true),
  relationshipWithUser: z.nativeEnum(RelationType).optional(),
  relationshipsWithBots: z.array(BotRelationshipSchema).optional(),
  impersonationProfile: z.string().optional(), 
  cloneProfile: CloneProfileSchema.optional(),
  visualSeed: VisualSeedSchema.optional(),
  model: z.string().optional(),
  thinkingLevel: z.enum(['low', 'medium', 'high']).default('low').optional(),
  boostRafiq: z.boolean().default(false).optional(),
  attachmentStyle: z.enum(['secure', 'anxious', 'avoidant']).default('secure').optional(),
  
  // Soul Engine Fields
  soulId: z.string().default('amira_default'), 
  soulTraits: z.object({
      chaos: z.number().min(0).max(100),
      empathy: z.number().min(0).max(100),
      slang: z.number().min(0).max(100),
      intellect: z.number().min(0).max(100),
      positivity: z.number().min(0).max(100)
  }).optional(),
  adaptivePersonality: AdaptivePersonalityStateSchema.optional(),
  
  // Voice & Dialect
  dialect: z.nativeEnum(Dialect).default(Dialect.CAIRO_MODERN).optional(),
  voiceConfig: z.object({
      pitch: z.number(),
      speed: z.number(),
      tone: z.enum(['sweet', 'husky', 'flat', 'energetic'])
  }).optional(),
});

export const ChatSessionSchema = z.object({
  id: z.string(),
  isGroup: z.boolean().optional(),
  groupName: z.string().optional(),
  memberIds: z.array(z.string()).optional(),
  settings: BotSettingsSchema,
  psychology: PsychologicalStateSchema.optional(),
  continuityState: CompanionContinuityStateSchema.optional(),
  lastMessage: z.string().optional(),
  lastMessageTimestamp: z.coerce.date().optional(),
  unreadCount: z.number().optional(),
});

export const ReactionSchema = z.object({
    emoji: z.string(),
    senderId: z.string(),
    senderName: z.string(),
});

export const ChatMessageSchema = z.object({
  id: z.string(),
  chatId: z.string(),
  senderId: z.string().optional(),
  senderName: z.string().optional(),
  rootMessageId: z.string().optional(),
  replyToMessageId: z.string().optional(),
  depth: z.number().int().min(0).optional(),
  role: z.nativeEnum(MessageRole),
  text: z.string(),
  attachments: z.array(AttachmentSchema).optional(),
  timestamp: z.coerce.date(),
  isThinking: z.boolean().optional(),
  isError: z.boolean().optional(),
  deletedForMe: z.boolean().optional(),
  groundingUrls: z.array(z.object({ title: z.string(), uri: z.string() })).optional(),
  reactions: z.array(ReactionSchema).optional(),
  replyTo: z.object({
    id: z.string(),
    text: z.string(),
    senderName: z.string(),
    senderId: z.string()
  }).optional(),
  toolsUsed: z.array(z.object({
    toolName: z.enum(["current_time", "web_search", "open_url", "search_and_read"]),
    calledAt: z.string(),
    query: z.string().optional(),
    urls: z.array(z.string()).optional(),
    provider: z.string().optional()
  })).optional()
});

export const UserProfileSchema = z.object({
  name: z.string(),
  gender: z.enum(['male', 'female']),
  age: z.number(),
  bio: z.string().optional(),
  avatarBase64: z.string().optional(),
  voiceSampleBase64: z.string().optional(),
  personalityType: z.enum(['introvert', 'extrovert', 'balanced']).optional(),
  communicationStyle: z.enum(['direct', 'expressive', 'humorous']).optional(),
  moodBaseline: z.enum(['calm', 'energetic', 'serious']).optional(),
  interests: z.array(z.string()).optional(),
  visualDescription: z.string().optional(),
  tier: z.enum(['standard', 'pro']).default('pro'),
  isPro: z.boolean().default(true),
});

export type Attachment = z.infer<typeof AttachmentSchema>;
export type BotRelationship = z.infer<typeof BotRelationshipSchema>;
export type BotSettings = z.infer<typeof BotSettingsSchema>;
export type VisualSeed = z.infer<typeof VisualSeedSchema>;
export type PsychologicalState = z.infer<typeof PsychologicalStateSchema>;
export type AdaptiveFacetState = z.infer<typeof AdaptiveFacetStateSchema>;
export type AdaptivePersonalityEvidence = z.infer<typeof AdaptivePersonalityEvidenceSchema>;
export type AdaptivePersonalityState = z.infer<typeof AdaptivePersonalityStateSchema>;
export type ImaginaryWorld = z.infer<typeof ImaginaryWorldSchema>;
export type ChatSession = z.infer<typeof ChatSessionSchema>;
export type Reaction = z.infer<typeof ReactionSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type SoulConfiguration = { id: string; traits: SoulTraits };
export type MemoryCategory = MemoryEntry['category'];

// --- RANDOM PROMPTS (floating trigger button) ---

export const RandomPromptSchema = z.object({
  id: z.string(),
  userId: z.string(),           // owner of the prompt (for multi-user)
  text: z.string().min(1).max(500),
  tags: z.array(z.string()).optional(),  // optional categorization
  enabled: z.boolean().default(true),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  useCount: z.number().default(0),       // how many times this was used
  lastUsedAt: z.coerce.date().optional(),
});
export type RandomPrompt = z.infer<typeof RandomPromptSchema>;

// --- WHATSAPP CLONE PIPELINE TYPES ---

export interface ParticipantProfile {
  name: string;
  messageCount: number;
  averageMessageLength: number;
  emojiFrequency: number;
  questionFrequency: number;
  mediaMessageCount: number;
  activeHours: number[];
  fragmentedMessageRatio: number;
}

export interface ChatStatistics {
  totalMessages: number;
  participants: ParticipantProfile[];
  dateRange: { start: string; end: string };
  dominantLanguage: 'arabic' | 'english' | 'franco' | 'mixed';
  averageMessagesPerDay: number;
  isGroupChat: boolean;
}

export interface LinguisticProfile {
  signatureWords: string[];
  slangInventory: string[];
  fillerWords: string[];
  greetingPatterns: string[];
  farewellPatterns: string[];
  typingStyle: {
    averageSentenceLength: 'very_short' | 'short' | 'medium' | 'long' | 'very_long';
    usePunctuation: boolean;
    useCapitalization: 'never' | 'sometimes' | 'always';
    splitMessages: boolean;
    useCorrections: boolean;
    useAbbreviations: boolean;
  };
  emojiProfile: {
    density: 'none' | 'sparse' | 'moderate' | 'heavy' | 'excessive';
    favorites: string[];
    usesAsReaction: boolean;
  };
  languageMix: {
    primary: 'arabic' | 'english' | 'franco';
    secondary: 'arabic' | 'english' | 'franco' | 'none';
    francoFrequency: 'never' | 'rare' | 'moderate' | 'heavy';
  };
  rhythm: {
    burstMessaging: boolean;
    averageBurstSize: number;
    mediaSharing: 'rare' | 'moderate' | 'frequent';
  };
}

export interface PsychologicalProfile {
  personality: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  emotionalProfile: {
    baselineMood: 'happy' | 'neutral' | 'anxious' | 'melancholic' | 'energetic';
    emotionalRange: 'narrow' | 'moderate' | 'wide' | 'extreme';
    triggers: {
      anger: string[];
      joy: string[];
      anxiety: string[];
      sadness: string[];
    };
    copingMechanisms: string[];
  };
  relationshipDynamics: {
    role: 'leader' | 'supporter' | 'equal' | 'submissive' | 'challenger';
    attachmentStyle: 'secure' | 'anxious' | 'avoidant' | 'disorganized';
    conflictStyle: 'confrontational' | 'passive_aggressive' | 'avoidant' | 'collaborative';
    affectionStyle: string;
    relationshipTypeWithUser: string;
  };
  cognitiveStyle: {
    thinkingDepth: 'surface' | 'moderate' | 'deep' | 'philosophical';
    humorStyle: 'sarcastic' | 'dry' | 'slapstick' | 'dark' | 'punny' | 'none';
    topicObsessions: string[];
    topicAvoidances: string[];
  };
  socialBehavior: {
    chattiness: 'low' | 'balanced' | 'high';
    initiatesConversation: boolean;
    sharesPersonalInfo: boolean;
    complaintFrequency: 'rare' | 'moderate' | 'frequent';
  };
}

export interface SoulBlueprint {
  identity: {
    name: string;
    inferredGender: 'male' | 'female';
    inferredAge: number;
    bio: string;
  };
  impersonationProfile: string;
  replyExamples?: Array<{
    context: string;
    response: string;
  }>;
  soulTraits: SoulTraits;
  bestArchetypeId: string;
  config: {
    chattiness: 'low' | 'balanced' | 'high';
    fragmentedMessages: boolean;
    dialect: 'cairo_modern' | 'alexandrian' | 'saidi' | 'franko';
    relationshipType: string;
    voiceTone: 'sweet' | 'husky' | 'flat' | 'energetic';
    voicePitch: number;
    voiceSpeed: number;
  };
  memorySeeds: Array<{
    text: string;
    category: 'identity' | 'preference' | 'memory' | 'goal' | 'fact' | 'emotion';
    salience: number;
    subject?: 'user' | 'persona' | 'relationship';
  }>;
}

export type SoulMemorySeed = SoulBlueprint['memorySeeds'][number];

export type SynthesisStage = 'parsing' | 'participants' | 'linguistic' | 'psychological' | 'synthesis' | 'creating' | 'done' | 'error';

export interface SynthesisProgress {
  stage: SynthesisStage;
  progress: number;
  message: string;
}

export interface SoulSynthesisResult {
  blueprint: SoulBlueprint;
  settings: BotSettings;
  memorySeeds: Array<{
    text: string;
    category: 'identity' | 'preference' | 'memory' | 'goal' | 'fact' | 'emotion';
    salience: number;
    subject?: 'user' | 'persona' | 'relationship';
  }>;
  statistics: ChatStatistics;
  confidence: {
    linguistic: number;
    psychological: number;
    overall: number;
  };
}

// --- SLOW BURN STORY ENGINE TYPES ---

export const ActiveStoryStateSchema = z.object({
  id: z.string(),
  chatId: z.string(),
  title: z.string(),
  genre: z.string().optional(),
  currentChapter: z.number().int().min(1).default(1),
  totalEstimatedChapters: z.number().int().min(1).optional(),
  premise: z.string(),
  characters: z.array(z.string()).default([]),
  scenesLog: z.array(z.string()).default([]),
  tensionScore: z.number().min(0).max(100).default(30),
  mediaTriggerSummary: z.string().optional(),
  lastUserCue: z.string().optional(),
  status: z.enum(['active', 'paused', 'completed']).default('active'),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type ActiveStoryState = z.infer<typeof ActiveStoryStateSchema>;

// ==========================================
// RAFIQ NATIVE SKILLS ENGINE - TYPE CONTRACTS
// ==========================================

export type SkillCategory =
  | 'emotional'     // فضفضة، مواساة، استماع
  | 'lifestyle'     // جيم، دايت، صحة
  | 'entertainment' // سينما، ألغاز، إيفيهات، فوازير
  | 'productivity'  // مصاريف، جمعيات، تنظيم مهام
  | 'cultural';     // حكايات، تاريخ مصر، نوادر

export type SkillActivationMode = 'auto' | 'explicit' | 'always_on';

export interface SkillTrigger {
  keywords: string[];
  intents?: string[];
  minConfidence?: number;
  slashCommand?: string; // e.g. "/coach", "/vent", "/spots"
  arabicSlashAlias?: string; // e.g. "/كوتش", "/فضفضة"
}

export interface SkillBehavior {
  titleArabic: string;
  toneModifier: string;
  instructions: string;
  negativeConstraints: string[];
  sampleTurn?: {
    user: string;
    bot: string;
  };
}

export interface SkillToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required: string[];
  };
  handlerKey: string;
}

export interface SkillDefinition {
  id: string;
  name: string;
  englishName: string;
  category: SkillCategory;
  icon: string;
  description: string;
  version: string;
  author: 'system' | 'community' | 'user';
  activationMode: SkillActivationMode;
  triggers: SkillTrigger;
  behavior: SkillBehavior;
  tools?: SkillToolDefinition[];
  knowledgeSnippets?: string[];
  isDefaultInstalled?: boolean;
}

export interface InstalledSkillRecord {
  skillId: string;
  installedAt: Date;
  isEnabled: boolean;
  priority: number;
  pinnedInChat: boolean;
  customConfig?: Record<string, any>;
  lastActivatedAt?: Date;
  activationCount: number;
}

export interface SkillStateRecord {
  skillId: string;
  chatId: string;
  updatedAt: Date;
  state: Record<string, any>;
}

export interface SkillMatchResult {
  skill: SkillDefinition;
  score: number;
  triggerWord: string;
  matchedBy: 'slash' | 'keyword' | 'explicit';
}

// ==========================================
// RAFIQ LIVING COMPANION ENGINE - TYPE CONTRACTS
// ==========================================

export type CompanionAvailability = 'free' | 'busy' | 'intermittent' | 'dormant';

export interface DailyScheduleItem {
  from: string; // HH:MM
  to: string;   // HH:MM
  activity: string;
  activityArabic: string;
  location: string;
  availability: CompanionAvailability;
}

export interface DailyScript {
  date: string; // YYYY-MM-DD
  personaName: string;
  schedule: DailyScheduleItem[];
  currentMoodAnchor: BotMood;
  morningGreeting?: string;
  eveningVibe?: string;
}

export interface DisgustEvent {
  timestamp: Date;
  scoreDelta: number;
  reason: 'harassment' | 'profanity' | 'prompt_injection' | 'disrespect' | 'creepiness';
  userMessageSnippet: string;
}

export interface StickerItem {
  id: string;
  title: string;
  category: 'reaction' | 'meme' | 'cinema' | 'greeting' | 'shock';
  imageUrl: string;
  tags: string[];
  suggestedContext?: string;
}

export interface CoalescedMessageBurst {
  messages: string[];
  coalescedText: string;
  messageCount: number;
  firstReceivedAt: number;
  lastReceivedAt: number;
}

