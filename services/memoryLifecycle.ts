import {
  type MemoryFact,
  type MemoryRelation,
  type FactPolarity,
  type FactCertainty,
  MemoryFactSchema,
} from '../contracts/neuroCognitive.js';
import * as NeuroDB from './neuroDb.js';

const GREETING_OR_FILLER_REGEX = /^(أه|اه|ايوة|لا|تمام|ماشي|صباح الخير|مساء الخير|سلام|ازيك|عامل ايه|شكرا|اوكي|ok|bye|hi|hello|thanks|كويس|الحمد لله)$/i;

export interface ExtractedFactProposal {
  subjectId: string;
  predicate: string;
  objectValue: string;
  polarity: FactPolarity;
  certainty: FactCertainty;
  confidence: number;
  isRetraction?: boolean;
}

/**
 * Filter out low-information chatter so greetings don't pollute memory facts.
 */
export const shouldEvaluateForMemory = (text: string): boolean => {
  const clean = text.trim();
  if (clean.length < 5) return false;
  if (GREETING_OR_FILLER_REGEX.test(clean)) return false;
  return true;
};

/**
 * Deterministic heuristic extractor for high-frequency patterns in Egyptian Arabic,
 * combined with structured extraction.
 */
export const extractFactsFromMessage = (
  text: string,
): ExtractedFactProposal[] => {
  if (!shouldEvaluateForMemory(text)) return [];

  const proposals: ExtractedFactProposal[] = [];
  const clean = text.trim().toLowerCase();

  // 1. Explicit preference correction: "كنت بحب X بس دلوقتي بقيت بحب Y"
  const changePrefMatch = clean.match(/كنت\s+بحب\s+([^،\n.]+)\s+بس\s+(?:دلوقتي|حاليا)\s+(?:بقيت\s+)?بحب\s+([^،\n.]+)/i);
  if (changePrefMatch) {
    proposals.push({
      subjectId: 'user',
      predicate: 'likes_food_or_thing',
      objectValue: changePrefMatch[2].trim(),
      polarity: 'positive',
      certainty: 'explicit',
      confidence: 0.95,
    });
    return proposals;
  }

  // 2. Direct retraction: "أنا مكنتش ساكن في X، كنت بهزر" / "مكنتش عايش في X"
  const retractCityMatch = clean.match(/م(?:ا)?كنتش\s+(?:ساكن|عايش)\s+في\s+([^،\n.]+)/i);
  if (retractCityMatch) {
    proposals.push({
      subjectId: 'user',
      predicate: 'residence_city',
      objectValue: retractCityMatch[1].trim(),
      polarity: 'negative',
      certainty: 'explicit',
      confidence: 0.95,
      isRetraction: true,
    });
    return proposals;
  }

  // 3. Location / Residence: "أنا ساكن في X" / "اتنقلت لـ X" / "عايز في X"
  const residenceMatch = clean.match(/(?:أنا\s+|انا\s+)?(?:ساكن|عايش|اتنقلت|سكنت)\s+في\s+([^،\n.\s]+(?:\s+[^،\n.\s]+)?)(?=\s+(?:و|شغال|بشتغل|وظيفتي)|[،\n.]|$)/i);
  if (residenceMatch) {
    proposals.push({
      subjectId: 'user',
      predicate: 'residence_city',
      objectValue: residenceMatch[1].trim(),
      polarity: 'positive',
      certainty: 'explicit',
      confidence: 0.9,
    });
  }

  // 4. Profession / Work: "أنا شغال X" / "بشتغل في X" / "وظيفتي X"
  const workMatch = clean.match(/(?:أنا\s+|انا\s+)?(?:شغال|بشتغل|وظيفتي)\s+(?:في\s+|كـ\s*)?([^،\n.]+(?=\s+(?:و|ساكن|عايش)|[،\n.]|$))/i);
  if (workMatch) {
    proposals.push({
      subjectId: 'user',
      predicate: 'profession_or_workplace',
      objectValue: workMatch[1].trim(),
      polarity: 'positive',
      certainty: 'explicit',
      confidence: 0.9,
    });
  }

  // 5. Positive preferences: "أنا بحب X جدا" / "مفضل عندي X"
  const likeMatch = clean.match(/(?:أنا\s+|انا\s+)?بحب\s+([^،\n.]+)(?:\s+جدا|\s+أوي)?/i);
  if (likeMatch && !clean.includes('كنت')) {
    proposals.push({
      subjectId: 'user',
      predicate: 'likes_food_or_thing',
      objectValue: likeMatch[1].trim(),
      polarity: 'positive',
      certainty: 'explicit',
      confidence: 0.85,
    });
  }

  // 6. Negative preferences: "أنا بكره X" / "مبحبش X"
  const dislikeMatch = clean.match(/(?:أنا\s+|انا\s+)?(?:بكره|مبحبش|مش بحب)\s+([^،\n.]+)/i);
  if (dislikeMatch) {
    proposals.push({
      subjectId: 'user',
      predicate: 'dislikes_food_or_thing',
      objectValue: dislikeMatch[1].trim(),
      polarity: 'positive',
      certainty: 'explicit',
      confidence: 0.85,
    });
  }

  // 7. Goals / Aspirations: "نفسي في X" / "هدفي X" / "عايز اتعلم X"
  const goalMatch = clean.match(/(?:نفسي\s+في|هدفي|عايز\s+اتعلم|بحلم\s+بـ)\s+([^،\n.]+)/i);
  if (goalMatch) {
    proposals.push({
      subjectId: 'user',
      predicate: 'personal_goal',
      objectValue: goalMatch[1].trim(),
      polarity: 'positive',
      certainty: 'explicit',
      confidence: 0.8,
    });
  }

  return proposals;
};

