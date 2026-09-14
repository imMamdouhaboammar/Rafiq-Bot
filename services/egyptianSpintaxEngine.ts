export class EgyptianSpintaxEngine {
  private presetTemplates: Record<string, string> = {
    morning_greeting: '{صباح الفل|يا صباح الجمال والروقان|صباحك بيضحك|يسعد صباحك|صباح العسل يا عسل|يا اهلا يا اهلا} يا {صاحبي|باشا|غالي|حبيب قلبي|ست الكل}!',
    evening_greeting: '{مساء الروقان|يا مسا الجمال|مساء الفل} يا {صاحبي|غالي|باشا}، {يومك كان عامل ايه؟|طمني عليك؟|اخبار اليوم ايه؟}',
    empathy_reassurance: '{ولا يهمك|فداك يا عم|متشيلش هم|حصل خير|معلش}، {بص|ركز معايا|المهم} {إحنا هنظبطها|هتعدي على خير|كله بيتحل إن شاء الله|هو كدا اي شغل عامة.. انت شاطر وهتعدي}.',
    playful_tease: '{يا عم انت محسسني إنك|هو انت|شكلك كدة|صلي ع النبي بس انت} {نسيتنا خالص|بتقضيها نوم|مش ناوي تروق علينا النهاردة|دماغك ناشفة خالص}!',
    media_reaction: '{استنى بس أما أشوف الصورة دي|إيه ده وريني كدة الصورة دي|يا سيدي لما نفتح الصورة نشوف إيه الحكاية}..',
    farewell: '{يلا تصبح على خير|نوم الهنا يا صاحبي|أشوفك بكرة على خير}، {متنساش تظبط المنبه|نام وارتاح|أحلام سعيدة}.',
    attention_ping: '{فينك|انت فين|يا بنتي|يا بني|روحت فين} {يا عم|مبتردش ليه|؟؟}',
    grounded_empathy: '{معلش|فداك يا عم|حصل خير}.. {هو كدا اي شغل عامة|كلها فترة وهتعدي|انت شاطر وهتعديها}، {متزعلش من اي حاجة|كله بيعدي}.',
    playful_reality_check: '{صلي ع النبي بس|هو انت محسسني إنك|خلي معاييرك في الأرض يا بنتي|اتنيل بس|شوفي شغلك يا حجة}!',
    surprise_reaction: '{وه!|اي ده بجد؟|مش ممكن|يا لهوي}!',
    evening_checkin: '{روحتي ولا لسه؟|اكلمك دقيقتين ولا فاصلة؟|يومك كان عامل ازاي؟}',
    frank_assessment: '{بصراحة وبدون مجاملة|للأمانة يعني|عشان نبقى واضحين}.. {فيك ميزة نادرة|دماغك ناشفة شوية|اللي جواك زي اللي براك}.'
  };

  /**
   * Recursively parses and spins a Spintax string containing {choice1|choice2|...}.
   */
  public spin(input: string): string {
    if (!input || !input.includes('{')) {
      return input;
    }

    // Match innermost {a|b|c} groups
    const spintaxRegex = /\{([^{}]+)\}/g;

    let result = input;
    while (spintaxRegex.test(result)) {
      result = result.replace(spintaxRegex, (_, choicesStr: string) => {
        const choices = choicesStr.split('|');
        const randomIndex = Math.floor(Math.random() * choices.length);
        return choices[randomIndex] ?? choices[0];
      });
    }

    return result;
  }

  /**
   * Returns a spun template from the preset Egyptian library.
   */
  public getPreset(presetKey: keyof typeof this.presetTemplates | string): string {
    const template = this.presetTemplates[presetKey];
    if (!template) {
      return '';
    }
    return this.spin(template);
  }

  /**
   * Adds or registers a custom Egyptian Spintax template.
   */
  public registerPreset(key: string, template: string): void {
    this.presetTemplates[key] = template;
  }
}

export const egyptianSpintaxEngine = new EgyptianSpintaxEngine();
