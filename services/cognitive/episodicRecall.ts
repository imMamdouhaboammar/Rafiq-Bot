import { EpistemicEvidence } from './types.js';
import { CognitiveEvidenceStore, defaultEvidenceStore } from './evidenceStore.js';

export interface ScoredEvidence {
  evidence: EpistemicEvidence;
  score: number;
}

const normalizeArabic = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove Arabic diacritics (tashkeel)
    .replace(/[أإآء]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const STOP_WORDS = new Set([
  'في', 'من', 'على', 'إلى', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'تلك', 'التي', 'الذي',
  'ان', 'أن', 'هو', 'هي', 'هم', 'نحن', 'انا', 'أنا', 'انت', 'أنت', 'كان', 'كانت',
  'ما', 'لا', 'لم', 'لن', 'لو', 'يا', 'ده', 'دي', 'كده', 'علشان', 'عشان', 'بس',
  'the', 'is', 'at', 'which', 'on', 'in', 'a', 'an', 'and', 'or', 'to', 'for', 'of',
]);

export function stemArabicWord(word: string): string {
  let stem = word;
  // Strip leading prefixes: بال, كال, فال, ول
  if (stem.length > 4 && (stem.startsWith('بال') || stem.startsWith('كال') || stem.startsWith('فال') || stem.startsWith('ول'))) {
    stem = stem.slice(3);
  } else if (stem.length > 4 && (stem.startsWith('وال') || stem.startsWith('فال'))) {
    stem = stem.slice(3);
  } else if (stem.length > 3 && stem.startsWith('ال')) {
    stem = stem.slice(2);
  } else if (stem.length > 3 && (stem.startsWith('و') || stem.startsWith('ف') || stem.startsWith('ب') || stem.startsWith('ل'))) {
    stem = stem.slice(1);
  }

  // Strip common trailing suffixes: ها, هم, نا, كم, ات, ين, ون, ي, ك
  if (stem.length > 4 && (stem.endsWith('ها') || stem.endsWith('هم') || stem.endsWith('نا') || stem.endsWith('كم') || stem.endsWith('ات') || stem.endsWith('ين') || stem.endsWith('ون'))) {
    stem = stem.slice(0, -2);
  } else if (stem.length > 4 && (stem.endsWith('ي') || stem.endsWith('ك') || stem.endsWith('ه'))) {
    stem = stem.slice(0, -1);
  }

  return stem;
}

export function tokenizeQuery(query: string): string[] {
  const normalized = normalizeArabic(query);
  const words = normalized
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length >= 2 && !STOP_WORDS.has(w));

  const tokens = new Set<string>();
  for (const w of words) {
    tokens.add(w);
    const stem = stemArabicWord(w);
    if (stem.length >= 2 && !STOP_WORDS.has(stem)) {
      tokens.add(stem);
    }
  }
  return Array.from(tokens);
}

export class EpisodicRecallEngine {
  constructor(private store: CognitiveEvidenceStore = defaultEvidenceStore) {}

  public async recallCandidates(
    ownerId: string,
    companionId: string,
    query: string,
    limit: number = 5
  ): Promise<ScoredEvidence[]> {
    if (!ownerId?.trim() || !companionId?.trim()) {
      throw new Error(`Security Violation: ownerId and companionId are required for recall.`);
    }

    // 1. Fetch ONLY active evidence for THIS exact owner and companion
    const allActive = await this.store.listActiveEvidence(ownerId, companionId);
    if (!allActive.length) {
      return [];
    }

    const tokens = tokenizeQuery(query);

    // 2. If no meaningful tokens, return top-tier core axioms for this companion
    if (tokens.length === 0) {
      const coreAxioms = allActive
        .filter(ep => ep.group === 'core_identity' || ep.kind === 'axiom')
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, limit);

      return coreAxioms.map(ep => ({
        evidence: ep,
        score: ep.confidence * 0.5,
      }));
    }

    // 3. Compute lexical relevance with length normalization & confidence weighting
    const scored: ScoredEvidence[] = [];

    for (const ep of allActive) {
      const normText = normalizeArabic(ep.text);
      const epTokens = normText.split(/\s+/).filter(w => w.length >= 2);
      if (epTokens.length === 0) continue;
      const epStems = new Set<string>(epTokens);
      for (const w of epTokens) {
        epStems.add(stemArabicWord(w));
      }

      let matchCount = 0;
      for (const t of tokens) {
        if (normText.includes(t) || epStems.has(t)) {
          matchCount++;
        }
      }

      if (matchCount > 0) {
        // BM25-like ratio + confidence boost + tier weight
        const overlapRatio = matchCount / Math.max(tokens.length, 1);
        const tierMultiplier = ep.tier === 'A' ? 1.2 : ep.tier === 'B' ? 1.0 : 0.8;
        const finalScore = (overlapRatio * 0.7 + ep.confidence * 0.3) * tierMultiplier;

        scored.push({
          evidence: ep,
          score: Math.min(1.0, finalScore),
        });
      }
    }

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    if (scored.length > 0) {
      return scored.slice(0, limit);
    }

    // 4. Strict isolation fallback: If query has zero lexical hits, do NOT return random unrelated historical facts!
    // Return at most 2 high-confidence foundational identity axioms if available
    const foundational = allActive
      .filter(ep => ep.tier === 'A' && (ep.group === 'core_identity' || ep.kind === 'axiom'))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, Math.min(2, limit));

    return foundational.map(ep => ({
      evidence: ep,
      score: ep.confidence * 0.3,
    }));
  }
}

export const defaultEpisodicRecall = new EpisodicRecallEngine();
