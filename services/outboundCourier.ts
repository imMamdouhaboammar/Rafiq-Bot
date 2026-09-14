export interface UserCommitment {
  type: 'exam' | 'interview' | 'travel' | 'health' | 'general';
  originalSnippet: string;
  detectedAt: Date;
  scheduledFollowUp: Date;
}

export class OutboundCourier {
  private commitmentPatterns: { type: UserCommitment['type']; regex: RegExp }[] = [
    { type: 'exam', regex: /(امتحان|فاينل|ميدتيرم|لجنة|تسميع)/iu },
    { type: 'interview', regex: /(انترفيو|مقابلة\s+شغل|وظيفة\s+جديدة|قدمت\s+على\s+شغل)/iu },
    { type: 'travel', regex: /(مسافر|سفرية|المطار|طيارة|رايح\s+اسكندرية|رايح\s+الدهب)/iu },
    { type: 'health', regex: /(عيان|تعبان|سخونية|رايح\s+الدكتور|مستشفى|صداع\s+هيموتني)/iu },
  ];

  /**
   * Scans a user message to detect if they mentioned an upcoming life commitment.
   */
  public detectCommitment(message: string, detectedAt = new Date()): UserCommitment | null {
    if (!message) return null;

    for (const pattern of this.commitmentPatterns) {
      if (pattern.regex.test(message)) {
        // Schedule follow-up ~18 hours later (next day afternoon)
        const scheduledFollowUp = new Date(detectedAt.getTime() + 18 * 60 * 60 * 1000);

        return {
          type: pattern.type,
          originalSnippet: message.slice(0, 100),
          detectedAt,
          scheduledFollowUp
        };
      }
    }

    return null;
  }

  /**
   * Generates a proactive follow-up message when the companion checks in on the user unprompted.
   */
  public generateProactiveFollowUp(commitment: UserCommitment): string {
    switch (commitment.type) {
      case 'exam':
        return 'طمني يا بطل.. عملت ايه في الامتحان النهاردة؟ كنت شايل همك وربنا يطمنا عليك!';
      case 'interview':
        return 'يا مساء الأخبار الحلوة.. طمني بسرعة عملت ايه في الانترفيو النهاردة؟ متفائل بيك جداً!';
      case 'travel':
        return 'حمد لله على السلامة يا غالي! وصلت بالسلامة؟ طمني على الطريق والأمور عاملة ايه معاك؟';
      case 'health':
        return 'كنت بطمن عليك يا صاحبي.. صحتك عاملة ايه النهاردة؟ بقيت أحسن إن شاء الله؟';
      case 'general':
      default:
        return 'وحشتني يا عم.. قولت أمسي عليك كدة وأشوف يومك عامل ايه النهاردة!';
    }
  }
}

export const outboundCourier = new OutboundCourier();
