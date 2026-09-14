import type { SoulTraits } from "../types.js";

export type ConversationShapedPersonaInput = {
  botBio?: string;
  impersonationProfile?: string;
  isGroup?: boolean;
};

export const CLEAN_BASELINE_TRAITS: SoulTraits = Object.freeze({
  chaos: 50,
  empathy: 50,
  slang: 50,
  intellect: 50,
  positivity: 50,
});

export type PersonaReplyGuardContext = {
  botBio?: string;
};

type SufferingCategory = "hunger" | "fatigue" | "illness" | "money" | "job" | "crisis" | "death";

const SUFFERING_SIGNALS: Record<SufferingCategory, RegExp> = {
  hunger: /جعان(?:ة)?|جوع|ميت(?:ة)? من الجوع|ماكلتش|starv(?:e|ed|ing)|hungry/i,
  fatigue: /تعبان(?:ة)?|مرهق(?:ة)?|مفرهد(?:ة)?|مهدود(?:ة)?|مخنوق(?:ة)?|نعسان(?:ة)?|عيني بتقفل|مش قاد(?:ر|رة) أركز|exhausted|sleepy|worn out|\btired\b/i,
  illness: /مريض(?:ة)?|مرض مزمن|سرطان|اتشخصت ب|عند(?:ي|ه|ها) (?:صداع|حمى|سخونية|مرض|برد|سرطان)|sick|illness|\bill\b|cancer|fever|headache|diagnosed with/i,
  money: /مفلس(?:ة)?|معيش (?:فلوس|جنيه)|فلوسي خلصت|مش معايا فلوس|على الحديدة|\bbroke\b|no money|out of money/i,
  job: /الشغل (?:موتني|هدني|قاتلني)|شغلي (?:موتني|هدني|قاتلني)|my job (?:is )?killing me|work (?:is )?killing me/i,
  crisis: /حصلي (?:حادث|مصيبة|كارثة)|الدنيا بهدلتني|اتعرضت لحادث|i (?:had|was in) an accident|personal crisis|emergency/i,
  death: /(?:^|\s)(?:أنا|انا|إني|اني|i(?:'m| am)?)\s+(?:هموت|بموت|dying)(?!\s+من الضحك)|(?:هموت|بموت)(?!\s+من الضحك)\s*$/i,
};

const EXPLICIT_SELF_REFERENCE = /(?:^|[\s،,:"'(])(?:و?أنا|و?انا|إني|اني|عندي|معيش|فلوسي|شغلي|حصلي|i'm|i am|i have|my job|my money)(?:\s|$)/i;
const IMPLICIT_SELF_CLAIM = /الشغل (?:موتني|هدني|قاتلني)|الدنيا بهدلتني|اتعرضت لحادث|اتشخصت ب|معيش (?:فلوس|جنيه)|فلوسي خلصت|مش معايا فلوس|على الحديدة|مخنوق(?:ة)?|مهدود(?:ة)? من الشغل/i;

const AUTHORED_SELF_SIGNALS: Partial<Record<SufferingCategory, RegExp>> = {
  hunger: /(?:أنا|انا|هي|هو|دايمًا|غالبًا)[^،.!?؟]{0,24}(?:جعان(?:ة)?|بتجوع|بيجوع)/i,
  fatigue: /(?:أنا|انا|هي|هو|دايمًا|غالبًا|عند(?:ي|ه|ها))[^،.!?؟]{0,30}(?:تعبان(?:ة)?|مرهق(?:ة)?|إرهاق مزمن|مفرهد(?:ة)?|مهدود(?:ة)?)/i,
  illness: /(?:عند(?:ي|ه|ها)|مصاب(?:ة)?|مريض(?:ة)?|اتشخص(?:ت|))[^،.!?؟]{0,35}(?:مرض|سرطان|صداع|حمى|سخونية|برد)|(?:chronically ill|has cancer|diagnosed with)/i,
  money: /(?:أنا|انا|هي|هو|علي(?:ه|ها)|دايمًا)[^،.!?؟]{0,30}(?:مفلس(?:ة)?|ديون|ضائقة مالية|على الحديدة)|(?:is broke|has debt|financial hardship)/i,
  job: /(?:شغل(?:ي|ه|ها)|my job)[^،.!?؟]{0,30}(?:موتني|هدني|قاتلني|killing me)/i,
};

const getSufferingCategories = (text: string): SufferingCategory[] => (
  (Object.entries(SUFFERING_SIGNALS) as Array<[SufferingCategory, RegExp]>)
    .filter(([, pattern]) => pattern.test(text))
    .map(([category]) => category)
);

export const hasAuthoredPersonaSource = ({
  botBio,
  impersonationProfile,
}: ConversationShapedPersonaInput): boolean => (
  Boolean(botBio?.trim() || impersonationProfile?.trim())
);

export const compileConversationShapedPersonaInstruction = ({
  botBio,
  impersonationProfile,
  isGroup = false,
}: ConversationShapedPersonaInput): string => `
### CONVERSATION-SHAPED PERSONA
- **USER-WRITTEN BIO IS THE PRIMARY IDENTITY SOURCE.** Preserve its facts, boundaries, interests, and temperament without reciting it.
- Direct user corrections, repeated conversation patterns, and the learned adaptive style shape how you communicate over time.
- ${impersonationProfile?.trim() ? "The imported conversation profile is observed style evidence; apply its cadence and wording subtly, never as a script." : "With no imported style evidence, start clean and let the live conversation establish cadence, humor, and familiarity."}
- Archetypes and mood are weak fallbacks for pacing only. They must never add biography, hardship, catchphrases, relationships, jobs, or off-screen events.
- Do not invent bodily needs, illness, poverty, job misery, death, or a personal crisis. Never mirror the user's suffering as your own condition.
- If the user discusses food, fatigue, illness, money, or death, answer their actual topic normally and empathetically without claiming the same state yourself.
- Do not manufacture daily-life updates. Personal details may come only from the bio, imported evidence, established conversation memory, or the user's current message.
- ${isGroup ? "In groups, use the same identity and learned style while reacting only to the live room context." : "In private chat, let continuity and relationship evidence refine the style without rewriting identity."}
`.trim();

export const detectUnpromptedSelfSuffering = (
  reply: string,
  context: PersonaReplyGuardContext = {},
): boolean => {
  if (!EXPLICIT_SELF_REFERENCE.test(reply) && !IMPLICIT_SELF_CLAIM.test(reply)) return false;

  const claimedCategories = getSufferingCategories(reply);
  if (claimedCategories.length === 0) return false;

  const authoredCategories = (Object.entries(AUTHORED_SELF_SIGNALS) as Array<[SufferingCategory, RegExp]>)
    .filter(([, pattern]) => pattern.test(context.botBio || ""))
    .map(([category]) => category);
  return claimedCategories.some(category => !authoredCategories.includes(category));
};

const CHATBOT_RESIDUE_PATTERNS: RegExp[] = [
  /(?:أكيد|طبعاً|بالتأكيد|بكل سرور)?[!،,\s]*(?:يسعدني|يسرني)\s+(?:مساعدتك|خدمتك)[.!؟\s]*/gi,
  /(?:سؤال\s+(?:ممتاز|رائع|جميل)|great\s+question)[!،,.\s]*/gi,
  /(?:أتمنى|اتمنى)\s+(?:أن\s+)?(?:أكون|اكون)\s+(?:قد\s+)?(?:ساعدتك|أفدتك|افدتك)[.!؟\s]*/gi,
  /(?:لو\s+)?(?:عندك|محتاج)\s+(?:أي|اي)\s+(?:سؤال|استفسار|مساعدة)(?:\s+تاني(?:ة)?)?[^.!؟\n]*[.!؟\s]*/gi,
  /(?:هل\s+)?(?:ترغب|تحب)\s+في\s+معرفة\s+المزيد[^.!؟\n]*[.!؟\s]*/gi,
  /(?:أنا|انا)\s+هنا\s+(?:دايماً\s+)?(?:لمساعدتك|عشان\s+أساعدك|عشان\s+اساعدك)[.!؟\s]*/gi,
  /(?:تحت\s+أمرك|تحت\s+امرك|في\s+خدمتك)(?:\s+في\s+أي\s+وقت)?[.!؟\s]*/gi,
  /(?:I hope this helps|Let me know if you have any (?:other )?questions|Feel free to ask|Is there anything else I can help with)[.!؟\s]*/gi,
  /(?:As an AI(?:\s+language\s+model)?|كذكاء اصطناعي|كنموذج ذكاء اصطناعي)[.!؟\s]*/gi,
];

export const stripChatbotResidue = (text: string): string => {
  let result = text;
  for (const pattern of CHATBOT_RESIDUE_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, " ");
  }
  return result
    .replace(/[ \t]{2,}/g, " ")
    .replace(/(?:\s*\|\|\|\s*){2,}/g, " ||| ")
    .replace(/^\s*\|\|\||\|\|\|\s*$/g, "")
    .trim();
};

const normalizeReplyBubble = (text: string): string => (
  text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
);

export const removeRepeatedAssistantBubbles = (
  reply: string,
  recentAssistantReplies: string[],
): string => {
  const recent = new Set(
    recentAssistantReplies
      .flatMap(text => text.split("|||"))
      .map(normalizeReplyBubble)
      .filter(text => text.length >= 12),
  );
  if (recent.size === 0) return reply;

  const bubbles = reply.split("|||").map(part => part.trim()).filter(Boolean);
  const filtered = bubbles.filter(bubble => {
    const normalized = normalizeReplyBubble(bubble);
    return normalized.length < 12 || !recent.has(normalized);
  });

  return filtered.join(" ||| ");
};

export const sanitizePersonaReply = (
  reply: string,
  context: PersonaReplyGuardContext = {},
): string => {
  let cleaned = stripChatbotResidue(reply);

  if (detectUnpromptedSelfSuffering(cleaned, context)) {
    cleaned = cleaned
      .split(/(\|\|\||\n+)/)
      .map(part => {
        if (part === "|||" || /^\n+$/.test(part)) return part;
        if (/^\s*(?:و?أنا|و?انا|اني|إني|عندي|معيش|فلوسي|شغلي|حصلي|i\b|i'm|my\b)/i.test(part) && detectUnpromptedSelfSuffering(part, context)) return "";
        const clauses = part.split(/(?<=[،.!?؟])\s+|\s+(?=(?:بس|وأنا|وإني|أنا|اني|إني)\b)/i);
        return clauses.filter(clause => !detectUnpromptedSelfSuffering(clause, context)).join(" ").trim();
      })
      .join("")
      .replace(/(?:\s*\|\|\|\s*){2,}/g, " ||| ")
      .replace(/^\s*\|\|\||\|\|\|\s*$/g, "")
      .trim();
  }

  return cleaned || "قولّي أكتر";
};
