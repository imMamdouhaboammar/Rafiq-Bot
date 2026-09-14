export const PRO_3_1_MODEL = 'gemini-3.1-pro-preview' as const;
export const FLASH_3_8_MODEL = 'gemini-3.8-flash' as const;
export const DEFAULT_CHAT_MODEL = PRO_3_1_MODEL;
export const FAST_CHAT_MODEL = FLASH_3_8_MODEL;
export const FLASH_3_6_MODEL = 'gemini-3.6-flash' as const;
export const FLASH_3_7_MODEL = 'gemini-3.7-flash' as const;
export const DEFAULT_THINKING_LEVEL = 'low' as const;

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
    id: PRO_3_1_MODEL,
    label: 'Gemini 3.1 Pro',
    shortLabel: '3.1 Pro',
    description: 'الأعمق والأدق في الاستدلال والتحليل',
  },
  {
    id: FLASH_3_8_MODEL,
    label: 'Gemini 3.8 Flash',
    shortLabel: '3.8 Flash',
    description: 'الجيل 3.8 الأسرع والأحدث مع تفكير ذكي',
  },
  // Legacy / Hidden models (hidden from UI, preserved for backward-compatibility)
  {
    id: 'gemini-3-flash-preview',
    label: '3 Flash',
    shortLabel: 'Flash',
    description: 'سابق',
    hidden: true,
  },
  {
    id: FLASH_3_6_MODEL,
    label: '3.6 Flash',
    shortLabel: '3.6 Flash',
    description: 'الجيل 3.6',
    hidden: true,
  },
  {
    id: FLASH_3_7_MODEL,
    label: '3.7 Flash',
    shortLabel: '3.7 Flash',
    description: 'الجيل 3.7',
    hidden: true,
  },
  {
    id: AGENTROUTER_GPT_5_6_SOL,
    label: 'GPT-5.6 Sol',
    shortLabel: 'GPT-5.6',
    description: 'AgentRouter ذكاء استدلالي',
    hidden: true,
  },
  {
    id: AGENTROUTER_CLAUDE_OPUS_5,
    label: 'Claude Opus 5',
    shortLabel: 'Opus 5',
    description: 'AgentRouter شخصيات',
    hidden: true,
  },
] as const;

export const VISIBLE_CHAT_MODELS = CHAT_MODELS.filter(m => !('hidden' in m && m.hidden));

export type ChatModelId = (typeof CHAT_MODELS)[number]['id'];

export const isAgentRouterModel = (modelId: unknown): boolean => (
  typeof modelId === 'string' && (
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
    description: 'تفكير سريع وموجز',
  },
  {
    id: 'medium',
    label: 'Medium',
    description: 'تفكير متوازن',
  },
  {
    id: 'high',
    label: 'High',
    description: 'أعمق استدلال وأعلى تركيز',
  },
] as const;

export type ChatThinkingLevelId = (typeof THINKING_LEVELS)[number]['id'];

export const isSupportedChatModel = (modelId: unknown): modelId is ChatModelId => (
  typeof modelId === 'string' && CHAT_MODELS.some(model => model.id === modelId)
);

export const resolveChatModel = (modelId: unknown): ChatModelId => {
  if (modelId === PRO_3_1_MODEL) return PRO_3_1_MODEL;
  if (modelId === FLASH_3_8_MODEL) return FLASH_3_8_MODEL;
  return DEFAULT_CHAT_MODEL;
};

export const isSupportedThinkingLevel = (level: unknown): level is ChatThinkingLevelId => (
  typeof level === 'string' && THINKING_LEVELS.some(item => item.id === level)
);

export const resolveThinkingLevel = (level: unknown): ChatThinkingLevelId => (
  isSupportedThinkingLevel(level) ? level : DEFAULT_THINKING_LEVEL
);


