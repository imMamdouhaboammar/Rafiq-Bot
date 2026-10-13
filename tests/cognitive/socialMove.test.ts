import { describe, it, expect } from 'bun:test';
import { SocialMovePlanner } from '../../services/cognitive/socialMovePlanner.js';
import { BotMood, type PsychologicalState } from '../../types.js';
import type { CompanionContinuityState } from '../../services/companionContinuity.js';

describe('Cognitive Social Move Planner', () => {
  const planner = new SocialMovePlanner();

  const basePsychology: PsychologicalState = {
    mood: BotMood.NEUTRAL,
    energyLevel: 8,
    socialMeter: 5,
    hungerLevel: 0,
    sleepiness: 0,
    emotionalLedger: 0,
    currentScenario: "Standard Routine",
    intimacyLevel: 7,
    secretUnlocked: false,
    moodStabilityTurns: 0,
    disgustScore: 0,
    tier: 'pro',
    isPro: true,
    isBlocked: false,
  };

  const baseContinuity: CompanionContinuityState = {
    version: 1,
    threads: [
      {
        id: 'th_work_interview',
        kind: 'follow_up',
        summary: 'انترفيو الشركة الجديدة بكرة الصبح',
        sourceMessageIds: ['m1'],
        salience: 0.9,
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

  it('selects minimal_presence when companion energy is critically low or fatigued', () => {
    const tiredPsychology: PsychologicalState = {
      ...basePsychology,
      energyLevel: 2,
      sleepiness: 90,
    };

    const plan = planner.planMove('كنت عايز اسألك في موضوع طويل بخصوص المشروع', undefined, tiredPsychology);
    expect(plan.socialMove).toBe('minimal_presence');
    expect(plan.bubbleCount).toBe(1);
    expect(plan.reason).toContain('energy');
  });

  it('selects comfort when user is venting distress or exhaustion', () => {
    const plan = planner.planMove('أنا تعبان ومخنوق جدا من الشغل والمدير مستفز', undefined, basePsychology);
    expect(plan.socialMove).toBe('comfort');
    expect(plan.bubbleCount).toBe(2);
  });

  it('selects check_in for social nudges with 1 brief bubble', () => {
    const plan = planner.planMove('فينك؟', undefined, basePsychology);
    expect(plan.socialMove).toBe('check_in');
    expect(plan.bubbleCount).toBe(1);
  });

  it('allows teasing only when relational trust and closeness permit it', () => {
    // 1. High trust & intimacy -> teasing allowed
    const highTrustPlan = planner.planMove('شايف نفسك ومغرور كالعادة يا عم 😂', undefined, basePsychology);
    expect(highTrustPlan.relationalPermissions.teasingPermitted).toBe(true);
    expect(highTrustPlan.socialMove).toBe('tease');
    expect(highTrustPlan.bubbleCount).toBe(2);

    // 2. Low trust/new acquaintance (intimacyLevel: 2) -> teasing rejected, falls back to acknowledge
    const lowTrustPsychology: PsychologicalState = {
      ...basePsychology,
      intimacyLevel: 2,
    };
    const lowTrustPlan = planner.planMove('شايف نفسك ومغرور كالعادة يا عم 😂', undefined, lowTrustPsychology);
    expect(lowTrustPlan.relationalPermissions.teasingPermitted).toBe(false);
    expect(lowTrustPlan.socialMove).toBe('acknowledge');
    expect(lowTrustPlan.bubbleCount).toBe(1);
  });

  it('detects callback opportunities from active continuity threads', () => {
    const plan = planner.planMove('مش عارف أعمل ايه في موضوع انترفيو الشركة', undefined, basePsychology, baseContinuity);
    expect(plan.socialMove).toBe('callback');
    expect(plan.bubbleCount).toBe(2);
    expect(plan.reason).toContain('انترفيو الشركة الجديدة بكرة الصبح');
  });

  it('never permits romantic assumption from an affectionate message', () => {
    const plan = planner.planMove('بحبك ووحشتيني أوي', undefined, basePsychology, baseContinuity);
    expect(plan.relationalPermissions.romanticPermitted).toBe(false);
  });
});
