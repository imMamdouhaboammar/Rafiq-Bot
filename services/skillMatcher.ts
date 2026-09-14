import { normalizeArabicForSearch } from './lorebookEngine.js';
import type { SkillDefinition, SkillMatchResult } from '../types.js';

export interface MatchSkillOptions {
  explicitSkillId?: string;
  minScoreThreshold?: number;
}

/**
 * High-performance Zero-LLM matcher for Rafiq Skills.
 * Evaluates in sub-millisecond time on the client or server without external API calls or token cost.
 */
export function matchActiveSkill(
  userText: string,
  activeSkills: SkillDefinition[],
  options: MatchSkillOptions = {}
): SkillMatchResult | null {
  if (!userText || !activeSkills || activeSkills.length === 0) {
    return null;
  }

  const { explicitSkillId, minScoreThreshold = 5 } = options;

  // 1. Explicit Skill Override (from UI toggle or caller)
  if (explicitSkillId) {
    const explicitSkill = activeSkills.find(s => s.id === explicitSkillId);
    if (explicitSkill) {
      return {
        skill: explicitSkill,
        score: 100,
        triggerWord: explicitSkillId,
        matchedBy: 'explicit',
      };
    }
  }

  const trimmed = userText.trim();
  const lowerTrimmed = trimmed.toLowerCase();

  // 2. Slash Command Evaluation (/coach, /كوتش, /vent, /فضفضة, etc.)
  for (const skill of activeSkills) {
    const { slashCommand, arabicSlashAlias } = skill.triggers;

    if (slashCommand && (lowerTrimmed.startsWith(slashCommand + ' ') || lowerTrimmed === slashCommand)) {
      return {
        skill,
        score: 100,
        triggerWord: slashCommand,
        matchedBy: 'slash',
      };
    }

    if (arabicSlashAlias && (trimmed.startsWith(arabicSlashAlias + ' ') || trimmed === arabicSlashAlias)) {
      return {
        skill,
        score: 100,
        triggerWord: arabicSlashAlias,
        matchedBy: 'slash',
      };
    }
  }

  // 3. Zero-LLM Normalized Arabic Keyword Matching
  const normalizedInput = normalizeArabicForSearch(trimmed);
  if (!normalizedInput) return null;

  let bestMatch: SkillMatchResult | null = null;
  let highestScore = 0;

  for (const skill of activeSkills) {
    // Skills marked explicit-only do not auto-trigger
    if (skill.activationMode === 'explicit') continue;

    let skillScore = 0;
    let strongestWord = '';

    for (const keyword of skill.triggers.keywords) {
      const normKeyword = normalizeArabicForSearch(keyword);
      if (!normKeyword) continue;

      // Exact substring match
      if (normalizedInput.includes(normKeyword)) {
        // Multi-word keywords get higher weight; longer keywords indicate stronger intent
        const wordTokens = normKeyword.split(' ').length;
        const currentWordScore = normKeyword.length * 2 + wordTokens * 4;

        if (currentWordScore > skillScore) {
          skillScore = currentWordScore;
          strongestWord = keyword;
        }
      }
    }

    if (skillScore >= minScoreThreshold && skillScore > highestScore) {
      highestScore = skillScore;
      bestMatch = {
        skill,
        score: skillScore,
        triggerWord: strongestWord,
        matchedBy: 'keyword',
      };
    }
  }

  return bestMatch;
}

/**
 * Helper to strip slash command prefix from user text if present.
 */
export function stripSkillSlashCommand(text: string, matchedCommand?: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (matchedCommand && trimmed.startsWith(matchedCommand)) {
    return trimmed.slice(matchedCommand.length).trim();
  }
  // Generic slash command stripper
  if (trimmed.startsWith('/')) {
    const spaceIndex = trimmed.indexOf(' ');
    if (spaceIndex !== -1) {
      return trimmed.slice(spaceIndex + 1).trim();
    }
  }
  return trimmed;
}
