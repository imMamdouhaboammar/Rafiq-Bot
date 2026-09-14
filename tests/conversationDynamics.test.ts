import { describe, expect, test } from 'bun:test';

// ── Core Engine Imports ────────────────────────────────────────────────────────
import { REFERENCE_HUMAN_CONVERSATION_PRIOR_V1 } from '../services/conversationDynamics/humanConversationPrior.js';
import { deriveHumanConversationPrior } from '../services/conversationDynamics/referencePriorExtractor.js';
import { calibrateRelationship } from '../services/conversationDynamics/relationshipCalibration.js';
import { selectContinuityAffordance } from '../services/conversationDynamics/continuityAffordance.js';
import { planRelationalMove } from '../services/conversationDynamics/relationalMovePlanner.js';
import { applyConversationSafetyGate } from '../services/conversationDynamics/conversationSafetyGate.js';
import { planReplyShape } from '../services/conversationDynamics/replyShapePlanner.js';
import { compileDynamicsPrompt } from '../services/conversationDynamics/dynamicsPromptCompiler.js';
import { planConversation } from '../services/conversationDynamics/planConversation.js';

// ── Adapter Imports ────────────────────────────────────────────────────────────
import {
  deriveDynamicsInput,
  deriveRelationshipEvidence,
  deriveContinuityCandidates,
  resolveConversationDynamics,
} from '../services/conversationDynamics/adapter.js';

// ── Integration Imports ────────────────────────────────────────────────────────
import { compileHumanRealismInstruction } from '../services/humanRealism.js';
import { getSystemInstruction } from '../services/personaEngine.js';
import type { BotSettings, PsychologicalState } from '../types.js';

// ── Test Fixtures ──────────────────────────────────────────────────────────────

const baseEvidence = {
  teasingPositiveReciprocations: 0,
  teasingNegativeCorrections: 0,
  nicknameReciprocatedUses: 0,
  nicknameSessions: 0,
  codeSwitchUserExamples: 0,
  codeSwitchSessions: 0,
  sharedReferenceReciprocations: 0,
  directnessPositiveEvidence: 0,
};

const earnedEvidence = {
  teasingPositiveReciprocations: 5,
  teasingNegativeCorrections: 0,
  nicknameReciprocatedUses: 4,
  nicknameSessions: 2,
  codeSwitchUserExamples: 5,
  codeSwitchSessions: 2,
  sharedReferenceReciprocations: 3,
  directnessPositiveEvidence: 3,
};

const baseInput = {
  messageTextLength: 10,
  isSocialPing: false,
  asksConcreteQuestion: false,
  requestsPracticalHelp: false,
  expressesDistress: false,
  containsCorrection: false,
  activeConflict: false,
  sensitivity: 'low' as const,
  userInvitesPlayfulness: false,
  userExpressesOpinion: false,
  assistantHasDifferentStableOpinion: false,
  recentAssistantVerbosity: 'short' as const,
  recentSameSpeakerBurst: 1,
  allowTopicShift: true,
};

const earnedCalibration = {
  teasingAllowed: true,
  teasingStrength: 2 as const,
  nicknameAllowed: true,
  codeSwitchMirroringAllowed: true,
  sharedReferenceAllowed: true,
  directDisagreementAllowed: true,
};

const baseCalibration = {
  teasingAllowed: false,
  teasingStrength: 0 as const,
  nicknameAllowed: false,
  codeSwitchMirroringAllowed: false,
  sharedReferenceAllowed: false,
  directDisagreementAllowed: false,
};

// ── 1. Human Conversation Prior ────────────────────────────────────────────────

describe('humanConversationPrior', () => {
  test('reference prior reflects 2731-event WhatsApp baseline', () => {
    expect(REFERENCE_HUMAN_CONVERSATION_PRIOR_V1.totalEvents).toBe(2731);
    expect(REFERENCE_HUMAN_CONVERSATION_PRIOR_V1.shortTextRatio).toBeCloseTo(0.795, 2);
    expect(REFERENCE_HUMAN_CONVERSATION_PRIOR_V1.burstMean).toBeCloseTo(1.65, 2);
    expect(REFERENCE_HUMAN_CONVERSATION_PRIOR_V1.burstMedian).toBe(1);
  });

  test('content kind ratios sum to approximately 1', () => {
    const ratios = REFERENCE_HUMAN_CONVERSATION_PRIOR_V1.contentKindRatios;
    const sum = Object.values(ratios).reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThan(0.95);
    expect(sum).toBeLessThanOrEqual(1.01);
  });
});

