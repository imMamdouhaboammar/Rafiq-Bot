import { describe, it, expect, beforeEach } from 'bun:test';
import {
  prepareCognitivePipelineContext,
  postProcessCognitiveReply,
} from '../../services/cognitive/pipelineBridge.js';
import { defaultCognitiveCoordinator } from '../../services/cognitive/cognitiveCoordinator.server.js';
import { BotMood, type BotSettings, type UserProfile, type PsychologicalState } from '../../types.js';

describe('Cognitive Pipeline Integration', () => {
  const baseSettings: BotSettings = {
    botName: 'سارة',
    model: 'gemini-2.5-flash',
    thinkingLevel: 'low',
    cognitiveMode: 'off',
  };

  const userProfile: UserProfile = {
    name: 'أحمد',
  };

  const basePsychology: PsychologicalState = {
    mood: BotMood.NEUTRAL,
    energyLevel: 8,
    socialMeter: 5,
    hungerLevel: 0,
    sleepiness: 0,
    emotionalLedger: 0,
    currentScenario: 'Standard Routine',
    intimacyLevel: 7,
    secretUnlocked: false,
    moodStabilityTurns: 0,
    disgustScore: 0,
    tier: 'pro',
    isPro: true,
    isBlocked: false,
  };

  beforeEach(async () => {
    // Ingest clean test evidence for companion 'test_sara'
    await defaultCognitiveCoordinator.getEvidenceStore().insertEvidence({
      id: 'ep_grad_art',
      ownerId: 'أحمد',
      companionId: 'test_sara',
      kind: 'milestone',
      group: 'core_identity',
      vector: 'identity',
      text: 'اتخرجت من كلية فنون جميلة جامعة حلوان سنة 2021',
      confidence: 0.95,
      tier: 'A',
      status: 'active',
      createdAt: '2021-06-30T10:00:00Z',
      updatedAt: '2021-06-30T10:00:00Z',
    });
  });

  it('bypasses cognitive pipeline when cognitiveMode is "off"', async () => {
    const prep = await prepareCognitivePipelineContext({
      settings: { ...baseSettings, cognitiveMode: 'off' },
      userProfile,
      psychology: basePsychology,
      newMessage: 'اتخرجتي منين؟',
      memoryScopeId: 'test_sara',
    });

    expect(prep.cognitiveContext).toBeUndefined();
    expect(prep.cognitiveXmlBlock).toBeUndefined();
    expect(prep.advisorySocialInstruction).toBeUndefined();

    const post = await postProcessCognitiveReply({
      rawReply: 'أنا اتخرجت من فنون جميلة [ep_grad_art]',
      cognitiveContext: prep.cognitiveContext,
      ownerId: 'أحمد',
      companionId: 'test_sara',
      userMessage: 'اتخرجتي منين؟',
    });

    // In 'off' mode, citation token is stripped, but no verification ran
    expect(post.processedText).toBe('أنا اتخرجت من فنون جميلة');
    expect(post.groundingDecision).toBeUndefined();
  });

  it('prepares bounded XML context and social instruction in "assist" mode', async () => {
    const prep = await prepareCognitivePipelineContext({
      settings: { ...baseSettings, cognitiveMode: 'assist' },
      userProfile,
      psychology: basePsychology,
      newMessage: 'أنا تعبان جدا من الشغل والمدير مستفز',
      memoryScopeId: 'test_sara',
    });

    expect(prep.cognitiveContext).toBeDefined();
    expect(prep.cognitiveXmlBlock).toContain('<cognitive_context');
    expect(prep.cognitiveXmlBlock).toContain('</cognitive_context>');
    expect(prep.cognitiveContext?.socialMove).toBe('comfort');
    expect(prep.advisorySocialInstruction).toContain('COMFORT');
  });

  it('executes grounding check and strips citation tokens in "assist" mode', async () => {
    const prep = await prepareCognitivePipelineContext({
      settings: { ...baseSettings, cognitiveMode: 'assist' },
      userProfile,
      psychology: basePsychology,
      newMessage: 'اتخرجتي من كلية ايه؟',
      memoryScopeId: 'test_sara',
    });

    expect(prep.cognitiveContext).toBeDefined();
    expect(prep.cognitiveContext?.deliveredEvidence.length).toBeGreaterThan(0);

    const post = await postProcessCognitiveReply({
      rawReply: 'أنا اتخرجت من كلية فنون جميلة حلوان [ep_grad_art] والحمد لله كانت أيام جميلة.',
      cognitiveContext: prep.cognitiveContext,
      ownerId: 'أحمد',
      companionId: 'test_sara',
      userMessage: 'اتخرجتي من كلية ايه؟',
    });

    expect(post.groundingDecision).toBeDefined();
    expect(post.groundingDecision?.verified).toBe(true);
    expect(post.processedText).not.toContain('[ep_grad_art]');
    expect(post.processedText).toContain('أنا اتخرجت من كلية فنون جميلة حلوان والحمد لله كانت أيام جميلة.');
  });

  it('deflects hallucinated autobiographical claim in "strict" mode when ungrounded', async () => {
    const prep = await prepareCognitivePipelineContext({
      settings: { ...baseSettings, cognitiveMode: 'strict' },
      userProfile,
      psychology: basePsychology,
      newMessage: 'درستي هندسة فين؟',
      memoryScopeId: 'test_sara',
    });

    // Model hallucinated a degree with zero citations in delivered evidence
    const rawHallucination = 'أنا درست هندسة طيران في جامعة القاهرة واشتغلت معيدة هناك سنتين.';
    const post = await postProcessCognitiveReply({
      rawReply: rawHallucination,
      cognitiveContext: prep.cognitiveContext,
      ownerId: 'أحمد',
      companionId: 'test_sara',
      userMessage: 'درستي هندسة فين؟',
    });

    expect(post.groundingDecision?.verified).toBe(false);
    expect(post.groundingDecision?.suggestedAction).toBe('deflect');
    expect(post.processedText).toBe('مش متأكدة من تفاصيل الموضوع ده بصراحة، خلينا في اللي بنتكلم فيه.');
  });

  it('rejects unauthorized citation token under No ID, No Claim in "strict" mode', async () => {
    const prep = await prepareCognitivePipelineContext({
      settings: { ...baseSettings, cognitiveMode: 'strict' },
      userProfile,
      psychology: basePsychology,
      newMessage: 'مين صحابك في الجامعة؟',
      memoryScopeId: 'test_sara',
    });

    // Model forged a citation ID that was NOT in the delivery slice
    const forgedReply = 'كانت منى صاحبتي الانتيم في الكلية [ep_forged_999]';
    const post = await postProcessCognitiveReply({
      rawReply: forgedReply,
      cognitiveContext: prep.cognitiveContext,
      ownerId: 'أحمد',
      companionId: 'test_sara',
      userMessage: 'مين صحابك في الجامعة؟',
    });

    expect(post.groundingDecision?.verified).toBe(false);
    expect(post.groundingDecision?.unauthorizedCitationIds).toContain('ep_forged_999');
    expect(post.processedText).toBe('مش متأكدة من تفاصيل الموضوع ده بصراحة، خلينا في اللي بنتكلم فيه.');
  });
});
