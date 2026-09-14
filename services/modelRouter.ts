import { ResponsePath } from "./responseRouter.js";
import { ChatModelId, DEFAULT_CHAT_MODEL, PRO_3_1_MODEL, FLASH_3_8_MODEL, FLASH_3_6_MODEL, FLASH_3_7_MODEL, isAgentRouterModel, resolveChatModel } from "./geminiModels.js";

type ModelConfig = {
  modelName: string;
  temperature: number;
  maxOutputTokens: number;
  useThinking: boolean;
};

// Fallback configuration if environment variables are not specified
const MODEL_FALLBACKS: Record<ResponsePath, string> = {
  fast_chat: FLASH_3_8_MODEL,        // Gemini 3.8 Flash for lightning speed
  normal_persona: FLASH_3_8_MODEL,   // Gemini 3.8 Flash
  deep_persona: PRO_3_1_MODEL,       // Gemini 3.1 Pro
  memory_heavy: PRO_3_1_MODEL,       // Gemini 3.1 Pro
  tool_required: FLASH_3_8_MODEL,    // Gemini 3.8 Flash
};

/**
 * Resolves the optimal model, temperature, and token limits for a specific pathway.
 */
export function resolveModelRoute(
  path: ResponsePath,
  userSelectedModel?: string,
  userSelectedThinking?: string
): ModelConfig {
  // 1. Read environment variables if available
  const envFast = process.env.RAFIQ_MODEL_FAST;
  const envNormal = process.env.RAFIQ_MODEL_NORMAL;
  const envDeep = process.env.RAFIQ_MODEL_DEEP;

  let modelName = MODEL_FALLBACKS[path];

  // Map to environment overrides if present
  if (path === "fast_chat" && envFast) {
    modelName = envFast;
  } else if ((path === "normal_persona" || path === "tool_required") && envNormal) {
    modelName = envNormal;
  } else if ((path === "deep_persona" || path === "memory_heavy") && envDeep) {
    modelName = envDeep;
  } else if (userSelectedModel) {
    modelName = isAgentRouterModel(userSelectedModel)
      ? userSelectedModel
      : resolveChatModel(userSelectedModel);
  }

  // 2. Determine pathway parameters
  let temperature = 1.0;
  let maxOutputTokens = 1200;
  // All reasoning levels (low, medium, high) activate thinkingConfig
  let useThinking = Boolean(userSelectedThinking);

  switch (path) {
    case "fast_chat":
      temperature = 0.85;
      maxOutputTokens = 800;
      break;
    case "normal_persona":
      temperature = 1.0;
      maxOutputTokens = 1200;
      break;
    case "deep_persona":
      temperature = 1.05;
      maxOutputTokens = 2000;
      useThinking = true;
      break;
    case "memory_heavy":
      temperature = 0.95;
      maxOutputTokens = 2000;
      break;
    case "tool_required":
      temperature = 0.9;
      maxOutputTokens = 1500;
      break;
  }

  const resolved = {
    modelName,
    temperature,
    maxOutputTokens,
    useThinking,
  };

  // Let the bot write up to 1,000 lines (scale up maxOutputTokens to full 8192 tokens)
  // for all major conversational pathways, ensuring absolute freedom and no cutoffs.
  if (
    path === "fast_chat" ||
    path === "normal_persona" ||
    path === "deep_persona" ||
    path === "memory_heavy" ||
    path === "tool_required"
  ) {
    resolved.maxOutputTokens = 8192;
  }

  // If thinking is enabled, we definitely need the maximum output limit (8192 tokens)
  // because thinking/reasoning tokens consume from the same output budget.
  if (resolved.useThinking) {
    resolved.maxOutputTokens = 8192;
  }

  return resolved;
}
