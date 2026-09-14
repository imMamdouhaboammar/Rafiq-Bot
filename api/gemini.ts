import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "node:crypto";
import { assertAppSession } from "../services/appAuth.server.js";
import * as GeminiServerService from "../services/geminiService.server.js";
import * as ReflectionEngine from "../services/reflectionEngine.server.js";
import { processFileUpload } from "../services/fileProcessor.server.js";
import { CLONE_ACTIONS, getCloneActionStage } from "../services/cloneActionRegistry.server.js";

const ACTIONS = {
  sendMessageToGemini: GeminiServerService.sendMessageToGemini,
  generateGroupResponse: GeminiServerService.generateGroupResponse,
  analyzeChatExport: GeminiServerService.analyzeChatExport,
  generateInitiativeMessage: GeminiServerService.generateInitiativeMessage,
  generateBioFromTraits: GeminiServerService.generateBioFromTraits,
  generateImage: GeminiServerService.generateImage,
  generateSelfie: GeminiServerService.generateSelfie,
  buildAvatarImagePrompt: GeminiServerService.buildAvatarImagePrompt,
  generateStudioImage: GeminiServerService.generateStudioImage,
  generateProfileAvatar: GeminiServerService.generateProfileAvatar,
  generateUserAvatar: GeminiServerService.generateUserAvatar,
  analyzePersonalitySignals: GeminiServerService.analyzePersonalitySignals,
  runReflectionConsolidation: ReflectionEngine.runReflectionConsolidation,
  generateVideo: GeminiServerService.generateVideo,
  processFileUpload,
  ...CLONE_ACTIONS,
} as const;

const personalityAnalysisWindows = new Map<string, { startedAt: number; count: number }>();
const reflectionWindows = new Map<string, { startedAt: number; count: number }>();
const PERSONALITY_ANALYSIS_WINDOW_MS = 60 * 60 * 1000;
const PERSONALITY_ANALYSIS_MAX_PER_WINDOW = 24;
const REFLECTION_WINDOW_MS = 60 * 60 * 1000;
const REFLECTION_MAX_PER_WINDOW = 12;

const validatePersonalityAnalysisArgs = (args: unknown[]): boolean => {
  if (args.length !== 1 || !args[0] || typeof args[0] !== "object") return false;
  const input = args[0] as { botName?: unknown; currentSummary?: unknown; messages?: unknown };
  if (typeof input.botName !== "string" || input.botName.length > 80) return false;
  if (typeof input.currentSummary !== "string" || input.currentSummary.length > 300) return false;
  if (!Array.isArray(input.messages) || input.messages.length < 1 || input.messages.length > 24) return false;
  return input.messages.every(message => {
    if (!message || typeof message !== "object") return false;
    const candidate = message as Record<string, unknown>;
    return typeof candidate.id === "string"
      && candidate.id.length <= 160
      && ["user", "model"].includes(String(candidate.role))
      && typeof candidate.text === "string"
      && candidate.text.length <= 1_000
      && typeof candidate.timestamp === "string"
      && candidate.timestamp.length <= 64;
  });
};

export const validateReflectionArgs = (args: unknown[]): boolean => {
  if (args.length !== 1 || !args[0] || typeof args[0] !== "object") return false;
  const input = args[0] as Record<string, unknown>;
  if (typeof input.chatId !== "string" || input.chatId.length > 160) return false;
  if (typeof input.botId !== "string" || input.botId.length > 160) return false;
  if (typeof input.botName !== "string" || input.botName.length > 80) return false;
  if (!input.currentState || typeof input.currentState !== "object") return false;
  const state = input.currentState as Record<string, unknown>;
  if (typeof state.mood !== "string") return false;
  if (typeof state.intimacyLevel !== "number" || !Number.isFinite(state.intimacyLevel)) return false;
  if (typeof state.emotionalLedger !== "number" || !Number.isFinite(state.emotionalLedger)) return false;
  if (!Array.isArray(input.messages) || input.messages.length < 1 || input.messages.length > 30) return false;

  const allowedKeys = new Set(["id", "chatId", "role", "text", "timestamp"]);
  return input.messages.every(message => {
    if (!message || typeof message !== "object") return false;
    const candidate = message as Record<string, unknown>;
    if (Object.keys(candidate).some(key => !allowedKeys.has(key))) return false;
    return typeof candidate.id === "string"
      && candidate.id.length <= 160
      && typeof candidate.chatId === "string"
      && candidate.chatId.length <= 160
      && ["user", "model"].includes(String(candidate.role))
      && typeof candidate.text === "string"
      && candidate.text.length <= 2_000
      && typeof candidate.timestamp === "string"
      && candidate.timestamp.length <= 64;
  });
};

const clientHash = (req: VercelRequest): string => {
  const forwarded = req.headers["x-forwarded-for"];
  const clientKey = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0] || "unknown";
  return crypto.createHash("sha256").update(clientKey).digest("hex");
};

const consumeQuota = (
  windows: Map<string, { startedAt: number; count: number }>,
  key: string,
  windowMs: number,
  maxPerWindow: number,
): boolean => {
  const now = Date.now();
  const existing = windows.get(key);
  if (!existing || now - existing.startedAt >= windowMs) {
    windows.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (existing.count >= maxPerWindow) return false;
  existing.count += 1;
  return true;
};

const consumePersonalityAnalysisQuota = (req: VercelRequest): boolean => consumeQuota(
  personalityAnalysisWindows,
  clientHash(req),
  PERSONALITY_ANALYSIS_WINDOW_MS,
  PERSONALITY_ANALYSIS_MAX_PER_WINDOW,
);

const consumeReflectionQuota = (req: VercelRequest): boolean => consumeQuota(
  reflectionWindows,
  clientHash(req),
  REFLECTION_WINDOW_MS,
  REFLECTION_MAX_PER_WINDOW,
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    assertAppSession(req);
    const { action, args = [] } = req.body ?? {};
    if (typeof action !== "string" || !(action in ACTIONS) || !Array.isArray(args)) {
      return res.status(400).json({ success: false, error: "Invalid Gemini action" });
    }
    if (action === "analyzePersonalitySignals") {
      if (!validatePersonalityAnalysisArgs(args)) {
        return res.status(400).json({ success: false, error: "Invalid personality analysis input" });
      }
      if (!consumePersonalityAnalysisQuota(req)) {
        return res.status(429).json({ success: false, error: "Personality analysis rate limit exceeded" });
      }
    }
    if (action === "runReflectionConsolidation") {
      if (!validateReflectionArgs(args)) {
        return res.status(400).json({ success: false, error: "Invalid reflection input" });
      }
      if (!consumeReflectionQuota(req)) {
        return res.status(429).json({ success: false, error: "Reflection rate limit exceeded" });
      }
    }

    const fn = ACTIONS[action as keyof typeof ACTIONS] as (...params: unknown[]) => Promise<unknown>;
    const result = await fn(...args);
    return res.status(200).json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const statusCode = error && typeof error === "object" && "statusCode" in error
      ? Number((error as { statusCode?: unknown }).statusCode) || 500
      : 500;
    const cloneStage = getCloneActionStage(error);
    if (cloneStage) {
      console.error("[Clone API Error]", {
        stage: cloneStage,
        errorName: error instanceof Error ? error.name : "Error",
      });
    } else {
      console.error("[Gemini API Error]", message);
    }
    return res.status(statusCode).json({
      success: false,
      error: message,
      stage: cloneStage,
    });
  }
}