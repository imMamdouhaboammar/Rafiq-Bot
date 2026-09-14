import { describe, it, expect } from 'bun:test';
import { StickerFunJester } from '../services/stickerFunJester';
import { OutboundCourier } from '../services/outboundCourier';

describe('Wave 4: StickerFunJester & OutboundCourier', () => {
  const jester = new StickerFunJester();
  const courier = new OutboundCourier();

  describe('StickerFunJester (Egyptian Meme Stickers & Cinema Trivia)', () => {
    it('matches keyword context to iconic Egyptian stickers', () => {
      const sticker = jester.findStickerByKeywords('مش ممكن يا جماعة الصدمة دي');
      expect(sticker).not.toBeNull();
      expect(sticker?.id).toBe('adel_imam_shock');
      expect(sticker?.category).toBe('shock');
    });

    it('handles riddle evaluation with accurate movie quotes', () => {
      const riddle = jester.getRandomRiddle();
      expect(riddle.quote.length).toBeGreaterThan(5);

      const correctResult = jester.checkRiddleAnswer(riddle.id, riddle.character);
      expect(correctResult.isCorrect).toBe(true);
      expect(correctResult.reply).toContain('الله عليك يا فنان');

      const incorrectResult = jester.checkRiddleAnswer(riddle.id, 'شخصية مش موجودة خالص');
      expect(incorrectResult.isCorrect).toBe(false);
      expect(incorrectResult.reply).toContain('تؤ تؤ');
    });
  });

  describe('OutboundCourier (Proactive Life Follow-ups)', () => {
    it('detects upcoming exam commitments and schedules follow-up', () => {
      const userMessage = 'ادعيلي يا صاحبي عندي امتحان فاينل بكرة الصبح وخايف جداً';
      const commitment = courier.detectCommitment(userMessage);

      expect(commitment).not.toBeNull();
      expect(commitment?.type).toBe('exam');
      expect(commitment?.originalSnippet).toContain('امتحان');

      if (commitment) {
        const followUp = courier.generateProactiveFollowUp(commitment);
        expect(followUp).toContain('طمني يا بطل');
        expect(followUp).toContain('الامتحان');
      }
    });

    it('detects job interview commitments and generates upbeat follow-up', () => {
      const userMessage = 'عندي انترفيو مهم في شركة جديدة ادعيلي تظبط معايا';
      const commitment = courier.detectCommitment(userMessage);

      expect(commitment).not.toBeNull();
      expect(commitment?.type).toBe('interview');

      if (commitment) {
        const followUp = courier.generateProactiveFollowUp(commitment);
        expect(followUp).toContain('الانترفيو');
        expect(followUp).toContain('متفائل');
      }
    });
  });
});
