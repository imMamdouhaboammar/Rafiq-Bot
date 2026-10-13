import { getTextDirection, resolveRuntimeLocale, type RuntimeLocaleConfig, type RuntimeLocaleInput, type TextDirection } from '../services/runtimeLocale.js';

export type SupportedUiLocale = 'en-US' | 'ar-EG';

export const DEFAULT_UI_LOCALE: SupportedUiLocale = 'en-US';
export const SUPPORTED_UI_LOCALES: readonly SupportedUiLocale[] = ['en-US', 'ar-EG'] as const;

export interface LocaleDescriptor {
  code: SupportedUiLocale;
  label: string;
  nativeLabel: string;
  direction: TextDirection;
  defaultCulture: 'neutral' | 'egyptian-arabic';
  completeness: 'complete' | 'reference';
}

export const LOCALE_CATALOG_DESCRIPTORS: Record<SupportedUiLocale, LocaleDescriptor> = {
  'en-US': {
    code: 'en-US',
    label: 'English (US)',
    nativeLabel: 'English',
    direction: 'ltr',
    defaultCulture: 'neutral',
    completeness: 'complete',
  },
  'ar-EG': {
    code: 'ar-EG',
    label: 'Arabic (Egypt)',
    nativeLabel: 'العربية (مصر)',
    direction: 'rtl',
    defaultCulture: 'egyptian-arabic',
    completeness: 'reference',
  },
};

export function normalizeUiLocale(locale?: string): SupportedUiLocale {
  if (!locale) return DEFAULT_UI_LOCALE;
  const cleaned = locale.trim().replace(/_/g, '-').toLowerCase();
  if (cleaned === 'ar-eg' || cleaned.startsWith('ar-eg-') || cleaned === 'ar') {
    return 'ar-EG';
  }
  return 'en-US';
}

export function resolveUiLocaleConfig(input: RuntimeLocaleInput = {}): RuntimeLocaleConfig & { uiLocale: SupportedUiLocale } {
  const runtime = resolveRuntimeLocale(input);
  const uiLocale = normalizeUiLocale(runtime.locale);
  return {
    ...runtime,
    uiLocale,
    direction: input.direction || getTextDirection(runtime.locale),
  };
}
