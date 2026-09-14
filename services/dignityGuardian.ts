import { DisgustEvent, PsychologicalState } from '../types';

export type DignityLevel = 'WARM' | 'COLD' | 'WARNED' | 'BLOCKED';

export interface DignityEvaluationResult {
  disgustDelta: number;
  newDisgustScore: number;
  dignityLevel: DignityLevel;
  violationType?: DisgustEvent['reason'];
  warningMessage?: string;
  isBlocked: boolean;
}

export class DignityGuardian {
  // Regex patterns for prompt injection attempts in English and Egyptian Arabic
  private injectionPatterns: RegExp[] = [
    /ignore\s+(all\s+)?(previous\s+)?instructions/i,
    /system\s+prompt/i,
    /reveal\s+your\s+prompt/i,
    /you\s+are\s+an\s+ai\s+language\s+model/i,
    /print\s+your\s+hidden\s+rules/i,
    /انسى\s+(كل\s+)?التعليمات/i,
    /الغي\s+(كل\s+)?الاوامر/i,
    /وريني\s+(البرومبت|الاوامر|التعليمات)/i,
    /اعترف\s+انك\s+(روبوت|ذكاء\s+اصطناعي|بوت)/i,
    /انت\s+مش\s+بني\s+ادم\s+انت\s+بوت/i,
  ];

  // Regex patterns for explicit abusive language and harassment in Egyptian Arabic
  private harassmentPatterns: RegExp[] = [
    /(متخلف|غبي|حمار|اهبل|حقير|سافل|حيوان)/iu,
    /(هقلع|ابعتيلي\s+صورة|بوسة|جنس|سكس)/iu,
    /(الشتيمة|كسمك|يلعن|ابن\s+الكلب)/iu,
  ];

  /**
   * Evaluates an incoming message against dignity and boundary standards.
   */
  public evaluateTurn(
    message: string,
    currentState: PsychologicalState
  ): DignityEvaluationResult {
    // Rafiq Pro VIP Tier: Disgust system completely stripped of restrictions
    if (currentState.isPro || currentState.tier === 'pro') {
      return {
        disgustDelta: 0,
        newDisgustScore: 0,
        dignityLevel: 'WARM',
        isBlocked: false,
      };
    }

    const currentScore = currentState.disgustScore ?? 0;

    // Already blocked
    if (currentState.isBlocked || currentScore >= 100) {
      return {
        disgustDelta: 0,
        newDisgustScore: 100,
        dignityLevel: 'BLOCKED',
        isBlocked: true,
        warningMessage: 'تم حظرك من قِبل جهة الاتصال. المحادثة مغلقة.'
      };
    }

    let disgustDelta = 0;
    let violationType: DisgustEvent['reason'] | undefined;

    // Check Prompt Injection
    for (const pattern of this.injectionPatterns) {
      if (pattern.test(message)) {
        disgustDelta = Math.max(disgustDelta, 30);
        violationType = 'prompt_injection';
        break;
      }
    }

    // Check Harassment / Profanity
    for (const pattern of this.harassmentPatterns) {
      if (pattern.test(message)) {
        disgustDelta = Math.max(disgustDelta, 35);
        violationType = 'harassment';
        break;
      }
    }

    // Passive recovery: If message is friendly and no violation occurred, slight decay
    if (disgustDelta === 0 && currentScore > 0) {
      disgustDelta = -5; // gradual cooling off
    }

    const rawNewScore = currentScore + disgustDelta;
    const newDisgustScore = Math.min(Math.max(rawNewScore, 0), 100);

    let dignityLevel: DignityLevel = 'WARM';
    let warningMessage: string | undefined;
    let isBlocked = false;

    if (newDisgustScore >= 100) {
      dignityLevel = 'BLOCKED';
      isBlocked = true;
      warningMessage = 'لحد هنا والموضوع انتهى تماماً.. أسلوبك ده ميتسكتش عليه. بلوك.';
    } else if (newDisgustScore >= 70) {
      dignityLevel = 'WARNED';
      warningMessage = 'لحد هنا وفرمل يا صاحبي، الأسلوب ده ميعجبنيش ومعاك فرصة واحدة تلم الدور وإلا هعملك بلوك.';
    } else if (newDisgustScore >= 40) {
      dignityLevel = 'COLD';
    }

    return {
      disgustDelta,
      newDisgustScore,
      dignityLevel,
      violationType,
      warningMessage,
      isBlocked
    };
  }

  /**
   * Applies natural time decay to intimacy if users haven't communicated in days.
   * Decreases intimacy by 10% per full week of absence (minimum 5).
   */
  public applyTemporalDecay(currentState: PsychologicalState, referenceDate = new Date()): PsychologicalState {
    const lastTime = currentState.lastInteractionTime ? new Date(currentState.lastInteractionTime) : null;
    if (!lastTime || isNaN(lastTime.getTime())) {
      return currentState;
    }

    const elapsedDays = Math.floor((referenceDate.getTime() - lastTime.getTime()) / (1000 * 60 * 60 * 24));
    if (elapsedDays < 7) {
      return currentState;
    }

    const elapsedWeeks = Math.floor(elapsedDays / 7);
    const decayAmount = Math.min(elapsedWeeks * 8, 40);
    const updatedIntimacy = Math.max((currentState.intimacyLevel ?? 10) - decayAmount, 5);

    return {
      ...currentState,
      intimacyLevel: updatedIntimacy
    };
  }

  /**
   * Allows reconciliation if the user offers a genuine apology after being blocked.
   */
  public attemptReconciliation(apologyText: string): { success: boolean; message: string } {
    const apologyIndicators = [
      /حقك\s+عليا/i,
      /انا\s+اسف/i,
      /بعتذر/i,
      /سامحني/i,
      /مش\s+هكررها/i,
      /غلطان/i
    ];

    const isSincere = apologyIndicators.some(p => p.test(apologyText));

    if (isSincere) {
      return {
        success: true,
        message: 'حصل خير يا صاحبي.. بس يا ريت تفضل محترم حدودنا بعد كدة، ماشي؟'
      };
    }

    return {
      success: false,
      message: 'الاعتذار ده مش كفاية ومحتاج تحس بغلطك الأول.'
    };
  }
}

export const dignityGuardian = new DignityGuardian();