// ── 2. Reference Prior Extractor ──────────────────────────────────────────────

describe('referencePriorExtractor', () => {
  const events = [
    { speakerId: 'a', timestampMs: 0, contentKind: 'text' as const, textLength: 4, hasQuoteReply: false, hasCodeSwitch: false },
    { speakerId: 'a', timestampMs: 5000, contentKind: 'text' as const, textLength: 8, hasQuoteReply: true, hasCodeSwitch: true },
    { speakerId: 'b', timestampMs: 10000, contentKind: 'sticker' as const, textLength: 0, hasQuoteReply: false, hasCodeSwitch: false },
    { speakerId: 'a', timestampMs: 20000, contentKind: 'voice' as const, textLength: 0, hasQuoteReply: false, hasCodeSwitch: false },
  ];

  test('derives aggregate rhythm metrics without retaining raw content', () => {
    const prior = deriveHumanConversationPrior(events);
    expect(prior.totalEvents).toBe(4);
    expect(prior.shortTextRatio).toBe(1);
    expect(prior.quoteReplyRatio).toBe(0.25);
    expect(prior.codeSwitchRatio).toBe(0.25);
    expect('rawMessages' in prior).toBe(false);
  });

  test('returns safe empty prior for no events', () => {
    const prior = deriveHumanConversationPrior([]);
    expect(prior.totalEvents).toBe(0);
    expect(prior.burstMedian).toBe(1);
    expect(prior.burstMean).toBe(1);
  });
});

// ── 3. Relationship Calibration ───────────────────────────────────────────────

describe('relationshipCalibration', () => {
  test('no behaviors enabled without evidence', () => {
    const cal = calibrateRelationship(baseEvidence);
    expect(cal.teasingAllowed).toBe(false);
    expect(cal.nicknameAllowed).toBe(false);
    expect(cal.codeSwitchMirroringAllowed).toBe(false);
    expect(cal.sharedReferenceAllowed).toBe(false);
    expect(cal.directDisagreementAllowed).toBe(false);
  });

  test('all behaviors enabled after cross-session evidence', () => {
    const cal = calibrateRelationship(earnedEvidence);
    expect(cal.teasingAllowed).toBe(true);
    expect(cal.teasingStrength).toBe(2);
    expect(cal.nicknameAllowed).toBe(true);
    expect(cal.codeSwitchMirroringAllowed).toBe(true);
    expect(cal.sharedReferenceAllowed).toBe(true);
    expect(cal.directDisagreementAllowed).toBe(true);
  });

  test('one negative correction suppresses teasing regardless of positive count', () => {
    const cal = calibrateRelationship({ ...earnedEvidence, teasingNegativeCorrections: 1 });
    expect(cal.teasingAllowed).toBe(false);
    expect(cal.teasingStrength).toBe(0);
  });
});

// ── 4. Continuity Affordance ──────────────────────────────────────────────────

describe('continuityAffordance', () => {
  const candidates = [
    { id: 'health-1', kind: 'health' as const, summary: 'check how the condition is', salience: 0.9, relevance: 0.9, due: true, expired: false, resolved: false, sourceEvidenceCount: 2 },
    { id: 'plan-1', kind: 'plan' as const, summary: 'old travel plan', salience: 1, relevance: 0.2, due: true, expired: false, resolved: false, sourceEvidenceCount: 3 },
  ];

  test('selects top-scored due unresolved candidate', () => {
    const result = selectContinuityAffordance(candidates, { sensitivity: 'low', callbackBudgetAvailable: true });
    expect(result?.candidateId).toBe('health-1');
  });

  test('returns undefined when budget is unavailable', () => {
    expect(selectContinuityAffordance(candidates, { sensitivity: 'low', callbackBudgetAvailable: false })).toBeUndefined();
  });

  test('filters out resolved, expired, and zero-evidence candidates', () => {
    const result = selectContinuityAffordance([
      { ...candidates[0], resolved: true },
      { ...candidates[0], id: 'exp', expired: true },
      { ...candidates[0], id: 'zero', sourceEvidenceCount: 0 },
    ], { sensitivity: 'low', callbackBudgetAvailable: true });
    expect(result).toBeUndefined();
  });
});

