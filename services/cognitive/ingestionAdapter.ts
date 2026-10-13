import {
  IngestionInput,
  IngestionResult,
  EpistemicEvidence,
  LifeMilestone,
} from './types.js';

// PII Regex Patterns
const PHONE_PATTERNS = [
  /\+20\s*(?:1[0125]\d{8}|\d{9,10})/g,
  /\b01[0125]\d{8}\b/g,
  /\b\+?[1-9]\d{1,2}\s*[\d\s-]{7,12}\d\b/g,
];

const LOCATION_PATTERNS = [
  /(?:^|[\s،,.!?;:])(?:شارع|ش\.|عمارة|ميدان|بلوك|شقة)\s+[\p{L}\p{N}]+(?:\s+[\p{L}\p{N}]+){0,3}(?=$|[\s،,.!?;:])/giu,
  /(?:^|[\s،,.!?;:])(?:street|st\.|ave|avenue|apartment|apt\.|building)\s+[\w\s]{2,20}(?=$|[\s،,.!?;:])/gi,
  /\b\d{1,4}\s+[\w\s]{2,20}\s+(?:street|st|avenue|ave|rd|road)\b/gi,
];

const FORBIDDEN_EXPLICIT_PATTERNS = [
  /\b(?:مص|زب|طيز|كس|شرموط|سكس|نيك|دعارة)\b/giu,
  /\b(?:sexual act|explicit intercourse|erotic roleplay)\b/gi,
];

const CLINICAL_DIAGNOSIS_PATTERNS = [
  /\b(?:borderline|bpd|narcissistic|npd|bipolar|schizo|psychopathic)\b/gi,
  /\b(?:مرض نفسي|اضطراب شخصية حدية|نرجسية مرضية|فصام)\b/giu,
];

export class PiiFirewall {
  public sanitizeText(text: string): { cleanedText: string; redactionCount: number } {
    let cleaned = text;
    let count = 0;

    for (const pat of PHONE_PATTERNS) {
      const matches = cleaned.match(pat);
      if (matches) {
        count += matches.length;
        cleaned = cleaned.replace(pat, '[REDACTED_PHONE]');
      }
    }

    for (const pat of LOCATION_PATTERNS) {
      const matches = cleaned.match(pat);
      if (matches) {
        count += matches.length;
        cleaned = cleaned.replace(pat, (m) => {
          const first = m.charAt(0);
          const hasLeading = /[\s،,.!?;:]/.test(first);
          return (hasLeading ? first : '') + '[REDACTED_ADDRESS]';
        });
      }
    }

    return { cleanedText: cleaned, redactionCount: count };
  }

  public validateContent(text: string): { valid: boolean; reason?: string } {
    for (const pat of FORBIDDEN_EXPLICIT_PATTERNS) {
      if (pat.test(text)) {
        return { valid: false, reason: 'Explicit intimate content cannot be persisted into identity.' };
      }
    }

    for (const pat of CLINICAL_DIAGNOSIS_PATTERNS) {
      if (pat.test(text)) {
        return { valid: false, reason: 'Clinical diagnostic labels cannot be persisted as personality traits.' };
      }
    }

    return { valid: true };
  }
}

export class CognitiveIngestionAdapter {
  private firewall = new PiiFirewall();

  public async ingestPersona(input: IngestionInput): Promise<IngestionResult> {
    const {
      ownerId,
      companionId,
      companionName,
      rawExportText,
      targetSpeakerName = companionName,
    } = input;

    const lines = rawExportText.split(/\r?\n/).filter(line => line.trim().length > 0);
    const targetNorm = targetSpeakerName.toLowerCase();

    const parsedMessages: Array<{ sender: string; text: string; charCount: number; wordCount: number }> = [];
    let totalRedactions = 0;

    const TIMESTAMP_RE = /^\[?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?)\]?\s*(?:-|:)?\s*([^:]+):\s*(.*)$/;

    for (const line of lines) {
      const m = line.match(TIMESTAMP_RE);
      if (m) {
        const sender = m[3].trim();
        const rawBody = m[4].trim();

        // Check content validation
        const val = this.firewall.validateContent(rawBody);
        if (!val.valid) continue; // drop forbidden explicit content

        const { cleanedText, redactionCount } = this.firewall.sanitizeText(rawBody);
        totalRedactions += redactionCount;

        parsedMessages.push({
          sender,
          text: cleanedText,
          charCount: cleanedText.length,
          wordCount: cleanedText.split(/\s+/).filter(Boolean).length,
        });
      }
    }

    // Filter target companion messages
    const targetMsgs = parsedMessages.filter(m => m.sender.toLowerCase().includes(targetNorm));
    const charCounts = targetMsgs.map(m => m.charCount).filter(c => c > 0);
    const wordCounts = targetMsgs.map(m => m.wordCount).filter(w => w > 0);

    const median = (arr: number[]) => {
      if (!arr.length) return 0;
      const s = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(s.length / 2);
      return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    };

    const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

    // Compute bursts (consecutive messages from same sender)
    const bursts: number[] = [];
    let currentBurstSize = 0;
    let lastSender = '';

    for (const m of parsedMessages) {
      if (m.sender.toLowerCase().includes(targetNorm)) {
        if (lastSender.toLowerCase().includes(targetNorm)) {
          currentBurstSize++;
        } else {
          if (currentBurstSize > 0) bursts.push(currentBurstSize);
          currentBurstSize = 1;
        }
      } else {
        if (currentBurstSize > 0) {
          bursts.push(currentBurstSize);
          currentBurstSize = 0;
        }
      }
      lastSender = m.sender;
    }
    if (currentBurstSize > 0) bursts.push(currentBurstSize);

    const multiBurstRatio = bursts.length ? bursts.filter(b => b > 1).length / bursts.length : 0;

    // Extract initial seed epistemic evidence
    const extractedFacts: EpistemicEvidence[] = [];
    const nowIso = new Date().toISOString();

    // 1. Initial canonical style axiom
    extractedFacts.push({
      id: `ep_style_${companionId}_cadence`,
      ownerId,
      companionId,
      kind: 'heuristic',
      group: 'communication',
      vector: 'rhythm',
      text: `${companionName} prefers messages of median length ${median(charCounts)} chars with natural burst splitting.`,
      tier: 'A',
      confidence: 0.95,
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    // 2. Select top characteristic non-trivial statements as candidate memories
    const substantive = targetMsgs
      .filter(m => m.charCount >= 25 && m.charCount <= 200)
      .slice(0, 10);

    for (let i = 0; i < substantive.length; i++) {
      extractedFacts.push({
        id: `ep_ingest_${companionId}_${i + 1}`,
        ownerId,
        companionId,
        kind: 'anecdote',
        group: 'history',
        vector: 'observed_chat',
        text: substantive[i].text,
        tier: 'B',
        confidence: 0.85,
        status: 'active',
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }

    return {
      companionId,
      totalMessagesParsed: parsedMessages.length,
      targetMessagesCount: targetMsgs.length,
      redactedPiiCount: totalRedactions,
      cadenceMetrics: {
        medianTextChars: Math.round(median(charCounts)),
        meanTextChars: Math.round(mean(charCounts) * 10) / 10,
        medianWords: Math.round(median(wordCounts)),
        consecutiveBurstMedian: Math.round(median(bursts)),
        multiBubbleBurstRatio: Math.round(multiBurstRatio * 100) / 100,
      },
      extractedFacts,
      extractedMilestones: [],
    };
  }
}

export const defaultIngestionAdapter = new CognitiveIngestionAdapter();
