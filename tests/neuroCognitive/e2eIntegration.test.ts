import assert from 'node:assert/strict';
import {
  createInitialAffectState,
  applyAffectEvent,
  classifyUserAffectTurn,
  deriveAffectStyleInstruction,
} from '../../services/syntheticAffect.js';
import {
  extractFactsFromMessage,
  reconcileAndSaveFact,
} from '../../services/memoryLifecycle.js';
import {
  recordReflection,
  compileReflectionContext,
  exportReflectionsForUser,
  deleteReflection,
} from '../../services/reflectionJournal.js';
import {
  updateWorkingMemorySnapshot,
  retrieveSmartMemory,
} from '../../services/smartRetrieval.js';
import {
  authorizeMemoryBridge,
  revokeMemoryBridge,
  readBridgedMemories,
} from '../../services/companionBridge.js';
import * as NeuroDB from '../../services/neuroDb.js';
import type { ChatSession } from '../../types.js';

console.log('🚀 Running Comprehensive Neuro-Cognitive System E2E Integration Suite...');

const companionAId = 'amira-chat-101';
const companionBId = 'kimo-chat-202';

// ----------------------------------------------------
// 1. SELECTIVE EXTRACTION & PROVENANCE
// ----------------------------------------------------
console.log('🧪 Testing: Selective Extraction & Source Provenance');
const greetingTurn = 'صباح الخير عامل ايه النهاردة؟';
const extractedGreeting = extractFactsFromMessage(greetingTurn);
assert.equal(extractedGreeting.length, 0, 'Greetings must yield 0 durable facts');

const substantiveTurn = 'أنا ساكن في الشيخ زايد وبشتغل مهندس ذكاء اصطناعي وبحب القهوة التركي';
const extractedSubstantive = extractFactsFromMessage(substantiveTurn);
assert.ok(extractedSubstantive.length >= 2, 'Must extract residence and profession');

for (const proposal of extractedSubstantive) {
  const { fact, action } = await reconcileAndSaveFact(companionAId, proposal, 'evt-msg-101');
  assert.equal(action, 'created');
  assert.equal(fact.version, 1);
  assert.equal(fact.status, 'active');
  assert.ok(fact.sourceEventIds.includes('evt-msg-101'));
}

// ----------------------------------------------------
// 2. CONFLICT RESOLUTION & RECONCILIATION
// ----------------------------------------------------
console.log('🧪 Testing: Conflict Resolution & Belief Correction');
// User moves to Riyadh
const correctionProposal = {
  subjectId: 'user',
  predicate: 'residence_city',
  objectValue: 'الرياض',
  polarity: 'positive' as const,
  certainty: 'explicit' as const,
  confidence: 0.95,
};
const { fact: updatedFact, action: supersedeAction } = await reconcileAndSaveFact(
  companionAId,
  correctionProposal,
  'evt-msg-102',
);
assert.equal(supersedeAction, 'superseded');
assert.equal(updatedFact.version, 2);
assert.equal(updatedFact.objectValue, 'الرياض');

const activeFactsAfterCorrection = await NeuroDB.getMemoryFacts(companionAId, { status: 'active' });
const residenceFact = activeFactsAfterCorrection.find(f => f.predicate === 'residence_city');
assert.equal(residenceFact?.objectValue, 'الرياض');
assert.equal(residenceFact?.version, 2);

// ----------------------------------------------------
// 3. DETERMINISTIC SYNTHETIC AFFECT STATE MACHINE
// ----------------------------------------------------
console.log('🧪 Testing: Deterministic Synthetic Affect State Machine');
let affect = createInitialAffectState(companionAId);
assert.equal(affect.valence, 0.25);
assert.equal(affect.tension, 0.05);

// User shows warmth
const warmEvent = classifyUserAffectTurn('شكرا جدا يا أميرة، ربنا يخليكي يا غالية');
assert.ok(warmEvent);
affect = applyAffectEvent(affect, warmEvent);
assert.ok(affect.valence > 0.25, 'Valence must increase on warmth');
assert.ok(affect.security > 0.70, 'Security must increase on warmth');

const warmPromptInstruction = deriveAffectStyleInstruction(affect);
assert.ok(warmPromptInstruction.includes('المزاج العام لطيف ودافي') || warmPromptInstruction.includes('الألفة'));
assert.ok(!warmPromptInstruction.includes('وعي') && !warmPromptInstruction.includes('ألم بيولوجي'));