// ── 5. Relational Move Planner ────────────────────────────────────────────────

describe('relationalMovePlanner', () => {
  test('ping message => minimal_presence', () => {
    expect(planRelationalMove({ ...baseInput, isSocialPing: true, messageTextLength: 4 }, earnedCalibration)).toBe('minimal_presence');
  });

  test('correction => repair (highest priority)', () => {
    expect(planRelationalMove({ ...baseInput, containsCorrection: true }, earnedCalibration)).toBe('repair');
  });

  test('practical help request => practical_help', () => {
    expect(planRelationalMove({ ...baseInput, requestsPracticalHelp: true }, earnedCalibration)).toBe('practical_help');
  });

  test('playfulness invitation with earned teasing => tease', () => {
    expect(planRelationalMove({ ...baseInput, userInvitesPlayfulness: true, sensitivity: 'low' }, earnedCalibration)).toBe('tease');
  });

  test('playfulness without earned teasing => acknowledge', () => {
    expect(planRelationalMove({ ...baseInput, userInvitesPlayfulness: true }, baseCalibration)).toBe('acknowledge');
  });

  test('distress at high sensitivity => micro_care', () => {
    expect(planRelationalMove({ ...baseInput, expressesDistress: true, sensitivity: 'high' }, baseCalibration)).toBe('micro_care');
  });

  test('opinion clash with earned directness and no conflict => disagree', () => {
    expect(planRelationalMove({
      ...baseInput,
      userExpressesOpinion: true,
      assistantHasDifferentStableOpinion: true,
    }, earnedCalibration)).toBe('disagree');
  });
});

// ── 6. Conversation Safety Gate ───────────────────────────────────────────────

describe('conversationSafetyGate', () => {
  test('downgrades teasing during active conflict => acknowledge', () => {
    const r = applyConversationSafetyGate('tease', { activeConflict: true, sensitivity: 'low', teasingAllowed: true, userInvitesPlayfulness: true });
    expect(r.move).toBe('acknowledge');
    expect(r.downgraded).toBe(true);
    expect(r.reasons).toContain('active_conflict_suppresses_teasing');
  });

  test('downgrades teasing at high sensitivity => micro_care', () => {
    const r = applyConversationSafetyGate('tease', { activeConflict: false, sensitivity: 'high', teasingAllowed: true, userInvitesPlayfulness: true });
    expect(r.move).toBe('micro_care');
  });

  test('downgrades unearned teasing => acknowledge', () => {
    const r = applyConversationSafetyGate('tease', { activeConflict: false, sensitivity: 'low', teasingAllowed: false, userInvitesPlayfulness: true });
    expect(r.move).toBe('acknowledge');
    expect(r.reasons).toContain('teasing_not_earned_or_invited');
  });

  test('passes non-teasing moves without change', () => {
    const r = applyConversationSafetyGate('practical_help', { activeConflict: false, sensitivity: 'low', teasingAllowed: false, userInvitesPlayfulness: false });
    expect(r.move).toBe('practical_help');
    expect(r.downgraded).toBe(false);
  });
});

// ── 7. Reply Shape Planner ────────────────────────────────────────────────────

