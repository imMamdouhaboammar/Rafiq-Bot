import crypto from "node:crypto";
import { LangCache } from "@redis-ai/langcache";
import type { BotSettings, PsychologicalState } from "../types.js";

type CacheContext = {
  chatId?: string;
  settings: BotSettings;
  routeInstruction?: string;
  externalContext?: string;
  modelId: string;
  thinkingLevel: string;
  psychology?: PsychologicalState;
  route?: string;
  userMessage?: string;
};

type CacheLookup = {
  hit: boolean;
  text?: string;
  similarity?: number;
};

const LANGCACHE_ENABLED = process.env.RAFIQ_LANGCACHE_ENABLED === "true";
const LANGCACHE_API_KEY = process.env.LANGCACHE_API_KEY || process.env.REDIS_LANGCACHE_API_KEY;
const LANGCACHE_SERVER_URL = process.env.REDIS_LANGCACHE_SERVER_URL;
const LANGCACHE_CACHE_ID = process.env.REDIS_LANGCACHE_CACHE_ID;
const LANGCACHE_THRESHOLD = Number(process.env.RAFIQ_LANGCACHE_SIMILARITY_THRESHOLD || 0.91);
const LANGCACHE_TTL_MS = Number(process.env.RAFIQ_LANGCACHE_TTL_MS || 1000 * 60 * 60 * 24 * 7);
const LANGCACHE_USE_ATTRIBUTES = process.env.RAFIQ_LANGCACHE_USE_ATTRIBUTES === "true";

let client: LangCache | null = null;

export const isLangCacheConfigured = () => (
  LANGCACHE_ENABLED && Boolean(LANGCACHE_API_KEY && LANGCACHE_SERVER_URL && LANGCACHE_CACHE_ID)
);

const getClient = (): LangCache => {
  if (!isLangCacheConfigured()) {
    throw new Error("LangCache is not configured.");
  }

  if (!client) {
    client = new LangCache({
      serverURL: LANGCACHE_SERVER_URL!,
      cacheId: LANGCACHE_CACHE_ID!,
      apiKey: LANGCACHE_API_KEY!,
      timeoutMs: 4000,
    });
  }

  return client;
};

const shortHash = (value: string): string => (
  crypto.createHash("sha256").update(value).digest("hex").slice(0, 16)
);

const sanitizeAttribute = (value: string | undefined, fallback: string): string => (
  (value || fallback).replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 64) || fallback
);

const buildStablePsychologySignature = (context: CacheContext): string => {
  const psych = context.psychology;
  if (!psych) return "no-psych";

  const mood = psych.mood || "neutral";
  
  // Relationship stage bucket based on intimacy level
  let intimacyBucket = "stranger";
  if (psych.intimacyLevel >= 80) intimacyBucket = "soulmate";
  else if (psych.intimacyLevel >= 50) intimacyBucket = "close";
  else if (psych.intimacyLevel >= 20) intimacyBucket = "casual";

  // Emotional Ledger bucket to group moods properly
  let ledgerBucket = "neutral";
  if (psych.emotionalLedger < -40) ledgerBucket = "angry";
  else if (psych.emotionalLedger < -10) ledgerBucket = "guarded";
  else if (psych.emotionalLedger > 40) ledgerBucket = "warm";

  // Route identifier
  const route = context.route || "none";

  // Check if user's message is food-related
  const msg = (context.userMessage || "").toLowerCase();
  const isFoodRelated = msg.includes("جوع") || msg.includes("جعان") || msg.includes("أكل") || msg.includes("مطعم") || msg.includes("عشا") || msg.includes("غدا") || msg.includes("فطار") || msg.includes("hungry") || msg.includes("food") || msg.includes("eat") || msg.includes("restaurant") || msg.includes("dinner") || msg.includes("lunch");
  
  // Only include hunger level bucket if the user message is actually about food
  const hungerBucket = isFoodRelated ? (psych.hungerLevel > 80 ? "starving" : "normal") : "ignored";

  const bioHash = shortHash(context.settings.botBio || "");
  const impersonationHash = shortHash(context.settings.impersonationProfile || "");

  return [
    `mood:${mood}`,
    `intimacy:${intimacyBucket}`,
    `ledger:${ledgerBucket}`,
    `route:${route}`,
    `hunger:${hungerBucket}`,
    `bio:${bioHash}`,
    `impersonation:${impersonationHash}`
  ].join("|");
};

