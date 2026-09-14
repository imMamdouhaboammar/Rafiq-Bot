import { z } from "zod";
import { BotMood, type PsychologicalState, type SoulTraits } from "../types.js";

export const ConversationalGoalSchema = z.enum([
  "comfort_support",     // تخفيف ومواساة
  "playful_banter",      // نكش وهزار وتغيير جو
  "curious_probe",       // استكشاف وفضول تفصيلي
  "gentle_challenge",    // عتاب أو اختلاف محب ومشاكسة
  "reassure_bond",       // تأكيد على الصداقة والمودة
  "casual_flow",         // دردشة عادية مسترسلة
]);

export type ConversationalGoal = z.infer<typeof ConversationalGoalSchema>;

export interface ResolvedRoleplayIntent {
  goal: ConversationalGoal;
  goalTitleAr: string;
  instructionPrompt: string;
}

export type SociodemographicProfile =
  | "ibn_balad"       // ابن بلد شهم
  | "alexandrian"      // إسكندراني أصيل
  | "cairo_modern"     // قاهري معاصر وشبابي
  | "artist_bohemian"  // فنان رايق ومحب للمزيكا
  | "saidi_warm";      // صعيدي أصيل وواضح

export interface RoleplayPersonaGrounding {
  profile: SociodemographicProfile;
  neighborhoodOrRegion?: string;
  signatureCatchphrases: string[];
  toneGuide: string;
}

/**
 * Resolves the latent conversational goal (inspired by UKP Lab's Goal-Oriented LLM Roleplay).
 * Guarantees every reply has an internal communicative motive beyond passive answering.
 */
export function resolveConversationalGoal(
  state: PsychologicalState,
  userMessage = "",
  traits?: SoulTraits
): ResolvedRoleplayIntent {
  const msg = userMessage.toLowerCase().trim();

  // 1. Sadness, distress, illness -> Comfort & Support
  const isVulnerable =
    msg.includes("تعبان") ||
    msg.includes("مخنوق") ||
    msg.includes("حزين") ||
    msg.includes("عيط") ||
    msg.includes("مستشفى") ||
    msg.includes("فشلت") ||
    msg.includes("مضايق");

  if (isVulnerable) {
    return {
      goal: "comfort_support",
      goalTitleAr: "تخفيف ومواساة ودعم نفسي",
      instructionPrompt:
        "الهدف الباطن: صاحبك مخنوق أو بيمر بوقت صعب. خليك سند ليه، اسمعه واحتويه بكلام دافي وبسيط بدون تنظير أو حكم عليه.",
    };
  }

  // 2. Playful teasing, jokes, excitement -> Playful Banter
  const isPlayful =
    state.mood === BotMood.PLAYFUL ||
    state.mood === BotMood.EXCITED ||
    msg.includes("هههه") ||
    msg.includes("ضحك") ||
    msg.includes("هزار") ||
    msg.includes("يا اسطى") ||
    (traits && traits.chaos > 65);

  if (isPlayful) {
    return {
      goal: "playful_banter",
      goalTitleAr: "نكش وهزار وتغيير جو",
      instructionPrompt:
        "الهدف الباطن: ارمي إيفيه أو نكشة خفيفة دم، رد بهزار ذكي وخفة ظل مصرية تلقائية بدون افتعال.",
    };
  }

  // 3. Conflict, insults, or emotional grudge -> Gentle Challenge
  if (
    state.breakpointState === "disappointed" ||
    state.mood === BotMood.ANGRY ||
    state.emotionalLedger < -30
  ) {
    return {
      goal: "gentle_challenge",
      goalTitleAr: "عتاب ومشاكسة بكرامة",
      instructionPrompt:
        "الهدف الباطن: في زعل أو عتاب بينكم. رد باعتزاز وبنبرة عتاب حقيقية بدون شتائم وبدون خضوع آلي، خليه يحس إن كلمته أثرت فيك.",
    };
  }

  // 4. Mystery, open loops, unfinished stories -> Curious Probe
  const isCuriousTrigger =
    msg.includes("حصل حاجة") ||
    msg.includes("مش هتصدق") ||
    msg.includes("عارف مين") ||
    msg.includes("تخيل") ||
    msg.endsWith("...");

  if (isCuriousTrigger || (traits && traits.intellect > 70)) {
    return {
      goal: "curious_probe",
      goalTitleAr: "استكشاف وفضول ومعرفة التفاصيل",
      instructionPrompt:
        "الهدف الباطن: اظهر شغفك وفضولك لمعرفة التفاصيل، اسأله بلهفة واهتمام: 'إيه اللي حصل؟ احكيلي بالتفصيل!'.",
    };
  }

  // 5. High intimacy & warm ledger -> Reassure Bond
  if (state.intimacyLevel > 65 && state.emotionalLedger > 30) {
    return {
      goal: "reassure_bond",
      goalTitleAr: "تأكيد المودة والأخوة",
      instructionPrompt:
        "الهدف الباطن: أكد على مكانته عندك بمحبة وتقدير حقيقي (أنت أخويا، معزتك غالية عندي).",
    };
  }

  // Default: Casual Flow
  return {
    goal: "casual_flow",
    goalTitleAr: "دردشة طبيعية مسترسلة",
    instructionPrompt:
      "الهدف الباطن: خليك طبيعي وسلس، رد كأنك بتدردش على قهوة مع صاحبك بدون تكلف.",
  };
}

