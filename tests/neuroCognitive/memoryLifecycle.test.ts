import assert from 'node:assert/strict';
import {
  shouldEvaluateForMemory,
  extractFactsFromMessage,
  reconcileAndSaveFact,
  type MemoryLifecycleDB,
} from '../../services/memoryLifecycle.js';

// 1. Selective Retention: repetitive greetings should NOT create facts
assert.equal(shouldEvaluateForMemory('صباح الخير'), false);
assert.equal(shouldEvaluateForMemory('تمام'), false);
assert.equal(shouldEvaluateForMemory('ok'), false);
assert.equal(extractFactsFromMessage('صباح الخير عامل ايه').length, 0);

// 2. High-value fact extraction
const facts1 = extractFactsFromMessage('أنا ساكن في المعادي وشغال مهندس برمجيات');
assert.ok(facts1.length >= 2, 'Should extract both residence and profession');
assert.equal(facts1.find(f => f.predicate === 'residence_city')?.objectValue, 'المعادي');
assert.equal(facts1.find(f => f.predicate === 'profession_or_workplace')?.objectValue, 'مهندس برمجيات');

// 3. Create mock database
const memoryStore = new Map<string, any>();
const mockDB: MemoryLifecycleDB = {
  findActiveFactByPredicate: async (cId: string, sId: string, pred: string) => {
    return Array.from(memoryStore.values()).find(
      f => f.companionId === cId && f.subjectId === sId && f.predicate === pred && f.status === 'active'
    );
  },
  saveMemoryFact: async (fact: any) => {
    memoryStore.set(fact.id, fact);
  },
  supersedeMemoryFact: async (oldId: string, newFact: any) => {
    const old = memoryStore.get(oldId);
    if (old) old.status = 'superseded';
    memoryStore.set(newFact.id, newFact);
  },
  retractMemoryFact: async (factId: string) => {
    const f = memoryStore.get(factId);
    if (f) f.status = 'retracted';
  },
};

// Scenario A: First create initial residence fact
const initialProposal = {
  subjectId: 'user',
  predicate: 'residence_city',
  objectValue: 'القاهرة',
  polarity: 'positive' as const,
  certainty: 'explicit' as const,
  confidence: 0.9,
};
const { fact: factA, action: actionA } = await reconcileAndSaveFact('bot-1', initialProposal, 'evt-1', new Date(), mockDB);
assert.equal(actionA, 'created');
assert.equal(factA.objectValue, 'القاهرة');
assert.equal(factA.version, 1);
assert.equal(factA.status, 'active');

// Scenario B: User corrects / moves: "أنا اتنقلت وعايش في الرياض"
const updateProposal = {
  subjectId: 'user',
  predicate: 'residence_city',
  objectValue: 'الرياض',
  polarity: 'positive' as const,
  certainty: 'explicit' as const,
  confidence: 0.95,
};
const { fact: factB, action: actionB } = await reconcileAndSaveFact('bot-1', updateProposal, 'evt-2', new Date(), mockDB);
assert.equal(actionB, 'superseded');
assert.equal(factB.objectValue, 'الرياض');
assert.equal(factB.version, 2);
assert.equal(factB.supersedesId, factA.id);

// Check that old fact is preserved historically with status 'superseded'
const oldFactInStore = memoryStore.get(factA.id);
assert.equal(oldFactInStore.status, 'superseded', 'Old fact must be marked superseded, not deleted');

// Scenario C: Retraction
const retractProposal = {
  subjectId: 'user',
  predicate: 'residence_city',
  objectValue: 'الرياض',
  polarity: 'negative' as const,
  certainty: 'explicit' as const,
  confidence: 0.95,
  isRetraction: true,
};
const { action: actionC } = await reconcileAndSaveFact('bot-1', retractProposal, 'evt-3', new Date(), mockDB);
assert.equal(actionC, 'retracted');
const retractedFact = memoryStore.get(factB.id);
assert.equal(retractedFact.status, 'retracted', 'Target fact must be retracted');

console.log('✓ Memory lifecycle & self-correction tests passed successfully.');
