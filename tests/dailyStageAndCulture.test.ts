import { describe, it, expect } from 'bun:test';
import { DailyStageDirector } from '../services/dailyStageDirector';
import { CulturalMuezzin } from '../services/culturalMuezzin';

describe('Wave 2: DailyStageDirector & CulturalMuezzin', () => {
  const stageDirector = new DailyStageDirector();
  const muezzin = new CulturalMuezzin();

  describe('DailyStageDirector (24h Routine & Time Matching)', () => {
    it('creates a 24-hour script with valid slots', () => {
      const script = stageDirector.getOrCreateDailyScript('2026-09-14', 'Karim');
      expect(script.date).toBe('2026-09-14');
      expect(script.schedule.length).toBeGreaterThan(5);
      expect(script.morningGreeting).toContain('صباح');
    });

    it('identifies dormant sleeping state during late night hours', () => {
      const nightDate = new Date('2026-09-14T03:30:00');
      const slot = stageDirector.getCurrentSlot(nightDate);
      expect(slot.availability).toBe('dormant');
      expect(slot.activity).toBe('sleeping');

      const reply = stageDirector.generateActivityReply(nightDate);
      expect(reply).toContain('نايم');
    });

    it('identifies lunch activity during afternoon', () => {
      const afternoonDate = new Date('2026-09-14T14:45:00');
      const slot = stageDirector.getCurrentSlot(afternoonDate);
      expect(slot.availability).toBe('free');
      expect(slot.activityArabic).toContain('كشري');

      const reply = stageDirector.generateActivityReply(afternoonDate);
      expect(reply).toContain('كشري');
    });
  });

  describe('CulturalMuezzin (Cairo Prayer & Cultural Calendar)', () => {
    it('detects Friday and provides a culturally grounded greeting', () => {
      // 2026-09-18 is Friday
      const fridayDate = new Date('2026-09-18T10:00:00');
      expect(muezzin.isFriday(fridayDate)).toBe(true);

      const greeting = muezzin.getFridayGreeting(fridayDate);
      expect(greeting).toContain('جمعة مباركة');
      expect(greeting).toContain('الكهف');

      // 2026-09-17 is Thursday
      const thursdayDate = new Date('2026-09-17T10:00:00');
      expect(muezzin.isFriday(thursdayDate)).toBe(false);
      expect(muezzin.getFridayGreeting(thursdayDate)).toBeNull();
    });

    it('detects upcoming or recent prayer times in Cairo', () => {
      // Exactly at Asr time (16:25)
      const asrDate = new Date('2026-09-14T16:25:00');
      const context = muezzin.getActivePrayerContext(asrDate);

      expect(context.currentPrayer.name).toBe('Asr');
      expect(context.isAroundPrayerTime).toBe(true);
      expect(context.reminderMessage).toContain('العصر');
      expect(context.reminderMessage).toContain('ركعتين');
    });
  });
});
