import { DEFAULT_UI_LOCALE } from '../config.js';

export function formatLocalizedTime(
  date: Date | number | string,
  locale: string = DEFAULT_UI_LOCALE,
  timeZone: string = 'UTC',
): string {
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
    }).format(parsed);
  } catch {
    return new Intl.DateTimeFormat(DEFAULT_UI_LOCALE, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }).format(parsed);
  }
}

export function formatLocalizedDate(
  date: Date | number | string,
  locale: string = DEFAULT_UI_LOCALE,
  timeZone: string = 'UTC',
): string {
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone,
    }).format(parsed);
  } catch {
    return new Intl.DateTimeFormat(DEFAULT_UI_LOCALE, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(parsed);
  }
}

export function formatLocalizedNumber(
  value: number,
  locale: string = DEFAULT_UI_LOCALE,
): string {
  try {
    return new Intl.NumberFormat(locale).format(value);
  } catch {
    return String(value);
  }
}
