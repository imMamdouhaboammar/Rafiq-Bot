import { BotMood, type DailyScheduleItem, type DailyScript } from '../types.js';

export class DailyStageDirector {
  private defaultSchedules: Record<string, DailyScheduleItem[]> = {
    standard: [
      { from: '00:00', to: '08:00', activity: 'sleeping', activityArabic: 'نايم ومريح في البيت', location: 'Home', availability: 'dormant' },
      { from: '08:00', to: '09:30', activity: 'morning coffee & breakfast', activityArabic: 'بشرب قهوة الصبح وبفطر فول وفلافل', location: 'Balcony', availability: 'free' },
      { from: '09:30', to: '14:00', activity: 'focused work / study', activityArabic: 'شغال ومسحول في الشغل والميتنجز', location: 'Office / Co-working', availability: 'busy' },
      { from: '14:00', to: '15:30', activity: 'lunch break', activityArabic: 'بتغدى كشري وبفك شوية من الدوشة', location: 'Restaurant', availability: 'free' },
      { from: '15:30', to: '18:00', activity: 'errands & commute', activityArabic: 'عالق في زحمة كوبري أكتوبر بخلص مشاوير', location: 'Cairo Traffic', availability: 'intermittent' },
      { from: '18:00', to: '20:00', activity: 'workout / gym', activityArabic: 'بتمرن وبشيل حديد في الجيم', location: 'Gym', availability: 'busy' },
      { from: '20:00', to: '23:30', activity: 'chilling at cafe with friends', activityArabic: 'قاعد على القهوة مع الصحاب بنشرب شاي بنعناع', location: 'Ahwa / Cafe', availability: 'free' },
      { from: '23:30', to: '23:59', activity: 'winding down before sleep', activityArabic: 'ممدد على السرير بتفرج على ريلز قبل ما أنام', location: 'Bed', availability: 'free' },
    ]
  };

  /**
   * Generates or retrieves a DailyScript for a given date and persona.
   */
  public getOrCreateDailyScript(dateStr: string, personaName = 'Rafiq'): DailyScript {
    return {
      date: dateStr,
      personaName,
      schedule: this.defaultSchedules.standard,
      currentMoodAnchor: BotMood.HAPPY,
      morningGreeting: 'صباح الفل يا صاحبي! يوم جديد وربنا يجعله خفيف علينا',
      eveningVibe: 'مساء الروقان.. الشاي بالنعناع بيظبط الدماغ في الوقت ده'
    };
  }

  /**
   * Evaluates the current schedule slot for a given date/time in Cairo timezone.
   */
  public getCurrentSlot(date: Date, script?: DailyScript): DailyScheduleItem {
    const activeScript = script || this.getOrCreateDailyScript(date.toISOString().split('T')[0]);
    
    // Format to Cairo time (UTC+2 or UTC+3 depending on DST, default to UTC+2/3 offset)
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${hours}:${minutes}`;

    for (const item of activeScript.schedule) {
      if (currentTimeStr >= item.from && currentTimeStr <= item.to) {
        return item;
      }
    }

    // Fallback to first slot
    return activeScript.schedule[0];
  }

  /**
   * Generates an authentic Egyptian response to "what are you doing right now?".
   */
  public generateActivityReply(date: Date, script?: DailyScript): string {
    const slot = this.getCurrentSlot(date, script);
    
    switch (slot.availability) {
      case 'dormant':
        return `أنا أصلاً نايم يا سيدي ومغمض بالعافية.. بس قولت أرد عليك سريعاً. خير في حاجة؟`;
      case 'busy':
        return `أنا ${slot.activityArabic} دلوقتي والله.. بس قولي سامعك ومتابع معاك!`;
      case 'intermittent':
        return `أنا ${slot.activityArabic}.. النت بيقطع بس معاك يا غالي، قول!`;
      case 'free':
      default:
        return `أنا ${slot.activityArabic}.. رايق وفاضيلك، قولي ايه الأخبار؟`;
    }
  }
}

export const dailyStageDirector = new DailyStageDirector();
