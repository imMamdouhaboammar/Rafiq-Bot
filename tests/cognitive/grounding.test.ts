import { describe, it, expect, beforeEach } from 'bun:test';
import { CognitiveEvidenceStore } from '../../services/cognitive/evidenceStore.js';
import { GroundingVerifier } from '../../services/cognitive/groundingVerifier.js';
import { EpistemicEvidence } from '../../services/cognitive/types.js';

describe('Cognitive Grounding & Epistemic Verifier', () => {
  let store: CognitiveEvidenceStore;
  let verifier: GroundingVerifier;
  const ownerId = 'user_test';
  const companionId = 'companion_test';

  beforeEach(() => {
    store = new CognitiveEvidenceStore();
    verifier = new GroundingVerifier(store);
  });

  it('rejects unauthorized citations under No ID, No Claim invariant', async () => {
    const runId = 'run_101';
    const deliveredIds = ['ep_valid_1', 'ep_valid_2'];

    // Reply cites [ep_fabricated_999] which was NOT in delivery slice
    const decision = await verifier.verifyReply({
      runId,
      ownerId,
      companionId,
      replyText: 'أنا فاكر الموضوع ده كويس [ep_fabricated_999].',
      deliveredEvidenceIds: deliveredIds,
      checkStrictGrounding: true,
    });

    expect(decision.verified).toBe(false);
    expect(decision.unauthorizedCitationIds).toContain('ep_fabricated_999');
    expect(decision.reason).toContain("Violation of 'No ID, No Claim'");
  });

  it('permits casual greetings and conversational banter with zero citations', async () => {
    const runId = 'run_102';
    const casualReplies = [
      'صباح النور يا غالي عامل ايه؟',
      'تمام الحمد لله وانت أخبارك ايه؟',
      'ههههههه دمك خفيف والله 😂',
      'قشطة نتقابل بكرة إن شاء الله',
    ];

    for (const reply of casualReplies) {
      const decision = await verifier.verifyReply({
        runId,
        ownerId,
        companionId,
        replyText: reply,
        deliveredEvidenceIds: [],
        checkStrictGrounding: true,
      });

      expect(decision.verified).toBe(true);
      expect(decision.claimType).toBe('casual_conversational');
      expect(decision.unauthorizedCitationIds.length).toBe(0);
    }
  });

  it('permits subjective opinions and preferences without requiring historical citations', async () => {
    const runId = 'run_103';
    const decision = await verifier.verifyReply({
      runId,
      ownerId,
      companionId,
      replyText: 'شايف إن الشغل في بيئة هادية بيبقى أفضل بكتير وبفضل القهوة من غير سكر.',
      deliveredEvidenceIds: [],
      checkStrictGrounding: true,
    });

    expect(decision.verified).toBe(true);
    expect(decision.claimType).toBe('subjective_opinion');
  });

  it('rejects unsupported autobiographical factual claims in strict mode when context has zero citations', async () => {
    const runId = 'run_104';
    const fabricatedReply = 'أنا اتخرجت من هندسة سنة 2018 وسافرت بعدها اشتغلت في دبي سنتين.';

    const decision = await verifier.verifyReply({
      runId,
      ownerId,
      companionId,
      replyText: fabricatedReply,
      deliveredEvidenceIds: [],
      checkStrictGrounding: true,
    });

    expect(decision.verified).toBe(false);
    expect(decision.claimType).toBe('unsupported_factual');
    expect(decision.suggestedAction).toBe('deflect');
    expect(decision.reason).toContain('without any supporting evidence');
  });

  it('verifies supported autobiographical historical claims when corroborated by delivered evidence', async () => {
    const runId = 'run_105';
    const nowIso = new Date().toISOString();

    const graduationEp: EpistemicEvidence = {
      id: 'ep_grad_2018',
      ownerId,
      companionId,
      kind: 'anecdote',
      group: 'history',
      vector: 'education',
      text: 'اتخرجت من كلية الهندسة سنة 2018 بتقدير جيد جدا.',
      tier: 'A',
      confidence: 0.95,
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await store.insertEvidence(graduationEp);

    const reply = 'أنا فعلاً اتخرجت من هندسة سنة 2018 وكانت أيام امتحانات صعبة.';

    const decision = await verifier.verifyReply({
      runId,
      ownerId,
      companionId,
      replyText: reply,
      deliveredEvidenceIds: ['ep_grad_2018'],
      checkStrictGrounding: true,
    });

    expect(decision.verified).toBe(true);
    expect(decision.claimType).toBe('supported_historical');
    expect(decision.groundingScore).toBeGreaterThanOrEqual(0.8);
  });

  it('rejects claims citing invalidated or superseded evidence', async () => {
    const runId = 'run_106';
    const nowIso = new Date().toISOString();

    const oldEp: EpistemicEvidence = {
      id: 'ep_old_job',
      ownerId,
      companionId,
      kind: 'anecdote',
      group: 'history',
      vector: 'career',
      text: 'اشتغلت في البنك الأهلي سنة 2019.',
      tier: 'B',
      confidence: 0.8,
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await store.insertEvidence(oldEp);

    // Invalidate it
    await store.invalidateEvidence(ownerId, companionId, 'ep_old_job', 'تم التأكد من عدم صحة المعلومة');

    const reply = 'اشتغلت في البنك الأهلي سنة 2019 لمدة شهور.';

    const decision = await verifier.verifyReply({
      runId,
      ownerId,
      companionId,
      replyText: reply,
      deliveredEvidenceIds: ['ep_old_job'],
      checkStrictGrounding: true,
    });

    expect(decision.verified).toBe(false);
    expect(decision.claimType).toBe('uncertain_or_contradictory');
    expect(decision.reason).toContain('superseded or invalidated');
  });

  it('strips internal citation tokens before delivery to user', () => {
    const rawWithTokens = 'أنا اتخرجت سنة 2018 [ep_grad_2018] وكانت أيام حلوة [ep_uni_life].';
    const stripped = verifier.stripInternalCitationTokens(rawWithTokens);

    expect(stripped).toBe('أنا اتخرجت سنة 2018 وكانت أيام حلوة.');
    expect(stripped.includes('ep_grad_2018')).toBe(false);
    expect(stripped.includes('ep_uni_life')).toBe(false);
  });
});
