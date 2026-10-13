import { describe, expect, it } from 'bun:test';
import {
  calculateCognitiveReadingDelay,
  evaluateSpontaneousReaction,
  calculateBubbleTypingDelay,
  splitIntoNaturalBubbles,
} from '../services/whatsappRhythmEngine.js';

describe('WhatsApp Rhythm Engine', () => {
  it('calculates cognitive reading delay within realistic bounds', () => {
    const shortDelay = calculateCognitiveReadingDelay('ازيك');
    expect(shortDelay).toBeGreaterThanOrEqual(600);
    expect(shortDelay).toBeLessThanOrEqual(1200);

    const longText = 'انا رجعت من الشغل متأخر والمدير كان قالب وشه علينا طول اليوم وحصلت خناقة كبيرة في الاجتماع';
    const longDelay = calculateCognitiveReadingDelay(longText, 1);
    expect(longDelay).toBeGreaterThanOrEqual(1500);
    expect(longDelay).toBeLessThanOrEqual(3000);
  });

  it('triggers spontaneous laughing emoji for humor', () => {
    const reaction = evaluateSpontaneousReaction({ text: 'سمعت اخر نكتة؟ هههههه مسخرة بجد' });
    expect(reaction).not.toBeNull();
    expect(reaction?.shouldReact).toBe(true);
    expect(reaction?.emoji).toBe('😂');
    expect(reaction?.delayMs).toBeGreaterThanOrEqual(500);
  });

  it('triggers spontaneous surprise emoji for shocking statements', () => {
    const reaction = evaluateSpontaneousReaction({ text: 'مش هتصدق اللي حصلي النهاردة في الشارع' });
    expect(reaction).not.toBeNull();
    expect(reaction?.shouldReact).toBe(true);
    expect(reaction?.emoji).toBe('😮');
  });

  it('triggers heart emoji only when intimacy is high enough', () => {
    const lowIntimacy = evaluateSpontaneousReaction({ text: 'تسلملي يا غالي وبحبك', intimacy: 10 });
    expect(lowIntimacy).toBeNull();

    const highIntimacy = evaluateSpontaneousReaction({ text: 'تسلملي يا غالي وبحبك', intimacy: 50 });
    expect(highIntimacy).not.toBeNull();
    expect(highIntimacy?.emoji).toBe('❤️');
  });

  it('triggers prayer or support emoji for grief/prayers', () => {
    const reaction = evaluateSpontaneousReaction({ text: 'جدتي تعبانة اوي في المستشفى ادعيلي بالله عليك' });
    expect(reaction).not.toBeNull();
    expect(reaction?.emoji).toBe('🙏');
  });

  it('calculates bubble typing delay proportional to length', () => {
    const shortDelay = calculateBubbleTypingDelay('معلش');
    expect(shortDelay).toBeGreaterThanOrEqual(700);

    const longDelay = calculateBubbleTypingDelay('هو كدا اي شغل مقرف عامة، بس انت قدها وهتعدي وهنشوف هنعمل ايه في الويك اند');
    expect(longDelay).toBeGreaterThan(1200);
    expect(longDelay).toBeLessThanOrEqual(2800);
  });

  it('splits bubbles by ||| correctly', () => {
    const text = 'معلش يا عم ||| فداك والله ||| المهم صحتك';
    const bubbles = splitIntoNaturalBubbles(text);
    expect(bubbles).toEqual(['معلش يا عم', 'فداك والله', 'المهم صحتك']);
  });

  it('splits long messages with afterthought markers', () => {
    const text = 'انا رايح مشوار دلوقتي وهكلمك لما اوصل ان شاء الله ونرتب الخروجة دي تمام\nعلى فكرة نسيت اقولك مبروك على الشغل الجديد!';
    const bubbles = splitIntoNaturalBubbles(text);
    expect(bubbles.length).toBe(2);
    expect(bubbles[1]).toContain('على فكرة');
  });
});
