import { SocialMove, RelationalPermissions } from './types.js';
import type { PsychologicalState } from '../../types.js';
import type { CompanionContinuityState } from '../companionContinuity.js';
import { classifyConversationRoute, ConversationRouteId } from '../conversationRouter.js';

export interface SocialPlanResult {
  socialMove: SocialMove;
  bubbleCount: number;
  reason: string;
  relationalPermissions: RelationalPermissions;
}

const TEASING_PATTERNS = /(مغرور|يا عم|يا سيدي|فينك|نسيتنا|ضحكتني|عبيط|شايف نفسك|هزار|روست|roast|بترول|قلش)/i;
const OPINION_PATTERNS = /(رأيك|ايه رأيك|إيه رأيك|تفتكر|تفتكري|ايه التحليل|شايف ازاي|شايف إيه)/i;
const HELP_PATTERNS = /(مشكلة|عطل|كود|برمجة|حل|ساعدني|فلوس|شغل|ازاي اعمل|عايز أحل)/i;
const CHECKIN_PATTERNS = /(صباح الخير|مساء الخير|ازيك|عامل ايه|عاملة ايه|اخبارك|أخبارك|وحشتني|وحشتيني)/i;
const CLARIFY_PATTERNS = /(يعني ايه|مش فاهم|قصدك ايه|ازاي يعني|تقصد ايه|وضحلي)/i;
const TOPIC_SHIFT_PATTERNS = /(سيبك|نغير الموضوع|المهم|عموما|خلاص بقى|فكك)/i;

/**
 * Derives relational permissions deterministically from continuity and psychology.
 * Strictly prevents unearned intimacy or boundary violation.
 */
export function deriveRelationalPermissions(
  psychology?: PsychologicalState,
  continuity?: CompanionContinuityState
): RelationalPermissions {
  const intimacy = psychology?.intimacyLevel ?? 5; // 0-10
  const closeness = Math.max(0, Math.min(1, intimacy / 10));

  // Count expectations or positive thread history in continuity
  const expectationCount = continuity?.expectations?.length ?? 0;
  const threadCount = continuity?.threads?.filter(t => t.status === 'active' || t.status === 'resolved').length ?? 0;

  // Base trust score calculated from intimacy + established continuity evidence
  const evidenceBonus = Math.min(0.25, (expectationCount * 0.05) + (threadCount * 0.03));
  const trustScore = Math.max(0, Math.min(1, (closeness * 0.9) + evidenceBonus));

  return {
    closenessScore: Math.round(closeness * 100) / 100,
    trustScore: Math.round(trustScore * 100) / 100,
    // Teasing requires intimacy >= 6 and trust >= 0.60
    teasingPermitted: closeness >= 0.6 && trustScore >= 0.6,
    // Vulnerability requires intimacy >= 7 and trust >= 0.75
    vulnerabilityPermitted: closeness >= 0.7 && trustScore >= 0.75,
    // Disagree requires minimum mutual respect (trust >= 0.45)
    disagreePermitted: trustScore >= 0.45,
    // Romantic intimacy is NEVER implicitly assumed; strictly gated
    romanticPermitted: false,
  };
}

