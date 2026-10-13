export type StoryStyleId =
  | 'egyptian_realism'
  | 'paranormal_horror'
  | 'epic_fantasy'
  | 'cyberpunk_scifi'
  | 'noir_detective'
  | 'psychological_drama'
  | 'rafiq_folklore'
  | 'boundless_freeform'
  | 'custom';

export type StoryPacing = 'fast_paced' | 'balanced' | 'deep_slow_burn';

export interface StoryStyleOption {
  id: StoryStyleId;
  label: string;
  englishLabel: string;
  description: string;
  icon: string;
  voiceDirective: string;
}

export interface StoryPlannedChapter {
  chapterNumber: number;
  title: string;
  objective: string;
}

export interface StoryCharacter {
  name: string;
  role: string;
  description: string;
}

export interface StorytellerChapter {
  chapterNumber: number;
  title: string;
  content: string;
  summary: string;
  cliffhanger?: string;
  wordCount: number;
  createdAt: string;
}

export interface BotPersonaContext {
  botName: string;
  botBio?: string;
  botGender?: string;
  soulTraits?: {
    chaos?: number;
    empathy?: number;
    slang?: number;
    intellect?: number;
    positivity?: number;
  };
  dialect?: string;
  speechStyle?: {
    toneSummary?: string;
    signaturePhrases?: string[];
  };
  relationshipWithUser?: string;
}

export interface StoryMediaSeed {
  type: 'image' | 'video';
  mimeType: string;
  data: string; // Base64 data string (without prefix)
  previewUrl?: string;
  name?: string;
  size?: number;
}

export interface StorytellerStory {
  id: string;
  chatId?: string;
  title: string;
  logline: string;
  premise: string;
  styleId: StoryStyleId;
  styleLabel: string;
  customStylePrompt?: string;
  targetChapters: number;
  pacing: StoryPacing;
  characters: StoryCharacter[];
  plannedChapters: StoryPlannedChapter[];
  chapters: StorytellerChapter[];
  currentChapterIndex: number;
  status: 'outline_created' | 'generating' | 'in_progress' | 'completed';
  persona?: BotPersonaContext;
  mediaSeed?: {
    type: 'image' | 'video';
    mimeType: string;
    previewUrl?: string;
    name?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export const STORY_STYLES: StoryStyleOption[] = [
  {
    id: 'egyptian_realism',
    label: 'واقعية مصرية أصيلة',
    englishLabel: 'Egyptian Realism',
    description: 'عمق الحارة، ريحة الشاي والقهوة البلدي، ناس حقيقيين، صراعات إنسانية حميمة بأسلوب أدبي دافئ مستوحى من نجيب محفوظ وخيري شلبي.',
    icon: '☕',
    voiceDirective: 'سرد أدبي بليغ يمتزج بروح مصرية أصيلة، حوارات حية من قلب الشارع، تفاصيل مكانية دقيقة (شرفات قديمة، أزقة، رائحة الطمي، صوت الراديو)، تركيز على المشاعر الإنسانية العميقة.',
  },
  {
    id: 'paranormal_horror',
    label: 'رعب وما وراء الطبيعة',
    englishLabel: 'Paranormal & Horror',
    description: 'غموض بارد، توتر نفسي متصاعد، أسرار غامضة وسخرية سوداء ذكية على طريقة مدرسة د. أحمد خالد توفيق.',
    icon: '👁️',
    voiceDirective: 'أجواء ضبابية موترة، حوادث غير مفسرة، تفاصيل حسية تقشعر لها الأبدان، تصاعد بطيء للرعب مع لمسات من السخرية الذكية والتشويق غير المتوقع.',
  },
  {
    id: 'epic_fantasy',
    label: 'فانتازيا ملحمية وأساطير',
    englishLabel: 'Epic Fantasy',
    description: 'ممالك مفقودة، سحر قديم، نبوءات غامضة، مخلوقات أسطورية وصراع مصيري بين النور والظلال.',
    icon: '⚔️',
    voiceDirective: 'بناء عوالم خيالية غنية بالتفاصيل، لغة سردية فخمة ومهيبة، أساطير عريقة، أسماء وشعوب ذات عمق تاريخي، معارك ومصير كوني.',
  },
  {
    id: 'cyberpunk_scifi',
    label: 'خيال علمي وديستوبيا مستقبلية',
    englishLabel: 'Cyberpunk & Sci-Fi',
    description: 'تكنولوجيا متطورة، مدن نيون باهتة، ذكاء اصطناعي، مفارقات زمنية وصراع بقاء في عوالم الغد.',
    icon: '🚀',
    voiceDirective: 'مصطلحات علمية وتخيلية متقنة، تفاصيل ميكانيكية وبيولوجية، صراعات فلسفية حول ماهية الوعي والهوية البشرية وسط تقنيات متوحشة.',
  },
  {
    id: 'noir_detective',
    label: 'تحقيق وجريمة غامضة (نوار)',
    englishLabel: 'Detective Noir',
    description: 'ألغاز محبوكة، مطر ينهمر على شوارع معتمة، أدلة متشابكة، محقق معذب وخيانة في كل زاوية.',
    icon: '🕵️‍♂️',
    voiceDirective: 'سرد سينمائي داكن، إيقاع دقيق ومحسوب، أدلة واستنتاجات ذكية، حوارات مقتضبة وذات مغزى مبطن (Subtext)، وانعطافات صادمة.',
  },
  {
    id: 'psychological_drama',
    label: 'دراما نفسية وعاطفية عميقة',
    englishLabel: 'Psychological Drama',
    description: 'تشريح للمشاعر الإنسانية المعقدة، علاقات متشابكة، صراعات الذاكرة والندم، ومونولوجات داخلية مؤثرة.',
    icon: '🎭',
    voiceDirective: 'تركيز شديد على الدوافع النفسية الباطنة، الوجع الصامت، لغة رقيقة وغارقة في المشاعر، وتفاصيل دقيقة في نظرات العيون وتغيرات الصوت.',
  },
  {
    id: 'rafiq_folklore',
    label: 'حكواتي رفيق المصري',
    englishLabel: 'Rafiq Folkloric Storyteller',
    description: 'رفيق بصوته المصري الحي كأنه قاعد معاك بيحكيلك على القهوة بأسلوبه العفوي والذكي والمشوق.',
    icon: '🎙️',
    voiceDirective: 'صوت رفيق وصاحبك المصري الجدع، دمج اللهجة المصرية المحكية بالبلاغة السردية، وقفات حكواتي مشوقة ("خد دي بقى عندك"، "تخيل معايا اللحظة دي").',
  },
  {
    id: 'boundless_freeform',
    label: 'خيال حر بلا حدود',
    englishLabel: 'Boundless Freeform',
    description: 'دع رفيق يبتكر الستايل الأدبي والسردي واللغة الأكثر ملائمة وجنوناً بناءً على سياق القصة دون أي قيود مسبقة.',
    icon: '✨',
    voiceDirective: 'أطلق العنان لخيالك الأدبي بالكامل؛ اختر الستايل واللغة والإيقاع الذي يمنح هذه القصة أقصى قدر من الإبهار والعمق والتفرد دون الالتزام بأي قالب تقليدي.',
  },
  {
    id: 'custom',
    label: 'ستايل مخصص من اختيارك',
    englishLabel: 'Custom Style',
    description: 'اكتب أسلوب الكاتب أو الجو الأدبي الذي تريده بنفسك.',
    icon: '✍️',
    voiceDirective: '',
  },
];
