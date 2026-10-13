import { describe, it, expect } from 'bun:test';
import { CognitiveContextCompiler, estimateTokens } from '../../services/cognitive/contextCompiler.js';
import type { EpistemicEvidence } from '../../services/cognitive/types.js';

describe('Cognitive Context Compiler', () => {
  const compiler = new CognitiveContextCompiler();

  it('compiles high-density XML context pack under 400 tokens', () => {
    const deliveredEvidence: EpistemicEvidence[] = [
      {
        id: 'ep_pref_1',
        ownerId: 'u1',
        companionId: 'c1',
        kind: 'preference',
        group: 'preferences',
        vector: 'taste',
        text: 'بيفضل القهوة المظبوط وبيشربها كل صباح.',
        tier: 'A',
        confidence: 0.95,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'ep_hist_2',
        ownerId: 'u1',
        companionId: 'c1',
        kind: 'anecdote',
        group: 'history',
        vector: 'career',
        text: 'اشتغل مصمم واجهات لمدة ٣ سنين في القاهرة.',
        tier: 'B',
        confidence: 0.85,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const result = compiler.compile({
      runId: 'run_test_123',
      companionId: 'amira',
      companionName: 'أميرة',
      socialMove: 'tease',
      bubbleBudget: 2,
      deliveredEvidence,
      relationalPermissions: {
        teasingPermitted: true,
        vulnerabilityPermitted: false,
        disagreePermitted: true,
        romanticPermitted: false,
        trustScore: 0.72,
        closenessScore: 0.7,
      },
    });

    expect(result.xmlBlock).toContain('<cognitive_context companion="amira" run_id="run_test_123">');
    expect(result.xmlBlock).toContain('<suggested_social_move>tease</suggested_social_move>');
    expect(result.xmlBlock).toContain('<bubble_budget>2</bubble_budget>');
    expect(result.xmlBlock).toContain('ep_pref_1');
    expect(result.xmlBlock).toContain('ep_hist_2');
    expect(result.xmlBlock).toContain('No ID, No Claim');
    expect(result.xmlBlock).toContain('<negative_constraints>');

    // Token estimate check: must be bounded < 400 tokens
    expect(result.tokenEstimate).toBeLessThan(400);
    expect(result.deliveredCount).toBe(2);
  });

  it('handles empty delivery slice without emitting broken grounding tags', () => {
    const result = compiler.compile({
      runId: 'run_test_empty',
      companionId: 'amira',
      socialMove: 'answer',
      bubbleBudget: 1,
      deliveredEvidence: [],
      relationalPermissions: {
        teasingPermitted: false,
        vulnerabilityPermitted: false,
        disagreePermitted: true,
        romanticPermitted: false,
        trustScore: 0.5,
        closenessScore: 0.5,
      },
    });

    expect(result.xmlBlock).toContain('<cognitive_context companion="amira" run_id="run_test_empty">');
    expect(result.xmlBlock).not.toContain('<authorized_epistemic_grounding');
    expect(result.deliveredCount).toBe(0);
    expect(result.tokenEstimate).toBeLessThan(200);
  });

  it('accurately estimates Arabic tokens with multibyte factor', () => {
    const arabicText = 'صباح الخير عامل ايه النهاردة؟';
    const tokens = estimateTokens(arabicText);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBe(Math.ceil(5 * 1.5)); // 5 words * 1.5 = 8
  });
});