export class SocialMovePlanner {
  public planMove(
    userMessage: string,
    replyContextText?: string,
    psychology?: PsychologicalState,
    continuity?: CompanionContinuityState
  ): SocialPlanResult {
    const permissions = deriveRelationalPermissions(psychology, continuity);
    const cleanMsg = userMessage.trim();
    const route = classifyConversationRoute(cleanMsg, replyContextText);
    const energy = psychology?.energyLevel ?? 7; // 1-10

    // 1. Physical / Energy depletion -> Minimal Presence
    if (energy <= 2 || (psychology?.sleepiness !== undefined && psychology.sleepiness >= 80)) {
      return {
        socialMove: 'minimal_presence',
        bubbleCount: 1,
        reason: 'Low energy or fatigue demands brief, undemanding presence.',
        relationalPermissions: permissions,
      };
    }

    // 2. Venting route -> Comfort
    if (route.id === 'venting') {
      return {
        socialMove: 'comfort',
        bubbleCount: 2,
        reason: 'User is venting emotion or fatigue; provide immediate Egyptian comfort.',
        relationalPermissions: permissions,
      };
    }

    // 3. Social Nudge -> Check In / Acknowledge
    if (route.id === 'social-nudge') {
      return {
        socialMove: 'check_in',
        bubbleCount: 1,
        reason: 'User pinged after silence; casually check in with 1 brief bubble.',
        relationalPermissions: permissions,
      };
    }

    // 4. Callback opportunity from active continuity threads
    const activeThreads = continuity?.threads?.filter(t => t.status === 'active' || t.status === 'due') || [];
    if (activeThreads.length > 0) {
      for (const thread of activeThreads) {
        const keywords = thread.summary.split(/\s+/).filter(w => w.length > 3);
        const match = keywords.some(k => cleanMsg.includes(k));
        if (match) {
          return {
            socialMove: 'callback',
            bubbleCount: 2,
            reason: `Context matches active thread "${thread.summary}"; make a natural callback.`,
            relationalPermissions: permissions,
          };
        }
      }
    }

    // 5. Decision route -> Seek Opinion / Practical Help
    if (route.id === 'decision') {
      return {
        socialMove: 'seek_opinion',
        bubbleCount: 2,
        reason: 'User facing a fork or choice; take a clear stance.',
        relationalPermissions: permissions,
      };
    }

    // 6. Teasing permission gate
    if (TEASING_PATTERNS.test(cleanMsg) || route.id === 'banter') {
      if (permissions.teasingPermitted) {
        return {
          socialMove: 'tease',
          bubbleCount: 2,
          reason: 'Banter detected and relational trust allows playful teasing.',
          relationalPermissions: permissions,
        };
      }
      return {
        socialMove: 'acknowledge',
        bubbleCount: 1,
        reason: 'Banter detected but trust boundary is not yet high enough for teasing.',
        relationalPermissions: permissions,
      };
    }

    // 7. Clarify questions
    if (CLARIFY_PATTERNS.test(cleanMsg)) {
      return {
        socialMove: 'clarify',
        bubbleCount: 1,
        reason: 'User requested clarification.',
        relationalPermissions: permissions,
      };
    }

    // 8. Practical Help
    if (HELP_PATTERNS.test(cleanMsg)) {
      return {
        socialMove: 'practical_help',
        bubbleCount: 2,
        reason: 'User requested assistance with a practical or technical issue.',
        relationalPermissions: permissions,
      };
    }

    // 9. Topic Shift
    if (TOPIC_SHIFT_PATTERNS.test(cleanMsg)) {
      return {
        socialMove: 'topic_shift',
        bubbleCount: 1,
        reason: 'User signaled desire to move past the current topic.',
        relationalPermissions: permissions,
      };
    }

    // 10. Greetings
    if (CHECKIN_PATTERNS.test(cleanMsg) && cleanMsg.length < 30) {
      return {
        socialMove: 'check_in',
        bubbleCount: 1,
        reason: 'Casual greeting or check-in.',
        relationalPermissions: permissions,
      };
    }

    // 11. Very short messages -> Acknowledge
    if (cleanMsg.length <= 15) {
      return {
        socialMove: 'acknowledge',
        bubbleCount: 1,
        reason: 'Very short user message warrants concise acknowledgment.',
        relationalPermissions: permissions,
      };
    }

    // 12. Default -> Answer
    return {
      socialMove: 'answer',
      bubbleCount: cleanMsg.length > 100 ? 2 : 1,
      reason: 'Standard conversational response.',
      relationalPermissions: permissions,
    };
  }
}

export const defaultSocialMovePlanner = new SocialMovePlanner();
