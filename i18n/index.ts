import enUS from './messages/en-US.json' with { type: 'json' };
import arEG from './messages/ar-EG.json' with { type: 'json' };
import {
  DEFAULT_UI_LOCALE,
  LOCALE_CATALOG_DESCRIPTORS,
  SUPPORTED_UI_LOCALES,
  normalizeUiLocale,
  resolveUiLocaleConfig,
  type LocaleDescriptor,
  type SupportedUiLocale,
} from './config.js';
import {
  formatLocalizedDate,
  formatLocalizedNumber,
  formatLocalizedTime,
} from './formatters/index.js';

export {
  DEFAULT_UI_LOCALE,
  LOCALE_CATALOG_DESCRIPTORS,
  SUPPORTED_UI_LOCALES,
  normalizeUiLocale,
  resolveUiLocaleConfig,
  formatLocalizedDate,
  formatLocalizedNumber,
  formatLocalizedTime,
  type LocaleDescriptor,
  type SupportedUiLocale,
};

export type MessageCatalog = typeof enUS;

const CATALOGS: Record<SupportedUiLocale, MessageCatalog> = {
  'en-US': enUS,
  'ar-EG': arEG,
};

function lookupNestedKey(obj: unknown, path: string): string | undefined {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

export function getCatalog(locale?: string): MessageCatalog {
  const normalized = normalizeUiLocale(locale);
  return CATALOGS[normalized] ?? CATALOGS[DEFAULT_UI_LOCALE];
}

export function t(
  key: string,
  locale: string = DEFAULT_UI_LOCALE,
  params?: Record<string, string | number>,
): string {
  const normalized = normalizeUiLocale(locale);
  const primary = lookupNestedKey(CATALOGS[normalized], key);
  const fallback = lookupNestedKey(CATALOGS[DEFAULT_UI_LOCALE], key);
  const template = primary ?? fallback ?? key;

  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, token: string) =>
    params[token] !== undefined ? String(params[token]) : `{${token}}`,
  );
}