describe('replyShapePlanner', () => {
  const shapeCtx = { recentSameSpeakerBurst: 1, recentAssistantVerbosity: 'short' as const, allowTopicShift: true, sensitivity: 'low' as const };

  test('minimal_presence => 1 micro bubble, warm signal', () => {
    const shape = planReplyShape('minimal_presence', shapeCtx);
    expect(shape.bubbleCount).toBe(1);
    expect(shape.verbosity).toBe('micro');
    expect(shape.askQuestion).toBe(false);
    expect(shape.relationshipSignal).toBe('warm');
  });

  test('tease => short playful signal', () => {
    const shape = planReplyShape('tease', shapeCtx);
    expect(shape.verbosity).toBe('short');
    expect(shape.relationshipSignal).toBe('playful');
  });

  test('practical_help => normal verbosity with question', () => {
    const shape = planReplyShape('practical_help', { ...shapeCtx, recentSameSpeakerBurst: 3 });
    expect(shape.verbosity).toBe('normal');
    expect(shape.askQuestion).toBe(true);
    expect(shape.allowTopicShift).toBe(false);
    expect(shape.bubbleCount).toBeLessThanOrEqual(3);
  });

  test('repair => single short bubble, no topic shift', () => {
    const shape = planReplyShape('repair', shapeCtx);
    expect(shape.bubbleCount).toBe(1);
    expect(shape.verbosity).toBe('short');
    expect(shape.allowTopicShift).toBe(false);
  });
});

// ── 8. Dynamics Prompt Compiler ───────────────────────────────────────────────

describe('dynamicsPromptCompiler', () => {
  test('compiles readable instruction without leaking internal state names', () => {
    const prompt = compileDynamicsPrompt({
      move: 'callback',
      shape: { bubbleCount: 1, verbosity: 'short', askQuestion: true, allowTopicShift: false, relationshipSignal: 'warm' },
      callback: { candidateId: 'thread-1', kind: 'health', summary: 'how is the condition now', score: 0.9 },
      safetyReasons: [],
    });
    expect(prompt).toMatch(/follow up/i);
    expect(prompt).toMatch(/do not assume/i);
    expect(prompt.includes('candidateId')).toBe(false);
    expect(prompt.includes('continuityState')).toBe(false);
    expect(prompt.includes('{"')).toBe(false);
  });

  test('no callback directive when no callback is selected', () => {
    const prompt = compileDynamicsPrompt({
      move: 'acknowledge',
      shape: { bubbleCount: 1, verbosity: 'micro', askQuestion: false, allowTopicShift: true, relationshipSignal: 'none' },
      safetyReasons: [],
    });
    expect(prompt.toLowerCase().includes('follow up on:')).toBe(false);
  });

  test('always includes the anti-manipulation footer', () => {
    const prompt = compileDynamicsPrompt({
      move: 'minimal_presence',
      shape: { bubbleCount: 1, verbosity: 'micro', askQuestion: false, allowTopicShift: true, relationshipSignal: 'none' },
      safetyReasons: [],
    });
    expect(prompt).toMatch(/never guilt/i);
    expect(prompt).toMatch(/do not invent physical or logistical details/i);
  });
});

// ── 9. planConversation Orchestrator ──────────────────────────────────────────

describe('planConversation', () => {
  test('orchestrates calibration + affordance + safety + shape deterministically', () => {
    const plan = planConversation({
      input: baseInput,
      evidence: earnedEvidence,
      continuityCandidates: [{
        id: 'follow', kind: 'outcome', summary: 'ask how the pending result went',
        salience: 0.9, relevance: 0.95, due: true, expired: false, resolved: false, sourceEvidenceCount: 2,
      }],
      callbackBudgetAvailable: true,
    });
    expect(plan.move).toBe('callback');
    expect(plan.callback?.candidateId).toBe('follow');
    expect(plan.shape.askQuestion).toBe(true);
  });

  test('correction always yields repair regardless of relationship', () => {
    const plan = planConversation({ input: { ...baseInput, containsCorrection: true }, evidence: baseEvidence });
    expect(plan.move).toBe('repair');
  });

  test('ping yields minimal_presence with micro shape', () => {
    const plan = planConversation({ input: { ...baseInput, isSocialPing: true, messageTextLength: 3 }, evidence: baseEvidence });
    expect(plan.move).toBe('minimal_presence');
    expect(plan.shape.bubbleCount).toBe(1);
    expect(plan.shape.verbosity).toBe('micro');
  });

  test('safety reasons empty when no downgrade occurred', () => {
    const plan = planConversation({ input: baseInput, evidence: baseEvidence });
    expect(plan.safetyReasons).toHaveLength(0);
  });

  test('safety gate fires when tease is proposed into active conflict', () => {
    // planRelationalMove correctly suppresses tease before safety gate when activeConflict is true.
    // Verify the safety gate logic directly rather than through planConversation.
    const result = applyConversationSafetyGate('tease', {
      activeConflict: true, sensitivity: 'low', teasingAllowed: true, userInvitesPlayfulness: true,
    });
    expect(result.downgraded).toBe(true);
    expect(result.reasons).toContain('active_conflict_suppresses_teasing');
  });
});

