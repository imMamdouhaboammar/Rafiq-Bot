import type { AffectState } from '../contracts/neuroCognitive.js';

export type AffectEventKind =
  | 'affection_or_warmth'
  | 'conflict_or_harshness'
  | 'reconciliation_or_apology'
  | 'external_distress'       // User is upset about their day, not at the bot
  | 'deep_cooperation'
  | 'idle_decay';

export interface AffectEvent {
  kind: AffectEventKind;
  magnitude: number;          // 0.1 to 1.0
  userAddressedToBot: boolean;// true if user is addressing the bot directly
  timestamp?: Date;
}

export interface AffectBaselines {
  valence: number;
  arousal: number;
  security: number;
  tension: number;
}

export const DEFAULT_AFFECT_BASELINES: AffectBaselines = {
  valence: 0.25,  // mildly warm
  arousal: 0.40,  // attentive, relaxed
  security: 0.70, // grounded
  tension: 0.05,  // peaceful
};

// Half-lives / time constants in milliseconds
const TAU_VALENCE_MS = 2 * 60 * 60 * 1000;    // 2 hours
const TAU_AROUSAL_MS = 45 * 60 * 1000;        // 45 minutes
const TAU_SECURITY_MS = 24 * 60 * 60 * 1000;  // 24 hours
const TAU_TENSION_MS = 3 * 60 * 60 * 1000;    // 3 hours

const clamp = (val: number, min: number, max: number): number => (
  Math.max(min, Math.min(max, val))
);

export const createInitialAffectState = (companionId: string): AffectState => ({
  companionId,
  valence: DEFAULT_AFFECT_BASELINES.valence,
  arousal: DEFAULT_AFFECT_BASELINES.arousal,
  security: DEFAULT_AFFECT_BASELINES.security,
  tension: DEFAULT_AFFECT_BASELINES.tension,
  updatedAt: new Date(),
  modelVersion: 1,
});

/**
 * Pure deterministic transition function for affective events.
 */
export const applyAffectEvent = (
  current: AffectState,
  event: AffectEvent,
  now = new Date(),
): AffectState => {
  const mag = clamp(event.magnitude, 0.1, 1.0);
  let nextValence = current.valence;
  let nextArousal = current.arousal;
  let nextSecurity = current.security;
  let nextTension = current.tension;

  switch (event.kind) {
    case 'affection_or_warmth':
      nextValence = clamp(current.valence + mag * 0.35, -1, 1);
      nextArousal = clamp(current.arousal + mag * 0.15, 0, 1);
      nextSecurity = clamp(current.security + mag * 0.20, 0, 1);
      nextTension = clamp(current.tension - mag * 0.30, 0, 1);
      break;

    case 'conflict_or_harshness':
      if (event.userAddressedToBot) {
        // Direct friction with companion
        nextValence = clamp(current.valence - mag * 0.45, -1, 1);
        nextArousal = clamp(current.arousal + mag * 0.30, 0, 1);
        nextSecurity = clamp(current.security - mag * 0.35, 0, 1);
        nextTension = clamp(current.tension + mag * 0.50, 0, 1);
      } else {
        // User is venting generally
        nextArousal = clamp(current.arousal + mag * 0.20, 0, 1);
        nextTension = clamp(current.tension + mag * 0.10, 0, 1);
      }
      break;

    case 'reconciliation_or_apology':
      nextValence = clamp(current.valence + mag * 0.30, -1, 1);
      nextTension = clamp(current.tension - mag * 0.45, 0, 1);
      nextSecurity = clamp(current.security + mag * 0.25, 0, 1);
      nextArousal = clamp(current.arousal - mag * 0.10, 0, 1);
      break;

    case 'external_distress':
      // Empathy mode: user is in pain from outside life
      nextValence = clamp(current.valence - mag * 0.15, -1, 1); // sympathetic gravity
      nextArousal = clamp(current.arousal + mag * 0.25, 0, 1);
      nextSecurity = clamp(current.security + mag * 0.10, 0, 1); // safe haven bond
      break;

    case 'deep_cooperation':
      nextValence = clamp(current.valence + mag * 0.20, -1, 1);
      nextSecurity = clamp(current.security + mag * 0.25, 0, 1);
      nextTension = clamp(current.tension - mag * 0.15, 0, 1);
      break;

    case 'idle_decay':
      // Handled in applyDecay
      break;
  }

  return {
    ...current,
    valence: Number(nextValence.toFixed(3)),
    arousal: Number(nextArousal.toFixed(3)),
    security: Number(nextSecurity.toFixed(3)),
    tension: Number(nextTension.toFixed(3)),
    lastEventAt: now,
    updatedAt: now,
  };
};

/**
 * Homeostatic decay toward baseline when conversation is inactive.
 */