// User experiences external distress
const distressEvent = classifyUserAffectTurn('أنا مخنوق أوي من ضغط الشغل والمدير');
assert.ok(distressEvent);
assert.equal(distressEvent.userAddressedToBot, false);
affect = applyAffectEvent(affect, distressEvent);
assert.ok(affect.arousal > 0.40, 'Arousal must rise to pay attention');

// ----------------------------------------------------
// 4. PRIVATE REFLECTION JOURNAL
// ----------------------------------------------------
console.log('🧪 Testing: Private Reflection Journal & User Privacy Controls');
const reflection = await recordReflection(companionAId, {
  topic: 'طريقة التعامل مع ضغط العمل',
  hypothesis: 'المستخدم يحتاج إلى دعم معنوي هادئ وليس نصائح تقنية سريعة حالياً',
  openQuestion: 'هل يفضل الحديث عن تفاصيل العمل أم تغيير الموضوع؟',
  confidence: 0.85,
});
assert.equal(reflection.topic, 'طريقة التعامل مع ضغط العمل');
assert.equal(reflection.status, 'active');

const activeReflections = await NeuroDB.getActiveReflections(companionAId);
const reflectionContext = compileReflectionContext(activeReflections);
assert.ok(reflectionContext);
assert.ok(reflectionContext.includes('طريقة التعامل مع ضغط العمل'));

// User inspection
const userView = await exportReflectionsForUser(companionAId);
assert.ok(userView.length >= 1);

// User deletes reflection
await deleteReflection(reflection.id);
const userViewAfterDelete = await exportReflectionsForUser(companionAId);
assert.ok(!userViewAfterDelete.some(r => r.id === reflection.id), 'Deleted reflection must disappear');

// ----------------------------------------------------
// 5. SMART NON-BLOCKING RETRIEVAL (TIER 0 & TIER 1)
// ----------------------------------------------------
console.log('🧪 Testing: Smart Non-Blocking Multi-Tier Retrieval');
updateWorkingMemorySnapshot(companionAId, activeFactsAfterCorrection);

const retrieval = await retrieveSmartMemory(companionAId, 'أنا رايح مشوار في الرياض');
assert.equal(retrieval.tierUsed, 'tier1_lexical');
assert.ok(retrieval.facts.some(f => f.objectValue === 'الرياض'));
assert.ok(retrieval.formattedContext?.includes('الرياض'));

// ----------------------------------------------------
// 6. CROSS-COMPANION MEMORY BRIDGE
// ----------------------------------------------------
console.log('🧪 Testing: Cross-Companion Memory Bridge (Grant Authorization & Revocation)');
// Initially, Companion B has NO access to Companion A's memories
const unauthorizedRead = await readBridgedMemories(companionBId, companionAId, ['الرياض']);
assert.equal(unauthorizedRead, null, 'No read allowed without explicit grant');

// User authorizes grant: Companion A -> Companion B
const grant = await authorizeMemoryBridge('main_user', companionAId, companionBId);
assert.equal(grant.sourceCompanionId, companionAId);
assert.equal(grant.targetCompanionId, companionBId);

// Now Companion B CAN read authorized facts
const authorizedRead = await readBridgedMemories(companionBId, companionAId, ['الرياض']);
assert.ok(authorizedRead, 'Must succeed when grant is active');
assert.ok(authorizedRead.formattedContext?.includes('الرياض'));
assert.ok(authorizedRead.formattedContext?.includes('ذاكرة مشتركة من رفيق آخر'));

// Reverse read (Companion A reading Companion B) must still be blocked (One-way)
const reverseRead = await readBridgedMemories(companionAId, companionBId, ['الرياض']);
assert.equal(reverseRead, null, 'Reverse access must remain blocked');

// User revokes the grant
await revokeMemoryBridge(grant.grantId, companionAId, companionBId);
const readAfterRevoke = await readBridgedMemories(companionBId, companionAId, ['الرياض']);
assert.equal(readAfterRevoke, null, 'Must immediately block access once revoked');

console.log('✅ ALL NEURO-COGNITIVE SYSTEM E2E INTEGRATION TESTS PASSED PERFECTLY!');
