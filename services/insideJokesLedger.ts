export interface InsideJoke {
  id: string;
  chatId: string;
  triggerKeywords: string[];
  punchlineOrReference: string;
  context: string;
  createdAt: string;
  timesReferenced?: number;
}

/**
 * Compiles the inside jokes context block into the prompt if relevant jokes exist.
 */
export function compileInsideJokesPrompt(
  jokes: InsideJoke[],
  recentText?: string,
): string {
  if (!jokes || jokes.length === 0) return '';

  // If recentText is given, optionally prioritize jokes matching keywords
  let relevantJokes = jokes;
  if (recentText?.trim()) {
    const lower = recentText.toLowerCase();
    const matched = jokes.filter(j =>
      j.triggerKeywords.some(kw => lower.includes(kw.toLowerCase())),
    );
    if (matched.length > 0) {
      relevantJokes = matched;
    }
  }

  // Cap at top 4 jokes to avoid prompt bloat
  const topJokes = relevantJokes.slice(0, 4);

  return `
### SHARED INSIDE JOKES & RUNNING BANTER (دفتر الإفيهات والمواقف المشتركة)
You and the user share these organic inside jokes and shorthand references from past chats:
${topJokes.map(j => `- [إفيه/سياق]: "${j.punchlineOrReference}" (${j.context})`).join('\n')}

**Directive:**
- Reference these shared jokes casually and organically when the conversational moment invites it, as real close friends do.
- Never explain the joke, never say "فاكر لما...", and never force a reference when the topic is serious.
`.trim();
}

/**
 * In-memory ledger cache with localStorage fallback for persistence
 */
const MEMORY_JOKES_CACHE = new Map<string, InsideJoke[]>();

export function getInsideJokes(chatId: string): InsideJoke[] {
  if (MEMORY_JOKES_CACHE.has(chatId)) {
    return MEMORY_JOKES_CACHE.get(chatId)!;
  }

  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(`rafiq_jokes_${chatId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          MEMORY_JOKES_CACHE.set(chatId, parsed);
          return parsed;
        }
      }
    } catch {
      // Ignore storage errors
    }
  }

  return [];
}

export function saveInsideJoke(joke: InsideJoke): void {
  const list = getInsideJokes(joke.chatId);
  const exists = list.some(
    j => j.punchlineOrReference === joke.punchlineOrReference || j.id === joke.id,
  );
  if (exists) return;

  const updated = [joke, ...list].slice(0, 20); // Keep max 20 jokes
  MEMORY_JOKES_CACHE.set(joke.chatId, updated);

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(`rafiq_jokes_${joke.chatId}`, JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
  }
}
