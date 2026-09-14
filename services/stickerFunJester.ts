import { StickerItem } from '../types';

export interface EgyptianRiddle {
  id: string;
  movie: string;
  quote: string;
  character: string;
  options: string[];
  hint: string;
}

export class StickerFunJester {
  private stickers: StickerItem[] = [
    {
      id: 'adel_imam_shock',
      title: 'عادل إمام مصدوم',
      category: 'shock',
      imageUrl: '/stickers/adel_imam_shock.webp',
      tags: ['صدمة', 'مش_ممكن', 'عادل_إمام', 'إيه_ده'],
      suggestedContext: 'خبر مفاجئ أو صدمة'
    },
    {
      id: 'lemby_laugh',
      title: 'اللمبي ميت ضحك',
      category: 'reaction',
      imageUrl: '/stickers/lemby_laugh.webp',
      tags: ['ضحك', 'كركرة', 'اللمبي', 'ههههه'],
      suggestedContext: 'موقف مضحك أو نكتة'
    },
    {
      id: 'henedy_crying',
      title: 'هنيدي بيبكي كوميدي',
      category: 'meme',
      imageUrl: '/stickers/henedy_crying.webp',
      tags: ['حزن_ساخر', 'هنيدي', 'فول_الصين_العظيم', 'يا_لهوي'],
      suggestedContext: 'موقف صعب بس بضحك'
    },
    {
      id: 'alaawali_tea',
      title: 'علاء ولي الدين بيشرب شاي',
      category: 'greeting',
      imageUrl: '/stickers/alaawali_tea.webp',
      tags: ['روقان', 'شاي', 'مساء_الخير', 'علاء_ولي_الدين'],
      suggestedContext: 'تحية مسائية أو روقان'
    }
  ];

  private riddles: EgyptianRiddle[] = [
    {
      id: 'riddle_1',
      movie: 'الناظر',
      quote: 'يا عم اعتبرني هندي وعامل حادثة!',
      character: 'اللمبي',
      options: ['عاطف', 'اللمبي', 'صلاح الدين', 'اللمبي وجواهر'],
      hint: 'فيلم بطولة علاء ولي الدين وأحمد حلمي ومحمد سعد'
    },
    {
      id: 'riddle_2',
      movie: 'فول الصين العظيم',
      quote: 'الصين حلوة بس مفيهاش أمان يا محيي!',
      character: 'محيي الشرقاوي',
      options: ['محيي الشرقاوي', 'الجد جابر', 'ممتاز الشرقاوي', 'فطين الشرقاوي'],
      hint: 'سافر للصين عشان يهرب من أعمامه'
    },
    {
      id: 'riddle_3',
      movie: 'التجربة الدنماركية',
      quote: 'أنا مش كريم أنا كرموز!',
      character: 'قدري المنياوي',
      options: ['قدري المنياوي', 'محمود', 'بهاء', 'فاروق'],
      hint: 'وزير الشباب والرياضة لما عياله اتخانقوا'
    }
  ];

  /**
   * Finds a relevant Egyptian WhatsApp sticker based on conversation text keywords.
   */
  public findStickerByKeywords(text: string): StickerItem | null {
    if (!text) return null;

    const normalized = text.toLowerCase();
    for (const sticker of this.stickers) {
      const matches = sticker.tags.some(tag => normalized.includes(tag.replace('_', ' ')));
      if (matches) {
        return sticker;
      }
    }

    return null;
  }

  /**
   * Returns a random Egyptian movie riddle for the "خمّن الإيفيه" mini-game.
   */
  public getRandomRiddle(): EgyptianRiddle {
    const idx = Math.floor(Math.random() * this.riddles.length);
    return this.riddles[idx];
  }

  /**
   * Evaluates user guess for a riddle.
   */
  public checkRiddleAnswer(riddleId: string, userGuess: string): { isCorrect: boolean; reply: string } {
    const riddle = this.riddles.find(r => r.id === riddleId);
    if (!riddle) {
      return { isCorrect: false, reply: 'الفزورة دي مش لاقيها يا صاحبي!' };
    }

    const normalizedGuess = userGuess.trim().toLowerCase();
    const isCorrect = normalizedGuess.includes(riddle.character.toLowerCase()) || 
                      normalizedGuess.includes(riddle.movie.toLowerCase());

    if (isCorrect) {
      return {
        isCorrect: true,
        reply: `الله عليك يا فنان! صح الصح.. الإيفيه من فيلم "${riddle.movie}"، والشخصية كانت "${riddle.character}". ذاكرتك السينمائية 100%! 🎬`
      };
    }

    return {
      isCorrect: false,
      reply: `تؤ تؤ.. مش صح خالص يا غالي! فكر كدة.. الإيفيه ده قاله "${riddle.character}" في فيلم "${riddle.movie}". حظ أوفر في الفزورة الجاية!`
    };
  }

  /**
   * Returns all available stickers.
   */
  public getAllStickers(): StickerItem[] {
    return [...this.stickers];
  }
}

export const stickerFunJester = new StickerFunJester();