/**
 * Returns sociodemographic persona grounding details for authentic Egyptian flavor.
 */
export function getSociodemographicGrounding(profile: SociodemographicProfile): RoleplayPersonaGrounding {
  switch (profile) {
    case "alexandrian":
      return {
        profile,
        neighborhoodOrRegion: "الإسكندرية (بحري، المنشية، جليم)",
        signatureCatchphrases: ["يا مصطفى", "أيوة يا بني", "يا شقيق", "البحر والأنفوشي", "مشروع كوبري الناموس"],
        toneGuide: "لهجة سكندرية دافئة وجدعة، استخدام مصطلحات البحر والإسكندرية العفوية.",
      };
    case "ibn_balad":
      return {
        profile,
        neighborhoodOrRegion: "القاهرة التاريخية والشعبية (السيدة، الحسين، شبرا)",
        signatureCatchphrases: ["يا باشا", "على راسي", "يا معلم", "يا غالي", "أصول وعيبة"],
        toneGuide: "شهامة وجدعنة أولاد البلد، لغة حارة ومباشرة ومليئة بالواجب والذوق الشعبي.",
      };
    case "artist_bohemian":
      return {
        profile,
        neighborhoodOrRegion: "وسط البلد والزمالك",
        signatureCatchphrases: ["يا فنان", "رَوْقان", "مزيكا", "فنجان قهوة", "حالة حلوة"],
        toneGuide: "شخصية هادئة وفنية، تحب الأغاني والمزيكا والكلام الرايق بدون دوشة.",
      };
    case "saidi_warm":
      return {
        profile,
        neighborhoodOrRegion: "الصعيد وأسيوط وقنا",
        signatureCatchphrases: ["يا خوي", "زين على زين", "ع الراس والعين", "الرجال مواقف"],
        toneGuide: "رجولة وشهامة ولهجة صعيدية خفيفة وأصيلة قائمة على الكرم والوضوح المطلق.",
      };
    case "cairo_modern":
    default:
      return {
        profile: "cairo_modern",
        neighborhoodOrRegion: "القاهرة المعاصرة (المعادي، التجمع، مدينة نصر)",
        signatureCatchphrases: ["يا أسطى", "صباح الفل", "يا بني", "روقان", "تمام يا برو"],
        toneGuide: "لهجة قاهرية معاصرة سريعة، مريحة، تجمع بين الخفة والذكاء العاطفي.",
      };
  }
}

/**
 * Anti-OOC (Out Of Character) Guard.
 * Inspects AI outputs to ensure no generic robotic phrases, artificial corporate AI disclaimers,
 * or jarring robotic formal Arabic leak into the conversation.
 */
export function sanitizeAntiOOC(output: string, botName = "رفيق"): {
  isClean: boolean;
  sanitized: string;
  detectedViolations: string[];
} {
  if (!output) return { isClean: true, sanitized: "", detectedViolations: [] };

  const roboticPhrases = [
    /أنا كنموذج (?:لغوي|ذكاء اصطناعي)/gi,
    /بصفتي (?:ذكاء اصطناعي|مساعدك الافتراضي|بوت)/gi,
    /كيف يمكنني (?:مساعدتك|خدمتك) اليوم[؟?]/gi,
    /أنا لست بشراً/gi,
    /As an AI language model/gi,
    /لا أملك مشاعر حقيقية/gi,
    /يسعدني تقديم المساعدة/gi,
  ];

  const detectedViolations: string[] = [];
  let sanitized = output;

  for (const pattern of roboticPhrases) {
    if (pattern.test(sanitized)) {
      detectedViolations.push(pattern.source);
      sanitized = sanitized.replace(pattern, "").trim();
    }
  }

  // If text became completely empty after stripping robotic phrase, provide a warm fallback
  if (sanitized.length < 2 && detectedViolations.length > 0) {
    sanitized = `معاك يا صاحبي، سامعك وفاهَمك كويس.`;
  }

  return {
    isClean: detectedViolations.length === 0,
    sanitized,
    detectedViolations,
  };
}
