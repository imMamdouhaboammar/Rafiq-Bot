import { ResponsePath } from "./responseRouter.js";

export type PromptBudget = {
  maxSystemTokens: number;
  maxMemoryItems: number;
  maxRecentMessages: number;
  includeFullSoul: boolean;
  includeCompressedSoul: boolean;
  includeExamples: boolean;
  memoryTimeoutMs: number;
};

export const PROMPT_BUDGETS: Record<ResponsePath, PromptBudget> = {
  fast_chat: {
    maxSystemTokens: 2400,
    maxMemoryItems: 0,
    maxRecentMessages: 8,
    includeFullSoul: false,
    includeCompressedSoul: true,
    includeExamples: false,
    memoryTimeoutMs: 0, // No memory retrieval
  },
  normal_persona: {
    maxSystemTokens: 3200,
    maxMemoryItems: 3,
    maxRecentMessages: 14,
    includeFullSoul: false,
    includeCompressedSoul: true,
    includeExamples: true,
    memoryTimeoutMs: 300, // Strict 300ms timeout
  },
  deep_persona: {
    maxSystemTokens: 3200,
    maxMemoryItems: 6,
    maxRecentMessages: 20,
    includeFullSoul: false,
    includeCompressedSoul: true,
    includeExamples: true,
    memoryTimeoutMs: 700, // 700ms timeout
  },
  memory_heavy: {
    maxSystemTokens: 3600,
    maxMemoryItems: 10,
    maxRecentMessages: 16,
    includeFullSoul: false,
    includeCompressedSoul: true,
    includeExamples: true,
    memoryTimeoutMs: 1200, // 1200ms timeout
  },
  tool_required: {
    maxSystemTokens: 2500,
    maxMemoryItems: 4,
    maxRecentMessages: 12,
    includeFullSoul: false,
    includeCompressedSoul: true,
    includeExamples: true,
    memoryTimeoutMs: 500,
  },
};

export const OUTPUT_LIMITS: Record<ResponsePath, number> = {
  fast_chat: 800,
  normal_persona: 1200,
  deep_persona: 2000,
  memory_heavy: 2000,
  tool_required: 1500,
};
