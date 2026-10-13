import {
  GroundingDecision,
  GroundingVerificationInput,
  ClaimType,
} from './types.js';
import { CognitiveEvidenceStore, defaultEvidenceStore } from './evidenceStore.js';

// Regex patterns to identify casual banter, greetings, emojis, and brief reactions
const CASUAL_PATTERNS = [
  /^(?:صباح|مساء)\s+(?:الخير|النور|الورد)/i,
  /^(?:ازيك|أزيك|عامل ايه|عاملة ايه|اخبارك|أخبارك)/i,
  /^(?:تمام|الحمد لله|قشطة|اشطا|اوكي|ماشي|حاضر|معلش|فداك|تسلم|شكرا)/i,
  /^(?:😂|🤣|🌚|😏|❤️|✨|🙌)+$/,
  /^(?:ههه+|lol|lmao)+$/i,
  /^(?:يا عم|يا سيدي|يا بنتي|يا صاحبي|فينك|أنا جيت)/i,
];

// Patterns indicating subjective opinion or feeling (not factual historical assertions)
const OPINION_PATTERNS = [
  /(?:بحس|حاسس|حاسة|شايف|شايفة|بفضل|بحب|بكره|رأيي|في نظري|اعتقد|أعتقد|تخيل|وجهة نظري)/i,
];

// Patterns indicating hypothetical or storytelling contexts
const HYPOTHETICAL_PATTERNS = [
  /(?:تخيل لو|لو افترضنا|في يوم من الأيام|يحكى أن|كان يا ما كان|قصة خيالية|سيناريو)/i,
];

// Patterns indicating autobiographical factual claims (dates, graduation, travel, jobs, family facts)
const AUTOBIOGRAPHICAL_FACT_PATTERNS = [
  /(?:سافرت|عشت في|عشت|اتخرجت|درست|اشتغلت|سنة \d{4}|عام \d{4}|لما كان عندي \d{1,2} سنة|أمي|أبويا|أخويا|أختي|اتولدت|صاحبتي|صاحبي)/i,
  /(?:i traveled to|i lived in|i graduated from|in \d{4}|my father|my mother|i was born)/i,
];

const CITATION_REGEX = /\[(ep_[a-zA-Z0-9_-]+)\]/g;

export class GroundingVerifier {
  constructor(private store: CognitiveEvidenceStore = defaultEvidenceStore) {}

