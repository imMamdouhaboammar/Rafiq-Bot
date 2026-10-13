import { z } from 'zod';
import { CognitiveMode, CognitiveModeSchema } from './types.js';

export interface CompanionCognitiveConfig {
  mode: CognitiveMode;
  maxDeliveredEvidence: number;
  enableAssociativeActivation: boolean;
  checkStrictGrounding: boolean;
  timeoutMs: number;
}

export const CompanionCognitiveConfigSchema = z.object({
  mode: CognitiveModeSchema.default('off'),
  maxDeliveredEvidence: z.number().int().min(1).max(10).default(3),
  enableAssociativeActivation: z.boolean().default(true),
  checkStrictGrounding: z.boolean().default(false),
  timeoutMs: z.number().int().min(100).max(5000).default(600),
});

/**
 * Resolves active cognitive mode for a companion.
 * Defaults strictly to 'off' for backwards-compatibility with existing companions.
 */
export function resolveCognitiveMode(
  settings?: { cognitiveMode?: CognitiveMode | string } | null,
  systemDefault: CognitiveMode = 'off'
): CognitiveMode {
  if (!settings?.cognitiveMode) {
    return systemDefault;
  }
  const parsed = CognitiveModeSchema.safeParse(settings.cognitiveMode);
  return parsed.success ? parsed.data : systemDefault;
}

/**
 * Builds the full cognitive runtime config for a companion turn.
 */
export function getCompanionCognitiveConfig(
  settings?: { cognitiveMode?: CognitiveMode | string } | null
): CompanionCognitiveConfig {
  const mode = resolveCognitiveMode(settings, 'off');
  return {
    mode,
    maxDeliveredEvidence: mode === 'off' ? 0 : 3,
    enableAssociativeActivation: mode !== 'off',
    checkStrictGrounding: mode === 'strict',
    timeoutMs: mode === 'fast_chat' as any ? 0 : 600,
  };
}
