export type TextDirection = 'ltr' | 'rtl';

export type RuntimeLocaleInput = {
  locale?: string;
  timezone?: string;
  direction?: TextDirection;
  culture?: string;
  conversationLanguage?: string;
  searchLocale?: string;
  searchRegion?: string;
};

export type RuntimeLocaleConfig = {
  locale: string;
  timezone: string;
  direction: TextDirection;
  culture: string;
  conversationLanguage: string;
  searchLocale: string;
  searchRegion?: string;
  isEgyptianReference: boolean;
};

const RTL_LANGUAGES = new Set(['ar', 'fa', 'he', 'ur', 'ps', 'sd', 'ug', 'yi']);

const clean = (value?: string): string | undefined => {
  const normalized = value?.trim();
  return normalized || undefined;
};

export const getTextDirection = (locale: string): TextDirection => {
  const language = locale.split(/[-_]/)[0]?.toLowerCase() || 'en';
  return RTL_LANGUAGES.has(language) ? 'rtl' : 'ltr';
};

export const getRegionFromLocale = (locale: string): string | undefined => {
  const parts = locale.split(/[-_]/);
  const region = parts.find((part, index) => index > 0 && /^[A-Za-z]{2}$/.test(part));
  return region?.toLowerCase();
};

export const resolveRuntimeLocale = (
  input: RuntimeLocaleInput = {},
  env: NodeJS.ProcessEnv = process.env,
): RuntimeLocaleConfig => {
  const locale = clean(input.locale) || clean(env.RAFIQ_DEFAULT_LOCALE) || 'en-US';
  const timezone = clean(input.timezone) || clean(env.RAFIQ_DEFAULT_TIMEZONE) || 'UTC';
  const requestedCulture = clean(input.culture);
  const normalizedLocale = locale.replace(/_/g, '-').toLowerCase();
  const localeUsesEgyptianReference = normalizedLocale === 'ar-eg' || normalizedLocale.startsWith('ar-eg-');
  const culture = requestedCulture || (localeUsesEgyptianReference ? 'egyptian-arabic' : 'neutral');
  const isEgyptianReference = requestedCulture
    ? requestedCulture.toLowerCase() === 'egyptian-arabic'
    : localeUsesEgyptianReference;
  const conversationLanguage = clean(input.conversationLanguage) || locale.split(/[-_]/)[0] || 'en';
  const searchLocale = clean(input.searchLocale) || clean(env.RAFIQ_WEB_SEARCH_LOCALE) || locale;
  const searchRegion = clean(input.searchRegion) || clean(env.RAFIQ_WEB_SEARCH_REGION) || getRegionFromLocale(searchLocale);

  return {
    locale,
    timezone,
    direction: input.direction || getTextDirection(locale),
    culture,
    conversationLanguage,
    searchLocale,
    searchRegion,
    isEgyptianReference,
  };
};

export const buildConversationLocaleInstruction = (config: RuntimeLocaleConfig): string => {
  if (config.isEgyptianReference || config.culture === 'egyptian-arabic') {
    return 'Use natural Egyptian Arabic when the conversation uses it, without forcing slang. Preserve RTL-aware phrasing and the persona\'s authored voice.';
  }

  return [
    `Use the conversational language and cultural register appropriate to locale ${config.locale}.`,
    `Conversation language hint: ${config.conversationLanguage}.`,
    config.culture !== 'neutral' ? `Cultural preset: ${config.culture}.` : '',
    'Do not import another locale, cultural identity, or language convention unless the persona or current conversation explicitly asks for it.',
  ].filter(Boolean).join(' ');
};