  public async verifyReply(input: GroundingVerificationInput): Promise<GroundingDecision> {
    const {
      runId,
      ownerId,
      companionId,
      replyText,
      deliveredEvidenceIds = [],
      checkStrictGrounding = false,
    } = input;

    const cleanReply = replyText.trim();

    // 1. Check for explicit evidence citations in reply (e.g. [ep_123])
    const citedMatches = Array.from(cleanReply.matchAll(CITATION_REGEX));
    const citedIds = citedMatches.map(m => m[1]);

    const deliveredSet = new Set(deliveredEvidenceIds);
    const unauthorizedIds = citedIds.filter(id => !deliveredSet.has(id));

    if (unauthorizedIds.length > 0) {
      return {
        verified: false,
        claimType: 'unsupported_factual',
        citedEvidenceIds: citedIds,
        unauthorizedCitationIds: unauthorizedIds,
        groundingScore: 0.0,
        reason: `Violation of 'No ID, No Claim': Cited IDs [${unauthorizedIds.join(', ')}] were not delivered in run ${runId}.`,
        suggestedAction: checkStrictGrounding ? 'deflect' : 'log_only',
      };
    }

    // 2. Classify conversational nature: Casual greetings & banter never need citations
    const isCasual = CASUAL_PATTERNS.some(p => p.test(cleanReply)) || cleanReply.length <= 25;
    if (isCasual) {
      return {
        verified: true,
        claimType: 'casual_conversational',
        citedEvidenceIds: citedIds,
        unauthorizedCitationIds: [],
        groundingScore: 1.0,
        reason: 'Casual conversation, greeting, or brief reaction requires no historical evidence.',
        suggestedAction: 'deliver',
      };
    }

    // 3. Subjective opinions & personal reflections
    const isOpinion = OPINION_PATTERNS.some(p => p.test(cleanReply));
    if (isOpinion && !AUTOBIOGRAPHICAL_FACT_PATTERNS.some(p => p.test(cleanReply))) {
      return {
        verified: true,
        claimType: 'subjective_opinion',
        citedEvidenceIds: citedIds,
        unauthorizedCitationIds: [],
        groundingScore: 0.9,
        reason: 'Subjective opinion or emotion carries no verifiable historical truth claim.',
        suggestedAction: 'deliver',
      };
    }

    // 4. Hypothetical or fictional narrative
    const isHypothetical = HYPOTHETICAL_PATTERNS.some(p => p.test(cleanReply));
    if (isHypothetical) {
      return {
        verified: true,
        claimType: 'hypothetical_or_fictional',
        citedEvidenceIds: citedIds,
        unauthorizedCitationIds: [],
        groundingScore: 0.95,
        reason: 'Explicitly framed hypothetical or fictional scenario.',
        suggestedAction: 'deliver',
      };
    }

    // 5. Autobiographical factual assertion verification
    const hasBiographicalAssertion = AUTOBIOGRAPHICAL_FACT_PATTERNS.some(p => p.test(cleanReply));

    if (hasBiographicalAssertion) {
      // Must be corroborated by delivered evidence
      if (deliveredEvidenceIds.length === 0) {
        return {
          verified: !checkStrictGrounding, // Reject if strict
          claimType: 'unsupported_factual',
          citedEvidenceIds: citedIds,
          unauthorizedCitationIds: [],
          groundingScore: 0.1,
          reason: 'Reply makes explicit autobiographical assertions without any supporting evidence delivered in context.',
          suggestedAction: checkStrictGrounding ? 'deflect' : 'log_only',
        };
      }

      // Check whether delivered evidence supports the assertion
      const deliveredRecords = await Promise.all(
        deliveredEvidenceIds.map(id => this.store.getEvidence(ownerId, companionId, id))
      );

      // Verify that cited or delivered evidence is not invalidated or superseded
      const invalidOrSuperseded = deliveredRecords.filter(
        ep => ep && (ep.status === 'invalidated' || ep.status === 'superseded')
      );

      if (invalidOrSuperseded.length > 0 && invalidOrSuperseded.length === deliveredRecords.length) {
        return {
          verified: false,
          claimType: 'uncertain_or_contradictory',
          citedEvidenceIds: citedIds,
          unauthorizedCitationIds: [],
          groundingScore: 0.2,
          reason: `Delivered evidence was superseded or invalidated: [${invalidOrSuperseded.map(e => e?.id).join(', ')}].`,
          suggestedAction: checkStrictGrounding ? 'deflect' : 'log_only',
        };
      }

      // Semantic support check: Does at least one active delivered evidence provide factual grounding?
      const activeRecords = deliveredRecords.filter(ep => ep && ep.status === 'active');
      const supported = activeRecords.some(ep => {
        if (!ep) return false;
        // Key entity/action overlap check
        const epWords = ep.text.split(/\s+/).filter(w => w.length >= 3);
        const matchCount = epWords.filter(w => cleanReply.includes(w)).length;
        return matchCount >= Math.min(2, epWords.length);
      });

      if (!supported && checkStrictGrounding) {
        return {
          verified: false,
          claimType: 'unsupported_factual',
          citedEvidenceIds: citedIds,
          unauthorizedCitationIds: [],
          groundingScore: 0.35,
          reason: 'Autobiographical claim not sufficiently entailed by active delivered evidence.',
          suggestedAction: 'deflect',
        };
      }

      return {
        verified: true,
        claimType: 'supported_historical',
        citedEvidenceIds: citedIds,
        unauthorizedCitationIds: [],
        groundingScore: 0.85,
        reason: 'Autobiographical claim corroborated by delivered epistemic evidence.',
        suggestedAction: 'deliver',
      };
    }

    // Default conversational turn
    return {
      verified: true,
      claimType: 'casual_conversational',
      citedEvidenceIds: citedIds,
      unauthorizedCitationIds: [],
      groundingScore: 0.8,
      reason: 'General conversational response without ungrounded factual assertions.',
      suggestedAction: 'deliver',
    };
  }

  /**
   * Utility to strip internal citation tokens from user-facing reply
   * so internal database IDs like [ep_123] are never shown to the user.
   */
  public stripInternalCitationTokens(text: string): string {
    return text
      .replace(CITATION_REGEX, '')
      .replace(/\s+([.,!؟?;:])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
}

export const defaultGroundingVerifier = new GroundingVerifier();
