import { describe, it, expect, beforeEach } from 'bun:test';
import { CognitiveEvidenceStore } from '../../services/cognitive/evidenceStore.js';
import { EpisodicRecallEngine } from '../../services/cognitive/episodicRecall.js';
import { AssociativeRecallEngine } from '../../services/cognitive/associativeRecall.js';
import { EpistemicEvidence } from '../../services/cognitive/types.js';

describe('Cognitive Core Isolation & Scoping', () => {
  let store: CognitiveEvidenceStore;
  let episodic: EpisodicRecallEngine;
  let associative: AssociativeRecallEngine;

  beforeEach(() => {
    store = new CognitiveEvidenceStore();
    episodic = new EpisodicRecallEngine(store);
    associative = new AssociativeRecallEngine(store);
  });

  it('never leaks evidence between two companions even with identical queries', async () => {
    const ownerId = 'user_alice';
    const nowIso = new Date().toISOString();

    const amiraEvidence: EpistemicEvidence = {
      id: 'ep_amira_coffee',
      ownerId,
      companionId: 'amira',
      kind: 'preference',
      group: 'preferences',
      vector: 'taste',
      text: 'بحب القهوة المظبوط جدا من زمان وبشربها كل صبح.',
      tier: 'A',
      confidence: 0.95,
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const laylaEvidence: EpistemicEvidence = {
      id: 'ep_layla_coffee',
      ownerId,
      companionId: 'layla',
      kind: 'preference',
      group: 'preferences',
      vector: 'taste',
      text: 'مبحبش القهوة خالص وبفضل الشاي الأخضر.',
      tier: 'A',
      confidence: 0.95,
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await store.insertEvidence(amiraEvidence);
    await store.insertEvidence(laylaEvidence);

    // Amira queries coffee
    const amiraRecalled = await episodic.recallCandidates(ownerId, 'amira', 'بتحبي القهوة ازاي؟');
    expect(amiraRecalled.length).toBeGreaterThan(0);
    expect(amiraRecalled.every(r => r.evidence.companionId === 'amira')).toBe(true);
    expect(amiraRecalled.some(r => r.evidence.id === 'ep_amira_coffee')).toBe(true);
    expect(amiraRecalled.some(r => r.evidence.id === 'ep_layla_coffee')).toBe(false);

    // Layla queries coffee
    const laylaRecalled = await episodic.recallCandidates(ownerId, 'layla', 'بتحبي القهوة ازاي؟');
    expect(laylaRecalled.length).toBeGreaterThan(0);
    expect(laylaRecalled.every(r => r.evidence.companionId === 'layla')).toBe(true);
    expect(laylaRecalled.some(r => r.evidence.id === 'ep_layla_coffee')).toBe(true);
    expect(laylaRecalled.some(r => r.evidence.id === 'ep_amira_coffee')).toBe(false);
  });

  it('strictly isolates memory between different users sharing same companion id', async () => {
    const companionId = 'rafiq_general';
    const nowIso = new Date().toISOString();

    const user1Fact: EpistemicEvidence = {
      id: 'ep_u1_secret',
      ownerId: 'user_1',
      companionId,
      kind: 'anecdote',
      group: 'history',
      vector: 'experience',
      text: 'سري للغاية: قابلت المدير امبارح وقالي عن الترقية.',
      tier: 'A',
      confidence: 1.0,
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const user2Fact: EpistemicEvidence = {
      id: 'ep_u2_public',
      ownerId: 'user_2',
      companionId,
      kind: 'anecdote',
      group: 'history',
      vector: 'experience',
      text: 'يوم عادي في الشغل من غير أحداث.',
      tier: 'B',
      confidence: 0.8,
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await store.insertEvidence(user1Fact);
    await store.insertEvidence(user2Fact);

    // User 2 queries 'الترقية والمدير' -> MUST NOT SEE user 1's secret!
    const user2Recalled = await episodic.recallCandidates('user_2', companionId, 'الترقية والمدير');
    expect(user2Recalled.some(r => r.evidence.id === 'ep_u1_secret')).toBe(false);

    // User 1 queries 'الترقية والمدير' -> Sees own memory
    const user1Recalled = await episodic.recallCandidates('user_1', companionId, 'الترقية والمدير');
    expect(user1Recalled.some(r => r.evidence.id === 'ep_u1_secret')).toBe(true);
  });

  it('rejects un-scoped queries throwing security exceptions', async () => {
    await expect(episodic.recallCandidates('', 'amira', 'test')).rejects.toThrow();
    await expect(episodic.recallCandidates('user1', '', 'test')).rejects.toThrow();
  });

  it('never spreads activation across different companions', async () => {
    const ownerId = 'user_bob';
    const nowIso = new Date().toISOString();

    const ep1: EpistemicEvidence = {
      id: 'ep_c1_node1',
      ownerId,
      companionId: 'c1',
      kind: 'belief',
      group: 'worldview',
      vector: 'philosophy',
      text: 'العلم هو المنهج الوحيد لفهم الكون.',
      tier: 'A',
      confidence: 0.9,
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const ep2: EpistemicEvidence = {
      id: 'ep_c2_node2',
      ownerId,
      companionId: 'c2',
      kind: 'belief',
      group: 'worldview',
      vector: 'philosophy',
      text: 'المشاعر أهم من المنطق الرياضي.',
      tier: 'A',
      confidence: 0.9,
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await store.insertEvidence(ep1);
    await store.insertEvidence(ep2);

    // Try to link c1 to c2 via edge
    await store.addEdge(ownerId, 'c1', {
      sourceEpId: 'ep_c1_node1',
      targetEpId: 'ep_c2_node2',
      relationType: 'ASSOCIATIVE_TRIGGERS',
      weight: 1.0,
      lastActivatedAt: Date.now(),
    });

    // Spreading activation on c1 should NOT return c2's evidence because c2 is another companion
    const activated = await associative.spreadingActivation(ownerId, 'c1', ['ep_c1_node1']);
    expect(activated.some(a => a.evidence.companionId === 'c2')).toBe(false);
  });
});
