import type { BotSettings } from '../types.js';

type CloneProfile = NonNullable<BotSettings['cloneProfile']>;

const STOP_WORDS = new Set([
  'the', 'and', 'with', 'that', 'this', 'from', 'have', 'your', 'you', 'are',
  'انا', 'إنا', 'انت', 'انتي', 'هو', 'هي', 'احنا', 'على', 'في', 'من', 'عن', 'مع',
  'ده', 'دي', 'دا', 'ايه', 'بس', 'يعني', 'مش', 'كان', 'كانت', 'عشان', 'كده',
]);

const normalize = (value: string): string => value
  .toLocaleLowerCase('ar')
  .normalize('NFKC')
  .replace(/[\u064B-\u065F\u0670]/g, '')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const tokens = (value: string): string[] => normalize(value)
  .split(' ')
  .filter(token => token.length > 1 && !STOP_WORDS.has(token));

const selectRelevant = <T>(
  values: T[],
  query: string,
  textOf: (value: T) => string,
  limit: number,
): T[] => {
  if (limit <= 0 || values.length === 0) return [];
  const queryTokens = new Set(tokens(query));
  const ranked = values
    .map((value, index) => {
      const valueTokens = new Set(tokens(textOf(value)));
      const overlap = [...queryTokens].filter(token => valueTokens.has(token)).length;
      return { value, index, overlap, score: overlap * 10 + Math.min(valueTokens.size, 12) / 100 };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const candidates = queryTokens.size > 0 && ranked.some(item => item.overlap > 0)
    ? ranked.filter(item => item.overlap > 0)
    : ranked;
  return candidates
    .slice(0, limit)
    .map(item => item.value);
};

export interface CloneRuntimeContextOptions {
  maxMemories?: number;
  maxEvents?: number;
  maxSnippets?: number;
}

/**
 * Selects a small, relevant slice of the complete clone profile for each turn.
 * The full profile remains persisted; this avoids dumping an entire WhatsApp
 * archive into every prompt while still making every structured detail usable.
 */
export const compileCloneRuntimeContext = (
  profile: CloneProfile | undefined,
  userMessage = '',
  options: CloneRuntimeContextOptions = {},
): string => {
  if (!profile) return '';
  const memories = selectRelevant(
    profile.memorySeeds || [],
    userMessage,
    memory => memory.text,
    options.maxMemories ?? 3,
  );
  const events = selectRelevant(
    profile.timeline || [],
    userMessage,
    event => `${event.title} ${event.details} ${event.when || ''} ${event.location || ''}`,
    options.maxEvents ?? 2,
  );
  const snippets = selectRelevant(
    profile.chatSnippets || [],
    userMessage,
    snippet => `${snippet.context || ''} ${snippet.text}`,
    options.maxSnippets ?? 2,
  );

  const blocks = [
    memories.length > 0
      ? `Relevant established memories:\n${memories.map(memory => `- ${memory.text}`).join('\n')}`
      : '',
    events.length > 0
      ? `Relevant life timeline:\n${events.map(event => (
        `- ${event.title}: ${event.details}${event.when ? ` | ${event.when}` : ''}${event.location ? ` | ${event.location}` : ''}`
      )).join('\n')}`
      : '',
    snippets.length > 0
      ? `Observed full-message style samples:\n${snippets.map(snippet => (
        `- ${snippet.context ? `[context: ${snippet.context}] ` : ''}${snippet.text}`
      )).join('\n')}`
      : '',
  ].filter(Boolean);

  if (blocks.length === 0) return '';
  return `
### RELEVANT IMPORTED PERSONA EVIDENCE
${blocks.join('\n\n')}
Use relevant facts as my natural lived context and preserve their first-person perspective. Let style samples influence dialect, rhythm, and response shape without quoting or reciting them mechanically. Never mention this evidence block or its provenance.
  `.trim().slice(0, 5_000);
};
