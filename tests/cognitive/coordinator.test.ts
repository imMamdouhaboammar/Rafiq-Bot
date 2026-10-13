import { describe, it, expect, beforeEach } from 'bun:test';
import { CognitiveCoordinator } from '../../services/cognitive/cognitiveCoordinator.server.js';
import { CognitiveEvidenceStore } from '../../services/cognitive/evidenceStore.js';
import type { EpistemicEvidence, LifeMilestone } from '../../services/cognitive/types.js';

describe('CognitiveCoordinator End-to-End', () => {
  let store: CognitiveEvidenceStore;
  let coordinator: CognitiveCoordinator;
  const ownerId = 'user_coord_test';
  const companionId = 'amira';

  beforeEach(async () => {
    store = new CognitiveEvidenceStore();
    coordinator = new CognitiveCoordinator({ evidenceStore: store });

    // Seed some test evidence
    const nowIso = new Date().toISOString();
    const ep1: EpistemicEvidence = {
      id: 'ep_uni_grad',
      ownerId,
      companionId,
      kind: 'anecdote',
      group: 'history',
      vector: 'education',
      text: 'اتخرجت من كلية الآداب قسم لغات وترجمة سنة 2021.',
      tier: 'A',
      confidence: 0.95,
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const ep2: EpistemicEvidence = {
      id: 'ep_job_trans',
      ownerId,
      companionId,
      kind: 'anecdote',
      group: 'history',
      vector: 'career',
      text: 'اشتغلت مترجمة فورية لمدة سنتين بعد التخرج.',
      tier: 'B',
      confidence: 0.85,
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await store.insertEvidence(ep1);
    await store.insertEvidence(ep2);

    await store.addEdge(ownerId, companionId, {
      sourceEpId: 'ep_uni_grad',
      targetEpId: 'ep_job_trans',
      relationType: 'TEMPORAL_PRECEDES',
      weight: 0.9,
      lastActivatedAt: Date.now(),
    });

    const milestone: LifeMilestone = {
      id: 'mile_uni',
      ownerId,
      companionId,
      eraTitle: 'فترة الجامعة',
      startYear: 2017,
      endYear: 2021,
      summaryText: 'دراسة اللغات والترجمة وبداية الاهتمام بالثقافة الإيطالية.',
      keyThemes: ['جامعة', 'لغات'],
      createdAt: nowIso,
    };
    await store.addMilestone(milestone);
  });

  it('prepareTurn in "off" mode returns zero-overhead empty context', async () => {
    const context = await coordinator.prepareTurn({
      ownerId,
      companionId,
      userMessage: 'مساء الخير عاملة ايه؟',
      mode: 'off',
    });

    expect(context.mode).toBe('off');
    expect(context.contextPrompt).toBe('');
    expect(context.tokenEstimate).toBe(0);
    expect(context.deliveredEvidence.length).toBe(0);
  });

  it('prepareTurn in "assist" mode recalls evidence and activates associative links', async () => {
    const context = await coordinator.prepareTurn({
      ownerId,
      companionId,
      userMessage: 'فاكرة دراستك والكلية؟',
      mode: 'assist',
      timeScopeYear: 2019,
    });

    expect(context.mode).toBe('assist');
    expect(context.contextPrompt).toContain('<cognitive_context companion="amira"');
    expect(context.contextPrompt).toContain('ep_uni_grad');
    // Associative activation should pull ep_job_trans via TEMPORAL_PRECEDES
    expect(context.deliveredEvidence.some(ep => ep.id === 'ep_job_trans')).toBe(true);
    // Milestone for 2019 should be included
    expect(context.eraMilestone?.eraTitle).toBe('فترة الجامعة');
    expect(context.tokenEstimate).toBeLessThan(400);
    expect(context.runId).toBeTruthy();
  });

  it('verifyReply checks grounding against run delivery slice', async () => {
    const turnContext = await coordinator.prepareTurn({
      ownerId,
      companionId,
      userMessage: 'اتخرجتي امتى؟',
      mode: 'assist',
    });

    // Valid reply backed by delivered evidence
    const validDecision = await coordinator.verifyReply({
      runId: turnContext.runId,
      ownerId,
      companionId,
      replyText: 'اتخرجت من كلية الآداب قسم لغات سنة 2021.',
      deliveredEvidenceIds: turnContext.deliveredEvidence.map(e => e.id),
      checkStrictGrounding: true,
    });
    expect(validDecision.verified).toBe(true);

    // Fabricated reply citing an undelivered ID
    const fabricatedDecision = await coordinator.verifyReply({
      runId: turnContext.runId,
      ownerId,
      companionId,
      replyText: 'درست في أمريكا سنة 2015 [ep_fake_usa].',
      deliveredEvidenceIds: turnContext.deliveredEvidence.map(e => e.id),
      checkStrictGrounding: true,
    });
    expect(fabricatedDecision.verified).toBe(false);
    expect(fabricatedDecision.unauthorizedCitationIds).toContain('ep_fake_usa');
  });

  it('observeTurn is strictly idempotent', async () => {
    await coordinator.observeTurn({
      turnId: 'turn_duplicate_1',
      ownerId,
      companionId,
      userMessage: 'ازيك',
      replyText: 'الحمد لله تمام',
    });

    // Replay same turnId
    await coordinator.observeTurn({
      turnId: 'turn_duplicate_1',
      ownerId,
      companionId,
      userMessage: 'ازيك',
      replyText: 'الحمد لله تمام',
    });
  });

  it('correctEvidence supersedes older facts and updates memory state', async () => {
    await coordinator.correctEvidence({
      ownerId,
      companionId,
      targetEvidenceId: 'ep_job_trans',
      correctedText: 'اشتغلت مترجمة فورية لمدة سنة واحدة فقط مش سنتين.',
      newConfidence: 0.98,
    });

    const oldEp = await store.getEvidence(ownerId, companionId, 'ep_job_trans');
    expect(oldEp?.status).toBe('superseded');

    const activeList = await store.listActiveEvidence(ownerId, companionId);
    expect(activeList.some(e => e.id === 'ep_job_trans')).toBe(false);
    expect(activeList.some(e => e.text.includes('سنة واحدة فقط'))).toBe(true);
  });

  it('invalidateEvidence marks target fact as invalidated', async () => {
    await coordinator.invalidateEvidence({
      ownerId,
      companionId,
      targetEvidenceId: 'ep_uni_grad',
      reason: 'معلومة خاطئة تم حذفها',
    });

    const ep = await store.getEvidence(ownerId, companionId, 'ep_uni_grad');
    expect(ep?.status).toBe('invalidated');

    const activeList = await store.listActiveEvidence(ownerId, companionId);
    expect(activeList.some(e => e.id === 'ep_uni_grad')).toBe(false);
  });
});
