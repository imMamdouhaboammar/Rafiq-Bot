import {
  EpistemicEvidence,
  LifeMilestone,
  SocialMove,
  RelationalPermissions,
} from './types.js';
import type { PsychologicalState } from '../../types.js';
import type { CompanionContinuityState } from '../companionContinuity.js';

export interface ContextCompilationInput {
  runId: string;
  companionId: string;
  companionName?: string;
  socialMove: SocialMove;
  bubbleBudget: number;
  deliveredEvidence: EpistemicEvidence[];
  eraMilestone?: LifeMilestone;
  relationalPermissions: RelationalPermissions;
  psychologicalState?: PsychologicalState;
  continuityState?: CompanionContinuityState;
  maxTokens?: number;
}

export interface CompiledContextResult {
  xmlBlock: string;
  tokenEstimate: number;
  deliveredCount: number;
}

/**
 * Accurately estimates token count for mixed Arabic and Latin text.
 * Arabic UTF-8 characters average ~1.4 - 1.6 tokens per whitespace-separated word in Gemini/BPE.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean);
  let total = 0;
  for (const w of words) {
    // If word contains Arabic unicode characters, factor is ~1.5, else ~1.2
    const hasArabic = /[\u0600-\u06FF]/.test(w);
    total += hasArabic ? 1.5 : 1.2;
  }
  return Math.ceil(total);
}

export class CognitiveContextCompiler {
  public compile(input: ContextCompilationInput): CompiledContextResult {
    const {
      runId,
      companionId,
      companionName = 'Companion',
      socialMove,
      bubbleBudget,
      deliveredEvidence,
      eraMilestone,
      relationalPermissions,
      psychologicalState,
      continuityState,
    } = input;

    const mood = psychologicalState?.mood || 'neutral';
    const energy = psychologicalState?.energyLevel ?? 7;
    const appetite = energy <= 3 ? 'minimal' : energy >= 8 ? 'chatty' : 'medium';

    // Bounded active concerns / threads
    const concerns = (continuityState?.opinions || [])
      .slice(0, 3)
      .map(o => `${o.topic}: ${o.stance}`);
    const threads = (continuityState?.threads || [])
      .filter(t => t.status === 'active' || t.status === 'due')
      .slice(0, 3)
      .map(t => t.summary);

    const lines: string[] = [];
    lines.push(`<cognitive_context companion="${companionId}" run_id="${runId}">`);
    lines.push(`  <autonomic_frame>`);
    lines.push(`    <mood>${mood}</mood>`);
    lines.push(`    <energy_level>${energy}/10</energy_level>`);
    lines.push(`    <conversational_appetite>${appetite}</conversational_appetite>`);
    lines.push(`  </autonomic_frame>`);

    lines.push(`  <relational_boundary>`);
    lines.push(`    <trust_score>${relationalPermissions.trustScore}</trust_score>`);
    lines.push(`    <teasing_permitted>${relationalPermissions.teasingPermitted}</teasing_permitted>`);
    lines.push(`    <vulnerability_permitted>${relationalPermissions.vulnerabilityPermitted}</vulnerability_permitted>`);
    lines.push(`    <romantic_assumption_permitted>false</romantic_assumption_permitted>`);
    lines.push(`  </relational_boundary>`);

    lines.push(`  <strategic_move>`);
    lines.push(`    <suggested_social_move>${socialMove}</suggested_social_move>`);
    lines.push(`    <bubble_budget>${bubbleBudget}</bubble_budget>`);
    lines.push(`  </strategic_move>`);

    if (eraMilestone) {
      lines.push(`  <era_milestone title="${eraMilestone.eraTitle}">`);
      lines.push(`    ${eraMilestone.summaryText}`);
      lines.push(`  </era_milestone>`);
    }

    if (deliveredEvidence.length > 0) {
      lines.push(`  <authorized_epistemic_grounding notice="No ID, No Claim. Only state biographical facts from this list">`);
      for (const ep of deliveredEvidence) {
        lines.push(`    <point id="${ep.id}" tier="${ep.tier}" confidence="${ep.confidence}">${ep.text}</point>`);
      }
      lines.push(`  </authorized_epistemic_grounding>`);
    }

    if (concerns.length > 0 || threads.length > 0) {
      lines.push(`  <active_mental_threads>`);
      if (concerns.length > 0) lines.push(`    <concerns>${concerns.join('; ')}</concerns>`);
      if (threads.length > 0) lines.push(`    <threads>${threads.join('; ')}</threads>`);
      lines.push(`  </active_mental_threads>`);
    }

    lines.push(`  <negative_constraints>`);
    lines.push(`    - Answer directly in character (${companionName}); never sound like a helpful customer support AI.`);
    lines.push(`    - Do not invent autobiographical facts, medical crises, or events not present in authorized epistemic grounding.`);
    lines.push(`    - Casual banter and personal opinions do not require citations.`);
    lines.push(`  </negative_constraints>`);
    lines.push(`</cognitive_context>`);

    const xmlBlock = lines.join('\n');
    const tokenEstimate = estimateTokens(xmlBlock);

    return {
      xmlBlock,
      tokenEstimate,
      deliveredCount: deliveredEvidence.length,
    };
  }
}

export const defaultContextCompiler = new CognitiveContextCompiler();