export interface MemoryLifecycleDB {
  findActiveFactByPredicate: typeof NeuroDB.findActiveFactByPredicate;
  saveMemoryFact: typeof NeuroDB.saveMemoryFact;
  supersedeMemoryFact: typeof NeuroDB.supersedeMemoryFact;
  retractMemoryFact: typeof NeuroDB.retractMemoryFact;
}

export const defaultLifecycleDB: MemoryLifecycleDB = {
  findActiveFactByPredicate: NeuroDB.findActiveFactByPredicate,
  saveMemoryFact: NeuroDB.saveMemoryFact,
  supersedeMemoryFact: NeuroDB.supersedeMemoryFact,
  retractMemoryFact: NeuroDB.retractMemoryFact,
};

/**
 * Lifecycle Pipeline: Ingests an extracted proposal, checks for existing facts,
 * handles conflict resolution, and persists the new/superseded version.
 */
export const reconcileAndSaveFact = async (
  companionId: string,
  proposal: ExtractedFactProposal,
  sourceEventId: string,
  now = new Date(),
  db: MemoryLifecycleDB = defaultLifecycleDB,
): Promise<{ fact: MemoryFact; action: 'created' | 'superseded' | 'retracted' | 'unchanged' }> => {
  // Find existing active fact for same subject & predicate
  const existingFact = await db.findActiveFactByPredicate(
    companionId,
    proposal.subjectId,
    proposal.predicate,
  );

  // Case 1: Retraction of an existing fact
  if (proposal.isRetraction) {
    if (existingFact) {
      await db.retractMemoryFact(existingFact.id);
      return { fact: existingFact, action: 'retracted' };
    }
    return {
      fact: {
        id: `fact_${Date.now()}_retracted`,
        ownerId: 'main_user',
        companionId,
        subjectId: proposal.subjectId,
        predicate: proposal.predicate,
        objectValue: proposal.objectValue,
        polarity: proposal.polarity,
        certainty: proposal.certainty,
        confidence: proposal.confidence,
        sensitivity: 'normal',
        sourceEventIds: [sourceEventId],
        observedAt: now,
        status: 'retracted',
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
      action: 'retracted',
    };
  }

  // Case 2: Fact is identical to what we already know
  if (
    existingFact &&
    existingFact.objectValue.toLowerCase() === proposal.objectValue.toLowerCase() &&
    existingFact.polarity === proposal.polarity
  ) {
    // Just reinforce source evidence
    if (!existingFact.sourceEventIds.includes(sourceEventId)) {
      const reinforced: MemoryFact = {
        ...existingFact,
        sourceEventIds: [...existingFact.sourceEventIds, sourceEventId],
        confidence: Math.min(1.0, existingFact.confidence + 0.05),
        updatedAt: now,
      };
      await db.saveMemoryFact(reinforced);
      return { fact: reinforced, action: 'unchanged' };
    }
    return { fact: existingFact, action: 'unchanged' };
  }

  // Case 3: Contradiction / Evolution of an existing fact -> Supersede!
  if (existingFact) {
    const newFactId = `fact_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newFact: MemoryFact = MemoryFactSchema.parse({
      id: newFactId,
      ownerId: 'main_user',
      companionId,
      subjectId: proposal.subjectId,
      predicate: proposal.predicate,
      objectValue: proposal.objectValue,
      polarity: proposal.polarity,
      certainty: proposal.certainty,
      confidence: proposal.confidence,
      sensitivity: 'normal',
      sourceEventIds: [sourceEventId],
      observedAt: now,
      validFrom: now,
      supersedesId: existingFact.id,
      status: 'active',
      version: existingFact.version + 1,
      createdAt: now,
      updatedAt: now,
    });

    await db.supersedeMemoryFact(existingFact.id, newFact);
    return { fact: newFact, action: 'superseded' };
  }

  // Case 4: Brand new fact
  const newFactId = `fact_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const newFact: MemoryFact = MemoryFactSchema.parse({
    id: newFactId,
    ownerId: 'main_user',
    companionId,
    subjectId: proposal.subjectId,
    predicate: proposal.predicate,
    objectValue: proposal.objectValue,
    polarity: proposal.polarity,
    certainty: proposal.certainty,
    confidence: proposal.confidence,
    sensitivity: 'normal',
    sourceEventIds: [sourceEventId],
    observedAt: now,
    validFrom: now,
    status: 'active',
    version: 1,
    createdAt: now,
    updatedAt: now,
  });

  await db.saveMemoryFact(newFact);
  return { fact: newFact, action: 'created' };
};
