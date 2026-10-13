export const FLASH_3_6_MODEL = 'gemini-3.6-flash' as const;
export const FLASH_3_7_MODEL = 'gemini-3.7-flash' as const;
export const FLASH_3_8_MODEL = 'gemini-3.8-flash' as const;
export const FLASH_3_5_MODEL = 'gemini-3.5-flash' as const;
export const FLASH_3_5_LITE_MODEL = 'gemini-3.5-flash-lite' as const;
export const FLASH_LITE_LATEST_MODEL = 'gemini-flash-lite-latest' as const;
export const FLASH_2_5_MODEL = 'gemini-2.5-flash' as const;
export const PRO_2_5_MODEL = 'gemini-2.5-pro' as const;
export const FLASH_1_5_MODEL = 'gemini-1.5-flash' as const;
export const PRO_3_1_MODEL = 'gemini-3.1-pro-preview' as const;
export const DEFAULT_CHAT_MODEL = FLASH_3_6_MODEL;
export const FAST_CHAT_MODEL = FLASH_3_6_MODEL;
export const DEFAULT_THINKING_LEVEL = 'low' as const;

export const getChatModelFallbackChain = (requestedModel: string): string[] => {
  const chain: string[] = [requestedModel];
  if (!chain.includes(FLASH_3_8_MODEL)) chain.push(FLASH_3_8_MODEL);
  if (!chain.includes(FLASH_2_5_MODEL)) chain.push(FLASH_2_5_MODEL);
  if (requestedModel.includes('pro') && !chain.includes(PRO_2_5_MODEL)) chain.push(PRO_2_5_MODEL);
  if (!chain.includes(FLASH_1_5_MODEL)) chain.push(FLASH_1_5_MODEL);
  return chain;
};

export const STUDIO_IMAGE_MODEL = 'gemini-3.1-flash-image' as const;
export const STUDIO_IMAGE_MODEL_CHAIN = [
  STUDIO_IMAGE_MODEL,
] as const;

export const STUDIO_STYLE_PROMPTS = {
  realistic: 'photorealistic, highly detailed, natural lighting',
  cartoon: 'cartoon style, vibrant colors, bold outlines',
  anime: 'anime art style, Japanese animation, detailed eyes',
  oil_painting: 'oil painting style, textured brushstrokes, classical art',
  watercolor: 'watercolor painting, soft edges, flowing colors',
  sketch: 'pencil sketch, hand-drawn, detailed linework',
  digital_art: 'digital art, modern illustration, clean lines',
  cinematic: 'cinematic composition, dramatic lighting, movie still',
} as const;

export const AGENTROUTER_GPT_5_6_SOL = 'gpt-5.6-sol' as const;
export const AGENTROUTER_CLAUDE_OPUS_5 = 'claude-opus-5' as const;

export type ChatModelDefinition = {
  readonly id: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly description: string;
  readonly hidden?: boolean;
};