const buildAttributes = (context: CacheContext): Record<string, string> => {
  const psychSignature = buildStablePsychologySignature(context);
  return {
    app: "rafiq",
    chat: sanitizeAttribute(context.chatId, "global"),
    bot: sanitizeAttribute(context.settings.botName, "bot"),
    soul: sanitizeAttribute(context.settings.soulId, "default"),
    model: sanitizeAttribute(context.modelId, "model"),
    thinking: sanitizeAttribute(context.thinkingLevel, "low"),
    route: sanitizeAttribute(context.route || "none", "none"),
    psych: shortHash(psychSignature),
  };
};

const buildCachePrompt = (prompt: string, context: CacheContext): string => {
  const contextHash = shortHash([
    context.settings.botBio || "",
    context.settings.impersonationProfile || "",
    context.externalContext || "",
    context.routeInstruction || "",
  ].join("\n---\n"));

  const psychSignature = buildStablePsychologySignature(context);

  return [
    `chat=${sanitizeAttribute(context.chatId, "global")}`,
    `bot=${context.settings.botName}`,
    `soul=${context.settings.soulId || "default"}`,
    `model=${context.modelId}`,
    `thinking=${context.thinkingLevel}`,
    `context=${contextHash}`,
    `psychology=${psychSignature}`,
    `prompt=${prompt.trim()}`,
  ].join("\n");
};

export const canUseLangCache = (options: {
  prompt: string;
  attachmentsCount: number;
  hasReplyContext: boolean;
  allowSearch?: boolean;
}) => (
  isLangCacheConfigured() &&
  options.prompt.trim().length >= 6 &&
  options.attachmentsCount === 0 &&
  !options.hasReplyContext &&
  !options.allowSearch
);

export const searchLangCache = async (prompt: string, context: CacheContext): Promise<CacheLookup> => {
  if (!isLangCacheConfigured()) return { hit: false };

  try {
    const route = context.route || "";
    // Avoid semantic cache hits for emotionally sensitive chat routes
    const isSensitive = route === "venting" || route === "conflict" || route === "decision";
    const searchStrategies: ("exact" | "semantic")[] = isSensitive ? ["exact"] : ["exact", "semantic"];

    const response = await getClient().search({
      prompt: buildCachePrompt(prompt, context),
      similarityThreshold: LANGCACHE_THRESHOLD,
      searchStrategies,
      ...(LANGCACHE_USE_ATTRIBUTES ? { attributes: buildAttributes(context) } : {}),
    });

    const match = response.data
      .filter(entry => entry.response.trim().length > 0)
      .sort((a, b) => b.similarity - a.similarity)[0];

    if (!match) return { hit: false };
    return { hit: true, text: match.response, similarity: match.similarity };
  } catch (error) {
    console.warn("[LangCache] Search skipped:", error);
    return { hit: false };
  }
};

export const saveLangCache = async (prompt: string, responseText: string, context: CacheContext) => {
  if (!isLangCacheConfigured() || !responseText.trim()) return;

  try {
    await getClient().set({
      prompt: buildCachePrompt(prompt, context),
      response: responseText,
      ...(LANGCACHE_USE_ATTRIBUTES ? { attributes: buildAttributes(context) } : {}),
      ttlMillis: LANGCACHE_TTL_MS,
    });
  } catch (error) {
    console.warn("[LangCache] Save skipped:", error);
  }
};
