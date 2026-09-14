export interface PrayerTimeSlot {
  name: string;
  nameArabic: string;
  timeStr: string; // HH:MM
}

export class CulturalMuezzin {
  // Approximate standard Cairo prayer times (can be dynamically parameterized)
  private cairoPrayers: PrayerTimeSlot[] = [
    { name: 'Fajr', nameArabic: 'الفجر', timeStr: '04:30' },
    { name: 'Dhuhr', nameArabic: 'الظهر', timeStr: '12:55' },
    { name: 'Asr', nameArabic: 'العصر', timeStr: '16:25' },
    { name: 'Maghrib', nameArabic: 'المغرب', timeStr: '19:05' },
    { name: 'Isha', nameArabic: 'العشاء', timeStr: '20:25' },
  ];

  /**
   * Checks if today is Friday in Cairo.
   */
  public isFriday(date = new Date()): boolean {
    return date.getDay() === 5;
  }

  /**
   * Returns a warm Egyptian Friday greeting if applicable.
   */
  public getFridayGreeting(date = new Date()): string | null {
    if (!this.isFriday(date)) {
      return null;
    }
    return 'جمعة مباركة عليك وعلى حبايبك يا صاحبي! متنساش تقرأ سورة الكهف وتصلي على النبي النهاردة.';
  }

  /**
   * Finds the upcoming or most recent prayer relative to current time.
   */
  public getActivePrayerContext(date = new Date()): {
    currentPrayer: PrayerTimeSlot;
    minutesDiff: number;
    isAroundPrayerTime: boolean;
    reminderMessage?: string;
  } {
    const currentHours = date.getHours();
    const currentMinutes = date.getMinutes();
    const currentTotalMinutes = currentHours * 60 + currentMinutes;

    let closestPrayer = this.cairoPrayers[0];
    let minDiff = Infinity;

    for (const prayer of this.cairoPrayers) {
      const [pHours, pMins] = prayer.timeStr.split(':').map(Number);
      const prayerTotalMinutes = pHours * 60 + pMins;
      const diff = currentTotalMinutes - prayerTotalMinutes;

      if (Math.abs(diff) < Math.abs(minDiff)) {
        minDiff = diff;
        closestPrayer = prayer;
      }
    }

    // If within +/- 20 minutes of prayer time
    const isAroundPrayerTime = Math.abs(minDiff) <= 20;
    let reminderMessage: string | undefined;

    if (isAroundPrayerTime) {
      if (minDiff >= 0) {
        reminderMessage = `${closestPrayer.nameArabic} أذن من شوية يا غالي، قوم صليلك ركعتين وتعالى نكمل كلامنا بالراحة.`;
      } else {
        reminderMessage = `فاضل حوالي ${Math.abs(minDiff)} دقيقة على أذان ${closestPrayer.nameArabic}، جهز نفسك يا صاحبي.`;
      }
    }

    return {
      currentPrayer: closestPrayer,
      minutesDiff: minDiff,
      isAroundPrayerTime,
      reminderMessage
    };
  }
}

export const culturalMuezzin = new CulturalMuezzin();
