import type { MemoryFact } from '../contracts/neuroCognitive.js';
import * as NeuroDB from './neuroDb.js';

export interface WorkingMemorySnapshot {
  companionId: string;
  pinnedFacts: MemoryFact[];
  recentTopics: string[];
  updatedAt: Date;
}

// In-memory Tier 0 working snapshots (0ms lookup)
const workingMemorySnapshots = new Map<string, WorkingMemorySnapshot>();

export const updateWorkingMemorySnapshot = (
  companionId: string,
  pinnedFacts: MemoryFact[],
  recentTopics: string[] = [],
): void => {
  workingMemorySnapshots.set(companionId, {
    companionId,
    pinnedFacts: pinnedFacts.slice(0, 8),
    recentTopics: recentTopics.slice(0, 5),
    updatedAt: new Date(),
  });
};

export const getWorkingMemorySnapshot = (
  companionId: string,
): WorkingMemorySnapshot | undefined => {
  return workingMemorySnapshots.get(companionId);
};

export interface ScoredFact {
  fact: MemoryFact;
  score: number;
}

const tokenize = (text: string): string[] => {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1);
};

/**
 * Score a memory fact against the user query.
 * Weighted: lexical overlap + recency + confidence.
 */
export const scoreFact = (
  fact: MemoryFact,
  queryTokens: string[],
  now = new Date(),
): number => {
  if (fact.status !== 'active') return 0;

  const factTokens = tokenize(`${fact.predicate} ${fact.objectValue}`);
  if (factTokens.length === 0) return 0;

  const overlap = queryTokens.filter(t => factTokens.some(ft => ft.includes(t) || t.includes(ft))).length;
  if (overlap === 0) return 0; // No relevance to this query

  const lexicalScore = overlap / Math.max(1, queryTokens.length);

  // Recency boost (within 30 days)
  const ageDays = (now.getTime() - new Date(fact.observedAt).getTime()) / (1000 * 60 * 60 * 24);
  const recencyScore = Math.max(0, 1 - ageDays / 30);

  // Confidence weighting
  const confidenceScore = fact.confidence;

  // Composite score: 0.50 lexical + 0.30 confidence + 0.20 recency
  return lexicalScore * 0.50 + confidenceScore * 0.30 + recencyScore * 0.20;
};

export interface RetrievalResult {
  facts: MemoryFact[];
  formattedContext?: string;
  tierUsed: 'tier0_snapshot' | 'tier1_lexical';
  latencyMs: number;
}

/**
 * Non-blocking Smart Retrieval Pipeline:
 * Tries fast Tier 1 search with bounded timeout, falling back safely to Tier 0 snapshot.
 */
export const retrieveSmartMemory = async (
  companionId: string,
  userMessage: string,
  timeoutMs = 120,
  factsFetcher = () => NeuroDB.getMemoryFacts(companionId, { status: 'active' }),
): Promise<RetrievalResult> => {
  const startTime = Date.now();
  const queryTokens = tokenize(userMessage);

  // If query is very short or filler, just use Tier 0 snapshot
  if (queryTokens.length === 0) {
    const snapshot = getWorkingMemorySnapshot(companionId);
    const facts = snapshot?.pinnedFacts || [];
    return {
      facts,
      formattedContext: formatMemoryContext(facts),
      tierUsed: 'tier0_snapshot',
      latencyMs: Date.now() - startTime,
    };
  }

  try {
    // Race against timeout to ensure reply streaming is never stalled
    const fetchPromise = factsFetcher();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Retrieval timeout')), timeoutMs),
    );

    const activeFacts = await Promise.race([fetchPromise, timeoutPromise]);

    const scored: ScoredFact[] = activeFacts
      .map(fact => ({ fact, score: scoreFact(fact, queryTokens) }))
      .filter(item => item.score > 0.25)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const matchedFacts = scored.map(s => s.fact);

    return {
      facts: matchedFacts,
      formattedContext: formatMemoryContext(matchedFacts),
      tierUsed: 'tier1_lexical',
      latencyMs: Date.now() - startTime,
    };
  } catch (err) {
    // Graceful fallback to Tier 0 in-memory snapshot
    const snapshot = getWorkingMemorySnapshot(companionId);
    const fallbackFacts = snapshot?.pinnedFacts || [];
    return {
      facts: fallbackFacts,
      formattedContext: formatMemoryContext(fallbackFacts),
      tierUsed: 'tier0_snapshot',
      latencyMs: Date.now() - startTime,
    };
  }
};

/**
 * Formats retrieved facts into safe, cited prompt context.
 */
export const formatMemoryContext = (facts: MemoryFact[]): string | undefined => {
  if (facts.length === 0) return undefined;

  const lines = facts.map(f => {
    const pol = f.polarity === 'negative' ? ' (منفي)' : '';
    return `- [معلومة مؤكدة]: ${f.predicate} -> ${f.objectValue}${pol} (نسخة ${f.version})`;
  });

  return `[سياق الذاكرة المسترجعة المثبتة بالأدلة]\n${lines.join('\n')}`;
};
