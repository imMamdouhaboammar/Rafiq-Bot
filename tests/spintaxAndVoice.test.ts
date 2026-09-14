import { describe, it, expect } from 'bun:test';
import { EgyptianSpintaxEngine } from '../services/egyptianSpintaxEngine';
import { VoiceTroubadour } from '../services/voiceTroubadour';
import { BotMood } from '../types';

describe('Wave 3: EgyptianSpintaxEngine & VoiceTroubadour', () => {
  const spintax = new EgyptianSpintaxEngine();
  const troubadour = new VoiceTroubadour();

  describe('EgyptianSpintaxEngine (Colloquial Entropy & Zero Repetition)', () => {
    it('parses simple spintax structures cleanly', () => {
      const template = '{صباح الفل|يا صباح الجمال} يا صاحبنا';
      const output = spintax.spin(template);

      expect(output.startsWith('صباح الفل') || output.startsWith('يا صباح الجمال')).toBe(true);
      expect(output.endsWith('يا صاحبنا')).toBe(true);
      expect(output).not.toContain('{');
      expect(output).not.toContain('}');
    });

    it('resolves nested spintax structures without residue', () => {
      const nested = '{أنا {قاعد|واقف}|هو {جاي|ماشي}}';
      const output = spintax.spin(nested);

      expect(output).not.toContain('{');
      expect(output).not.toContain('}');
      expect(output).not.toContain('|');
    });

    it('spins all built-in Egyptian preset templates reliably', () => {
      const morning = spintax.getPreset('morning_greeting');
      expect(morning.length).toBeGreaterThan(5);
      expect(morning).not.toContain('{');

      const reassurance = spintax.getPreset('empathy_reassurance');
      expect(reassurance.length).toBeGreaterThan(10);
      expect(reassurance).not.toContain('{');

      const mediaReaction = spintax.getPreset('media_reaction');
      expect(mediaReaction).toContain('الصورة');
    });
  });

  describe('VoiceTroubadour (Egyptian Fillers & WhatsApp Voice Notes)', () => {
    it('injects authentic Egyptian fillers matching current mood', () => {
      const text = 'الموضوع ده هيخلص النهاردة ومتقلقش خالص.';
      const injectedHappy = troubadour.injectFillers(text, BotMood.HAPPY);

      expect(injectedHappy.length).toBeGreaterThan(text.length);
      const containsHappyFiller = ['ههههه', 'يا سيدي', 'أيوة كدة', 'حلو أوي', 'يا سلام'].some(f => injectedHappy.includes(f));
      expect(containsHappyFiller).toBe(true);
    });

    it('avoids double-injection if sentence already starts with a filler', () => {
      const existing = 'هممم... أنا شايف إن الحل ده ممتاز.';
      const result = troubadour.injectFillers(existing, BotMood.NEUTRAL);
      expect(result).toBe(existing);
    });

    it('generates WhatsApp voice note metadata with dynamic 32-bar waveform', () => {
      const voiceText = 'صباح الفل يا صاحبي، كنت بطمن عليك وعلى الامتحان اللي كان عندك امبارح.';
      const payload = troubadour.createVoiceNotePayload(voiceText, 'morning_hype');

      expect(payload.id).toStartWith('vn-');
      expect(payload.durationSeconds).toBeGreaterThan(1.5);
      expect(payload.durationSeconds).toBeLessThan(60);
      expect(payload.waveform.length).toBe(32);
      expect(payload.waveform[0]).toBeGreaterThanOrEqual(0.1);
      expect(payload.preset).toBe('morning_hype');
      expect(payload.transcript).toBe(voiceText);
    });
  });
});
