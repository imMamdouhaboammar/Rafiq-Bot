export interface SpontaneousReactionResult {
  shouldReact: boolean;
  emoji?: string;
  delayMs: number;
}

export interface BubbleRhythmPlan {
  cognitiveReadingDelayMs: number;
  reaction?: SpontaneousReactionResult;
  bubbles: Array<{
    text: string;
    typingDelayMs: number;
  }>;
}

/**
 * Calculates human reading latency (Cognitive ingestion delay).
 * A real WhatsApp user takes 0.6s to 2.8s to read an incoming message
 * before their hands touch the keyboard.
 */
export function calculateCognitiveReadingDelay(messageText: string, burstCount = 1): number {
  const trimmed = messageText.trim();
  const length = trimmed.length;

  let baseDelay = 700;
  if (length <= 25) {
    baseDelay = 600 + Math.floor(Math.random() * 300); // 600 - 900ms
  } else if (length <= 100) {
    baseDelay = 900 + Math.floor(length * 8) + Math.floor(Math.random() * 400); // 1100 - 2100ms
  } else {
    baseDelay = 1600 + Math.floor(Math.min(length * 5, 800)) + Math.floor(Math.random() * 400); // 2000 - 2800ms
  }

  // If user sent multiple rapid bursts, add small cognitive scanning buffer
  if (burstCount > 1) {
    baseDelay += Math.min((burstCount - 1) * 250, 600);
  }

  return Math.min(Math.max(baseDelay, 600), 3000);
}

/**
 * Evaluates whether the companion should spontaneously react with a WhatsApp emoji.
 * Real friends react spontaneously to funny jokes, affection, shocking news, or deep empathy.
 */
export function evaluateSpontaneousReaction(params: {
  text: string;
  mood?: string;
  intimacy?: number;
}): SpontaneousReactionResult | null {
  const { text, intimacy = 10 } = params;
  if (!text || !text.trim()) return null;

  const normalized = text.toLowerCase().trim();

  // 1. Humor & Laughter triggers -> 😂
  const humorPattern = /(😂|🤣|هههه|ههه|نكتة|مسخرة|ألش|القلش|يموت من الضحك|مش قادر|فطست|كركر)/;
  if (humorPattern.test(normalized)) {
    return {
      shouldReact: true,
      emoji: '😂',
      delayMs: 500 + Math.floor(Math.random() * 500),
    };
  }

  // 2. Shock & Surprise triggers -> 😮
  const shockPattern = /(مش هتصدق|يا نهار ابيض|يا لهوي|كارثة|فزت ب|تخيل كدا|صدمة|معقول|بجد والله)/;
  if (shockPattern.test(normalized)) {
    return {
      shouldReact: true,
      emoji: '😮',
      delayMs: 600 + Math.floor(Math.random() * 400),
    };
  }

  // 3. Affection & Sweet camaraderie (requires reasonable intimacy >= 25) -> ❤️
  const affectionPattern = /(بحبك|تسلملي|تسلم يا غالي|شكرا يا صاحبي|ربنا يخليك|وحشتني|يا أحسن رفيق|يا قلبي)/;
  if (intimacy >= 25 && affectionPattern.test(normalized)) {
    return {
      shouldReact: true,
      emoji: '❤️',
      delayMs: 700 + Math.floor(Math.random() * 500),
    };
  }

  // 4. Distress / Grief / Vulnerable sorrow -> 🥺 or 🙏
  const griefPattern = /(تعبان اوي|مخنوق|زعلان|ادعيلي|وفاة|مات|في المستشفى|بموت من التعب|حزين)/;
  if (griefPattern.test(normalized)) {
    const emoji = normalized.includes('ادعيلي') || normalized.includes('وفاة') ? '🙏' : '🥺';
    return {
      shouldReact: true,
      emoji,
      delayMs: 800 + Math.floor(Math.random() * 600),
    };
  }

  // 5. Solid agreement / Bro-code confirmation -> 👍
  const agreementPattern = /(خلصانة|اشطا عليك|تمام كدا|اتفقنا يا عم|يا رجولة|سرك في بير)/;
  if (agreementPattern.test(normalized)) {
    return {
      shouldReact: true,
      emoji: '👍',
      delayMs: 600 + Math.floor(Math.random() * 400),
    };
  }

  return null;
}

/**
 * Calculates typing simulation delay for a single bubble.
 * Realistic texting is ~30-50ms per character, clamped between 700ms and 2800ms.
 */
export function calculateBubbleTypingDelay(bubbleText: string): number {
  const chars = bubbleText.trim().length;
  const words = bubbleText.trim().split(/\s+/).length;

  const charBased = chars * 45;
  const wordBased = words * 120;
  const calculated = Math.max(charBased, wordBased);

  return Math.min(Math.max(calculated, 700), 2800);
}

/**
 * Splits text into natural WhatsApp bubbles.
 * Honors explicit '|||' delimiters, or splits on organic afterthought markers
 * if message is long.
 */
export function splitIntoNaturalBubbles(rawText: string): string[] {
  if (!rawText?.trim()) return [];

  if (rawText.includes('|||')) {
    return rawText
      .split('|||')
      .map(part => part.trim())
      .filter(Boolean);
  }

  // If no |||, check if there are distinct paragraphs or explicit afterthought cues
  const trimmed = rawText.trim();
  if (trimmed.length > 80) {
    const afterthoughtRegex = /\n+(?=(?:اه و|على فكرة|نسيت اقولك|اه صح|المهم|بالمناسبة))/;
    if (afterthoughtRegex.test(trimmed)) {
      return trimmed
        .split(afterthoughtRegex)
        .map(p => p.trim())
        .filter(Boolean);
    }
  }

  return [trimmed];
}