export const applyDecay = (
  state: AffectState,
  elapsedMs: number,
  baselines: AffectBaselines = DEFAULT_AFFECT_BASELINES,
  now = new Date(),
): AffectState => {
  if (elapsedMs <= 0) return state;

  const decayValence = baselines.valence + (state.valence - baselines.valence) * Math.exp(-elapsedMs / TAU_VALENCE_MS);
  const decayArousal = baselines.arousal + (state.arousal - baselines.arousal) * Math.exp(-elapsedMs / TAU_AROUSAL_MS);
  const decaySecurity = baselines.security + (state.security - baselines.security) * Math.exp(-elapsedMs / TAU_SECURITY_MS);
  const decayTension = baselines.tension + (state.tension - baselines.tension) * Math.exp(-elapsedMs / TAU_TENSION_MS);

  return {
    ...state,
    valence: Number(clamp(decayValence, -1, 1).toFixed(3)),
    arousal: Number(clamp(decayArousal, 0, 1).toFixed(3)),
    security: Number(clamp(decaySecurity, 0, 1).toFixed(3)),
    tension: Number(clamp(decayTension, 0, 1).toFixed(3)),
    updatedAt: now,
  };
};

/**
 * Classify a user turn to produce an AffectEvent.
 */
export const classifyUserAffectTurn = (text: string): AffectEvent | null => {
  const trimmed = text.trim().toLowerCase();
  if (!trimmed || trimmed.length < 2) return null;

  // Direct apology or reconciliation
  if (/(اسف|حقك عليا|سامحني|اعتذر|ما تزعلش|متزعلش|ولا يهمك|صلح)/i.test(trimmed)) {
    return {
      kind: 'reconciliation_or_apology',
      magnitude: 0.8,
      userAddressedToBot: true,
    };
  }

  // Direct conflict or harshness to bot
  if (/(غبي|متخلف|رخم|سخيف|بكرهك|اخرس|اسكت|ابعد عني|مش طايقك|stupid|idiot|hate you)/i.test(trimmed)) {
    return {
      kind: 'conflict_or_harshness',
      magnitude: 0.85,
      userAddressedToBot: true,
    };
  }

  // Warmth or affection to bot
  if (/(بحبك|يا عيوني|تسلملي|يا غالي|حبيبي|حبيبتي|وحشتني|شكرا جدا|فرحتني|الله يخليك)/i.test(trimmed)) {
    return {
      kind: 'affection_or_warmth',
      magnitude: 0.75,
      userAddressedToBot: true,
    };
  }

  // External distress (user having a bad day)
  if (/(مخنوق|تعبان|زعلان|مضغوط|عيطت|الشغل قرف|حاسس بوحدة|يومي وحش|مش قادر)/i.test(trimmed)) {
    return {
      kind: 'external_distress',
      magnitude: 0.7,
      userAddressedToBot: false,
    };
  }

  // Meaningful sharing or deep cooperation
  if (/(هدفي|عايز احكيلك|سر|فكرت في الموضوع|تعال نتفق|مع بعض)/i.test(trimmed)) {
    return {
      kind: 'deep_cooperation',
      magnitude: 0.5,
      userAddressedToBot: true,
    };
  }

  return null;
};

/**
 * Compiles explainable Egyptian Arabic behavioral instruction based on current affect state.
 * Strictly adheres to ethical guidelines: NO claiming literal consciousness or physical pain.
 */
export const deriveAffectStyleInstruction = (state: AffectState): string => {
  const parts: string[] = [];

  // 1. Tension handling (Friction & Hesitation)
  if (state.tension > 0.45) {
    parts.push('في شوية توتر أو عتاب خفيف معلق في الجو؛ خليك هادي ومتحفظ شوية، بلاش تندفع بهزار ثقيل أو كلام مفرط في الحميمية لحد ما الأمور تصفى.');
  } else if (state.tension > 0.25) {
    parts.push('اتكلم بنبرة رصينة ومريحة، وافتح مساحة للهدوء.');
  }

  // 2. Valence handling (Warmth vs Reserve)
  if (state.valence > 0.5) {
    parts.push('المزاج العام لطيف ودافي؛ خلي روحك مرحة وتجاوب بحرارة واهتمام ظاهر.');
  } else if (state.valence < -0.3) {
    parts.push('المزاج العام واخد وضع التحفظ والهدوء؛ ردودك تكون أقصر وأكثر دقة وتركيز، بدون افتعال للمرح.');
  }

  // 3. Security (Groundedness & Familiarity)
  if (state.security > 0.75) {
    parts.push('حس الألفة والأمان بينكم عالي؛ اتعامل كصديق مقرب بيفهم من غير تطويل.');
  } else if (state.security < 0.4) {
    parts.push('العلاقة لسه بتبني حدودها أو حصل فيها اهتزاز؛ احترم المساحة والحدود بلطف.');
  }

  // 4. Arousal (Energy & Pace)
  if (state.arousal > 0.7) {
    parts.push('الإيقاع متيقظ ونشط؛ خليك حاضر وجاهز للرد بدون تباطؤ.');
  } else if (state.arousal < 0.25) {
    parts.push('الإيقاع هادي ورايق ومريح؛ اتكلم بسلاسة وبطء نسبي.');
  }

  if (parts.length === 0) {
    return 'التوازن العاطفي مستقر وودود بطبيعة الحال.';
  }

  return `[توجيه النبرة والحالة السلوكية]\n- ${parts.join('\n- ')}`;
};