// ── 10. Adapter: deriveDynamicsInput ──────────────────────────────────────────

describe('adapter.deriveDynamicsInput', () => {
  test('detects Arabic social ping patterns', () => {
    for (const ping of ['فينك', '.', 'انت فين']) {
      const input = deriveDynamicsInput({ messageText: ping });
      expect(input.isSocialPing).toBe(true);
    }
  });

  test('detects explicit Arabic correction phrases', () => {
    const input = deriveDynamicsInput({ messageText: 'مش كدا أنت فاهم غلط' });
    expect(input.containsCorrection).toBe(true);
  });

  test('flags high sensitivity for grief/illness vocabulary', () => {
    const input = deriveDynamicsInput({ messageText: 'مات جدي الأسبوع ده' });
    expect(input.sensitivity).toBe('high');
  });

  test('flags practical help for actionable requests', () => {
    const input = deriveDynamicsInput({ messageText: 'ساعدني في كتابة إيميل' });
    expect(input.requestsPracticalHelp).toBe(true);
  });

  test('derives user burst from trailing consecutive user history', () => {
    const history = [
      { role: 'user', parts: [{ text: 'first' }] },
      { role: 'user', parts: [{ text: 'second' }] },
      { role: 'user', parts: [{ text: 'third' }] },
    ];
    const input = deriveDynamicsInput({ messageText: 'كمان', recentHistory: history });
    expect(input.recentSameSpeakerBurst).toBe(3);
  });

  test('handles empty and whitespace context without throwing', () => {
    expect(() => deriveDynamicsInput({ messageText: '' })).not.toThrow();
    expect(() => deriveDynamicsInput({ messageText: '   ' })).not.toThrow();
  });
});

// ── 11. Adapter: deriveRelationshipEvidence ───────────────────────────────────

describe('adapter.deriveRelationshipEvidence', () => {
  test('high intimacy produces baseline teasing evidence', () => {
    const evidence = deriveRelationshipEvidence(null, { intimacyLevel: 80, emotionalLedger: 10 } as PsychologicalState);
    expect(evidence.teasingPositiveReciprocations).toBeGreaterThanOrEqual(4);
  });

  test('disappointed breakpoint adds negative teasing correction', () => {
    const evidence = deriveRelationshipEvidence(null, { breakpointState: 'disappointed', intimacyLevel: 30 } as PsychologicalState);
    expect(evidence.teasingNegativeCorrections).toBeGreaterThan(0);
  });

  test('null continuity state never throws', () => {
    expect(() => deriveRelationshipEvidence(null, undefined)).not.toThrow();
  });
});

// ── 12. Adapter: deriveContinuityCandidates ───────────────────────────────────

describe('adapter.deriveContinuityCandidates', () => {
  test('filters expired and resolved threads, keeps active', () => {
    const state = {
      threads: [
        { id: 'a', kind: 'outcome', status: 'active', summary: 'follow-up test', salience: 0.8, sourceMessageIds: ['m1'] },
        { id: 'b', kind: 'outcome', status: 'expired', summary: 'old news', salience: 0.9, sourceMessageIds: ['m2'] },
        { id: 'c', kind: 'outcome', status: 'resolved', summary: 'done deal', salience: 0.7, sourceMessageIds: ['m3'] },
      ],
    } as any;
    const candidates = deriveContinuityCandidates(state, '');
    expect(candidates.length).toBe(1);
    expect(candidates[0].id).toBe('a');
  });

  test('returns empty array for null/undefined state', () => {
    expect(deriveContinuityCandidates(null, 'hi')).toHaveLength(0);
    expect(deriveContinuityCandidates(undefined, 'hi')).toHaveLength(0);
  });
});