export const CHAT_MODELS = [
  {
    id: FLASH_3_8_MODEL,
    label: 'Gemini 3.8 Flash',
    shortLabel: '3.8 Flash',
    description: 'Next-generation, ultra-fast and responsive (Vertex AI)',
  },
  {
    id: PRO_3_1_MODEL,
    label: 'Gemini 3.1 Pro',
    shortLabel: '3.1 Pro',
    description: 'Deep reasoning and advanced analytical intelligence (Vertex AI)',
  },
  {
    id: FLASH_3_6_MODEL,
    label: 'Gemini 3.6 Flash',
    shortLabel: '3.6 Flash',
    description: 'Fast and stable high-performance model',
  },
  {
    id: FLASH_3_7_MODEL,
    label: 'Gemini 3.7 Flash',
    shortLabel: '3.7 Flash',
    description: 'Balanced reasoning and fast conversational intelligence',
  },
  // Legacy / Hidden models (hidden from UI, preserved for backward-compatibility)
  {
    id: 'gemini-3-flash-preview',
    label: '3 Flash',
    shortLabel: 'Flash',
    description: 'Legacy preview model',
    hidden: true,
  },
  {
    id: FLASH_3_6_MODEL,
    label: '3.6 Flash',
    shortLabel: '3.6 Flash',
    description: 'Generation 3.6',
    hidden: true,
  },
  {
    id: FLASH_3_7_MODEL,
    label: '3.7 Flash',
    shortLabel: '3.7 Flash',
    description: 'Generation 3.7',
    hidden: true,
  },
  // OpenRouter models (Verified live free tier)
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    label: 'Nemotron 3 Ultra 550B',
    shortLabel: 'Nemotron Ultra',
    description: 'OpenRouter Free - NVIDIA 550B high intelligence',
  },
  {
    id: 'google/gemma-4-31b-it:free',
    label: 'Gemma 4 31B',
    shortLabel: 'Gemma 4',
    description: 'OpenRouter Free - Google 31B conversational model',
  },
  {
    id: 'google/gemma-4-26b-a4b-it:free',
    label: 'Gemma 4 26B A4B',
    shortLabel: 'Gemma 26B',
    description: 'OpenRouter Free - Lightweight and responsive 26B model',
  },
  {
    id: 'openrouter/free',
    label: 'OpenRouter Free Auto-Router',
    shortLabel: 'Free Router',
    description: 'OpenRouter Free - Automatic routing to best available model',
  },
  {
    id: 'dots-studio/dots-3-note-preview:free',
    label: 'Dots3 Note Preview',
    shortLabel: 'Dots-3',
    description: 'OpenRouter Free - Fast and concise note companion',
  },
  {
    id: 'cohere/north-mini-code:free',
    label: 'North Mini Code',
    shortLabel: 'Cohere Code',
    description: 'OpenRouter Free - Specialized coding intelligence',
  },
  {
    id: 'qwen/qwen3.8-27b:free',
    label: 'Qwen 3.8 27B',
    shortLabel: 'Qwen 3.8',
    description: 'OpenRouter Free - Qwen 27B high precision model',
  },
  {
    id: AGENTROUTER_GPT_5_6_SOL,
    label: 'GPT-5.6 Sol',
    shortLabel: 'GPT-5.6',
    description: 'AgentRouter reasoning intelligence',
    hidden: true,
  },
  {
    id: AGENTROUTER_CLAUDE_OPUS_5,
    label: 'Claude Opus 5',
    shortLabel: 'Opus 5',
    description: 'AgentRouter persona intelligence',
    hidden: true,
  },
] as const;

export const VISIBLE_CHAT_MODELS = CHAT_MODELS.filter(m => !('hidden' in m && m.hidden));

export type ChatModelId = (typeof CHAT_MODELS)[number]['id'];

export const isAgentRouterModel = (modelId: unknown): boolean => (
  typeof modelId === 'string' && (
    modelId.includes('/') ||
    modelId.startsWith('openrouter') ||
    modelId === AGENTROUTER_GPT_5_6_SOL ||
    modelId === AGENTROUTER_CLAUDE_OPUS_5 ||
    modelId.startsWith('agentrouter-') ||
    modelId === 'gpt-5.6-sol' ||
    modelId === 'claude-opus-5'
  )
);

export const THINKING_LEVELS = [
  {
    id: 'low',
    label: 'Low',
    description: 'Fast and concise thinking',
  },
  {
    id: 'medium',
    label: 'Medium',
    description: 'Balanced and structured reasoning',
  },
  {
    id: 'high',
    label: 'High',
    description: 'Deep reasoning and maximum analytical focus',
  },
] as const;

export type ChatThinkingLevelId = (typeof THINKING_LEVELS)[number]['id'];

export const isSupportedChatModel = (modelId: unknown): modelId is ChatModelId => (
  typeof modelId === 'string' && CHAT_MODELS.some(model => model.id === modelId)
);

export const resolveChatModel = (modelId: unknown): ChatModelId => {
  if (modelId === PRO_3_1_MODEL || modelId === 'gemini-3.1-pro') {
    return PRO_3_1_MODEL;
  }
  if (isSupportedChatModel(modelId)) return modelId;
  return DEFAULT_CHAT_MODEL;
};

export const isSupportedThinkingLevel = (level: unknown): level is ChatThinkingLevelId => (
  typeof level === 'string' && THINKING_LEVELS.some(item => item.id === level)
);

export const resolveThinkingLevel = (level: unknown): ChatThinkingLevelId => (
  isSupportedThinkingLevel(level) ? level : DEFAULT_THINKING_LEVEL
);
