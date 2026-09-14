import { Attachment } from "../types.js";

export type ResponsePath =
  | "fast_chat"
  | "normal_persona"
  | "deep_persona"
  | "memory_heavy"
  | "tool_required";

// Dynamic routing patterns
const GREETINGS_AND_CASUAL = /(مساء الخير|مساء النور|صباح الخير|صباح النور|سلام|أهلاً|اهلا|هاي|ازيك|عامله ايه|عاملة ايه|عامل ايه|اخبارك|أخبارك|تمام|ماشي|ماشى|حاضر|قشطة|اشطا|اوكي|شكرا|شكرًا|وحشتيني|وحشتينى|وحشتني|بحبك|يا ريس|يا ريسنا|نتحرك|فينك|أنا جيت|انا جيت|وصلت|تحت الشركة|بقولك|بقولك ايه|بقولك إيه|هستناك|يلا|يلا بينا|سلامات|باي|مع السلامة|الحمد لله|كويس|كويسة|يا بنتي|يا بنتى|يا عم|يا صاحبي|يا صاحبى|امين|أمين|فين|هاخدك|هنتحرك)/i;

const MEMORY_HEAVY_PATTERNS = /(فاكرة لما|فاكر لما|قولتلك قبل كده|قلتلك قبل كده|زي ما قولتلك|زي ما قلتلك|اتكلمنا عنه|الموضوع اللي فات|فاكرة إيه|فاكر إيه|سألتك قبل كده|المرة اللي فاتت|المرة اللى فاتت|زي ما اتكلمنا)/i;

const DEEP_PERSONA_PATTERNS = /(مخنوق|مخنوقة|زعلان|زعلانة|زعلان منك|زعلتني|زعلتنى|تعبان|تعبانة|متضايق|متضايقة|مكتئب|مكتئبة|اكتئاب|حزين|حزينة|مش قادرة|مش قادر|تعبت|نفسيتي|نفسيتى|بكرهك|مكسور|مقهور|وحيد|وحيدة|ظروفي صعبة|مش طايق|محتار|محتارة|قررت اسيب|قررت أسيب|خانني|خانتني|وداعا|وداعًا)/i;

/**
 * Classifies an incoming message into a latency response path.
 * Runs in under 5ms using deterministic pattern matching.
 */
export function classifyResponsePath(
  message: string,
  attachments: any[] = [],
  replyContextText?: string
): ResponsePath {
  // 1. Tool Required Pathway
  if (attachments && attachments.length > 0) {
    return "tool_required";
  }

  const cleanText = message.trim();
  const mergedText = `${replyContextText || ""} ${cleanText}`.trim().toLowerCase();

  // 2. Memory Heavy Pathway
  if (MEMORY_HEAVY_PATTERNS.test(mergedText)) {
    return "memory_heavy";
  }

  // 3. Deep Persona Pathway (Strong emotional cues)
  if (DEEP_PERSONA_PATTERNS.test(mergedText)) {
    return "deep_persona";
  }

  // 4. Fast Chat Pathway
  // - Short casual inputs (<= 35 characters) containing greetings/casual cues, or extremely short messages (<= 15 characters)
  const hasCasualPattern = (cleanText.length <= 35 && GREETINGS_AND_CASUAL.test(cleanText)) || 
                          cleanText.length <= 15;
  
  if (hasCasualPattern && !DEEP_PERSONA_PATTERNS.test(cleanText) && !MEMORY_HEAVY_PATTERNS.test(cleanText)) {
    return "fast_chat";
  }

  // 5. Deep Persona Pathway (Fallback for long, wordy inquiries)
  if (cleanText.length > 180) {
    return "deep_persona";
  }

  // 6. Normal Persona Pathway (Balanced Default)
  return "normal_persona";
}
