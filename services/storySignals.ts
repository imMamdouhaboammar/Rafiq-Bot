import type { StoryAcl, StorySignal } from '../contracts/rafiqV6.js';

export const MAX_STORY_SIGNALS_PER_PROMPT = 3;
export const MAX_STORY_SIGNAL_PROMPT_CHARS = 600;

export const canBotReadStoryAcl = (acl: StoryAcl, botId: string): boolean => {
  if (acl.visibility === 'private') return false;
  if (acl.visibility === 'all_bots') return true;
  return acl.botIds.includes(botId);
};

const normalizeForDeduplication = (text: string): string => (
  text.toLocaleLowerCase('ar').replace(/\s+/g, ' ').trim()
);

export interface SelectedStorySignals {
  signals: StorySignal[];
  promptText?: string;
  characterCount: number;
}

export const selectStorySignals = (
  signals: StorySignal[],
  botId: string,
  options: {
    now?: Date;
    maxSignals?: number;
    maxCharacters?: number;
  } = {},
): SelectedStorySignals => {
  const now = options.now ?? new Date();
  const maxSignals = Math.max(0, Math.min(MAX_STORY_SIGNALS_PER_PROMPT, options.maxSignals ?? MAX_STORY_SIGNALS_PER_PROMPT));
  const maxCharacters = Math.max(0, Math.min(MAX_STORY_SIGNAL_PROMPT_CHARS, options.maxCharacters ?? MAX_STORY_SIGNAL_PROMPT_CHARS));
  const seen = new Set<string>();
  const selected: StorySignal[] = [];
  let usedCharacters = 0;

  const candidates = signals
    .filter(signal => signal.sensitivity !== 'private')
    .filter(signal => canBotReadStoryAcl(signal.acl, botId))
    .filter(signal => !signal.expiresAt || signal.expiresAt.getTime() > now.getTime())
    .sort((left, right) => {
      if (right.salience !== left.salience) return right.salience - left.salience;
      return right.createdAt.getTime() - left.createdAt.getTime();
    });

  for (const signal of candidates) {
    if (selected.length >= maxSignals) break;
    const dedupeKey = normalizeForDeduplication(signal.text);
    if (!dedupeKey || seen.has(dedupeKey)) continue;

    const linePrefix = selected.length === 0 ? '' : '\n';
    const available = maxCharacters - usedCharacters - linePrefix.length;
    if (available <= 0) break;

    const text = signal.text.length <= available
      ? signal.text
      : `${signal.text.slice(0, Math.max(0, available - 1)).trimEnd()}…`;
    if (!text) break;

    selected.push({ ...signal, text });
    seen.add(dedupeKey);
    usedCharacters += linePrefix.length + text.length;
  }

  if (selected.length === 0) {
    return { signals: [], characterCount: 0 };
  }

  const promptText = [
    'إشارات خلفية موجزة من قصة المستخدم:',
    ...selected.map(signal => `- ${signal.text}`),
    'استخدمها لفهم السياق فقط. لا تقتبس المصدر ولا تكشف تفاصيل حساسة أو تذكر أنك تقرأ سجلًا.',
  ].join('\n');

  return {
    signals: selected,
    promptText,
    characterCount: selected.reduce((total, signal, index) => total + signal.text.length + (index === 0 ? 0 : 1), 0),
  };
};