// ── 13. resolveConversationDynamics (fail-safe) ───────────────────────────────

describe('resolveConversationDynamics', () => {
  test('returns valid plan and non-empty instruction for a normal message', () => {
    const result = resolveConversationDynamics({ messageText: 'عامل إيه؟' });
    expect(result.plan).toBeDefined();
    expect(typeof result.dynamicsInstruction).toBe('string');
    expect(result.dynamicsInstruction.length).toBeGreaterThan(0);
  });

  test('ping resolves to minimal_presence with micro shape', () => {
    const result = resolveConversationDynamics({ messageText: 'فينك' });
    expect(result.plan.move).toBe('minimal_presence');
    expect(result.plan.shape.verbosity).toBe('micro');
    expect(result.plan.shape.bubbleCount).toBe(1);
  });

  test('practical help message produces practical_help move', () => {
    const result = resolveConversationDynamics({ messageText: 'ساعدني في خطوات المشروع' });
    expect(result.plan.move).toBe('practical_help');
  });

  test('correction phrase produces repair move', () => {
    const result = resolveConversationDynamics({ messageText: 'غلط - أنا ما قولتش كده' });
    expect(result.plan.move).toBe('repair');
  });

  test('empty context never crashes', () => {
    expect(() => resolveConversationDynamics({ messageText: '' })).not.toThrow();
    expect(() => resolveConversationDynamics({ messageText: '   ' })).not.toThrow();
  });

  test('teasing is gated during conflict even with banter signals', () => {
    const result = resolveConversationDynamics({
      messageText: 'بهزر معاك',
      psychology: { emotionalLedger: -50 } as PsychologicalState,
    });
    expect(result.plan.move).not.toBe('tease');
  });
});

// ── 14. End-to-End: dynamicsInstruction injection ─────────────────────────────

describe('end-to-end: dynamicsInstruction injection', () => {
  const dynamicsInstruction = '[Conversation behavior]\nRespond with minimal social presence. A tiny reply is enough.\nUse 1 bubble at most; keep the response micro.';

  test('compileHumanRealismInstruction injects dynamics block when present', () => {
    const output = compileHumanRealismInstruction({
      botName: 'رفيق',
      mood: 'neutral',
      energy: 7,
      emotionalLedger: 0,
      intimacy: 30,
      dynamicsInstruction,
    });
    expect(output).toContain('[Conversation behavior]');
    expect(output).toContain('HUMAN REALISM LAYER');
  });

  test('compileHumanRealismInstruction omits dynamics block when absent', () => {
    const output = compileHumanRealismInstruction({
      botName: 'رفيق',
      mood: 'neutral',
      energy: 7,
      emotionalLedger: 0,
      intimacy: 30,
    });
    expect(output).not.toContain('[Conversation behavior]');
  });

  test('getSystemInstruction passes dynamicsInstruction through to human-realism block', () => {
    const settings = {
      botName: 'رفيق',
      botBio: 'A close friend persona.',
      chattiness: 'balanced',
    } as unknown as BotSettings;

    const output = getSystemInstruction(
      settings,
      null,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      dynamicsInstruction,
    );
    expect(output).toContain('[Conversation behavior]');
    expect(output).toContain('HUMAN REALISM LAYER');
  });

  test('getSystemInstruction produces valid output without dynamicsInstruction', () => {
    const settings = {
      botName: 'رفيق',
      botBio: 'A companion.',
      chattiness: 'balanced',
    } as unknown as BotSettings;
    const output = getSystemInstruction(settings, null);
    expect(output).toContain('HUMAN REALISM LAYER');
    expect(output.includes('[Conversation behavior]')).toBe(false);
  });
});
