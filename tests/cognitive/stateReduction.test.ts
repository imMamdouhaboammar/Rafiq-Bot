import { describe, it, expect } from 'bun:test';
import {
  computeSalienceDecay,
  decayContinuityThreads,
  reduceCognitiveProposal,
} from '../../services/cognitive/stateAdapter.js';
import type { CompanionContinuityState, ContinuityProposal } from '../../services/companionContinuity.js';

describe('Cognitive State Reduction & Salience Decay', () => {
  it('computes exponential salience decay where high arousal slows decay', () => {
    const s0 = 0.8;
    const elapsed = 48; // 48 hours (2 days)

    // Calm concern (arousal = 0.1)
    const calmDecayed = computeSalienceDecay(s0, elapsed, 0.1);
    // Emotionally charged concern (arousal = 0.9)
    const chargedDecayed = computeSalienceDecay(s0, elapsed, 0.9);

    expect(calmDecayed).toBeLessThan(s0);
    expect(chargedDecayed).toBeLessThan(s0);
    // Charged concern decays slower, so remaining salience is higher
    expect(chargedDecayed).toBeGreaterThan(calmDecayed);
  });

  it('drops proposals with confidence below 0.60 deterministically', () => {
    const state: CompanionContinuityState = {
      version: 1,
      threads: [],
      opinions: [],
      expectations: [],
      rituals: [],
      updatedAt: new Date().toISOString(),
    };

    const lowConfidenceProposal = {
      type: 'opinion_upsert',
      topic: 'موسيقى الراب',
      stance: 'بيحب يسمع ويجز',
      confidence: 0.45, // < 0.60
      sourceMessageIds: ['m1'],
    } as unknown as ContinuityProposal;

    const result = reduceCognitiveProposal(state, lowConfidenceProposal);
    expect(result.applied).toBe(false);
    expect(result.nextState.opinions.length).toBe(0);
    expect(result.reason).toContain('below threshold 0.60');
  });

  it('rejects romantic expectation escalation without sufficient corroborated evidence', () => {
    const state: CompanionContinuityState = {
      version: 1,
      threads: [],
      opinions: [],
      expectations: [],
      rituals: [],
      updatedAt: new Date().toISOString(),
    };

    const unearnedRomanticProposal: ContinuityProposal = {
      type: 'expectation_upsert',
      key: 'romantic_partnership',
      statement: 'علاقة حب متبادلة ورومانسية',
      confidence: 0.9,
      sourceMessageIds: ['m1'], // Only 1 piece of evidence! Must be >= 3
    };

    const result = reduceCognitiveProposal(state, unearnedRomanticProposal);
    expect(result.applied).toBe(false);
    expect(result.nextState.expectations.length).toBe(0);
    expect(result.reason).toContain('Romantic expectation rejected');
  });

  it('transitions low salience threads to dormant when decayed below threshold', () => {
    const state: CompanionContinuityState = {
      version: 1,
      threads: [
        {
          id: 'th_old_chat',
          kind: 'outcome',
          summary: 'موضوع قديم انتهى',
          sourceMessageIds: ['m_old'],
          salience: 0.2,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      opinions: [],
      expectations: [],
      rituals: [],
      updatedAt: new Date().toISOString(),
    };

    // After 100 hours of inactivity
    const decayed = decayContinuityThreads(state, 100);
    expect(decayed.threads[0].salience).toBeLessThan(0.15);
    expect(decayed.threads[0].status).toBe('dormant');
  });
});
