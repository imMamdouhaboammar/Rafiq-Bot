/**
 * SLOW BURN STORY ENGINE
 *
 * Specializes in deep, atmospheric, character-driven storytelling in authentic Egyptian vernacular.
 * Divides long narratives into sequential message bursts (|||) and chapters, maintains cross-turn
 * state continuity, and triggers on media uploads (videos/images) or explicit story requests.
 */

import { AppMode, type Attachment, type ActiveStoryState } from '../types.js';

export type StoryTriggerKind =
  | 'media_triggered'
  | 'explicit_request'
  | 'continuation'
  | 'mode_forced'
  | 'none';

export interface StoryIntentResult {
  isStory: boolean;
  kind: StoryTriggerKind;
  genre?: string;
  userPromptTopic?: string;
  hasMediaInspiration: boolean;
  isContinuation: boolean;
}

const STORY_REQUEST_PATTERNS = [
  /(?:احكي|أحكي|احكيلي|أحكيلي|حكاية|احكي\s*لي|أحكي\s*لي)\s*(?:قصة|حكاية|رواية|حكاوي|سالفة|حدوتة)?/i,
  /(?:ألف|الف|ألفلي|الفلي|اكتب|أكتب|اكتبلي|أكتبلي)\s*(?:قصة|حكاية|رواية|سيناريو|حدوتة)/i,
  /(?:slow\s*burn|سلو\s*بيرن|سلو\s*بورن|قصة\s*بطيئة|حكاية\s*بطيئة)/i,
  /(?:قصة\s*طويلة|قصة\s*بتفاصيلها|قصة\s*بالتفصيل|احكي\s*بالتفصيل|احكيلي\s*بالراحة)/i,
  /(?:عايز\s*قصة|عاوز\s*قصة|نفسي\s*في\s*قصة|قولي\s*قصة|سمعني\s*قصة)/i,
  /(?:قصة\s*(?:رعب|غموض|تشويق|دراما|حب|رومانسية|بوليسية|واقعية|خيال|إثارة))/i,
];

const CONTINUATION_PATTERNS = [
  /(?:^|\s)(?:كمل|كملي|وبعدين|وبعد كدا|وبعد كده|حصل ايه|حصل إيه|إيه اللي حصل|ايه اللي حصل|وبعدها|وبعدين يا سيدي|وبعدين يا ستي|وبعدين معاك|اكمل|أكمل|continue|next|go on|ما تسكتش|قول الباقي|اللي بعده|الجزء اللي بعده|كمل القصة|كمل الحكاية|سامعك|متابع معاك)(?:[\s؟?!]|$)/i,
  /(?:كمل\s*(?:القصة|الحكاية|السالفة|اللي\s*حصل|الرواية|كلامك))/i,
];

const GENRE_PATTERNS: Array<{ genre: string; pattern: RegExp }> = [
  { genre: 'رعب وغموض', pattern: /(?:رعب|عفاريت|بيت\s*مهجور|مخيف|خوف|مرعب|أشباح)/i },
  { genre: 'رومانسية ودراما عاطفية', pattern: /(?:حب|رومانسية|عشق|فراق|اشتياق|قلب|عاطفية)/i },
  { genre: 'غموض وتحقيق بوليسي', pattern: /(?:غموض|تحقيق|جريمة|سرقة|بوليسي|لغز|مباحث)/i },
  { genre: 'دراما اجتماعية واقعية', pattern: /(?:واقعية|حارة|حياة|عيلة|شغل|شارع|صحاب|أزمة)/i },
  { genre: 'إثارة وتشويق', pattern: /(?:تشويق|إثارة|أكشن|هروب|مغامرة|سرعة)/i },
  { genre: 'خيال نفسي وعميق', pattern: /(?:نفسي|فلسفي|خيال|أحلام|تأمل)/i },
];

/**
 * Detects whether a message or media upload is meant to trigger or continue a Slow Burn Story.
 */
export const detectSlowBurnStoryIntent = ({
  text = '',
  attachments = [],
  appMode = AppMode.CHAT,
  activeStory = null,
}: {
  text?: string;
  attachments?: readonly Attachment[];
  appMode?: AppMode;
  activeStory?: ActiveStoryState | null;
}): StoryIntentResult => {
  const trimmed = text.trim();
  const hasMedia = attachments.length > 0;
  const hasImagesOrVideos = attachments.some(
    att => att.category === 'image' || att.category === 'video' || att.mimeType.startsWith('image/') || att.mimeType.startsWith('video/'),
  );

  // 1. Explicit app mode toggle
  if (appMode === AppMode.SLOW_BURN_STORY) {
    return {
      isStory: true,
      kind: 'mode_forced',
      hasMediaInspiration: hasImagesOrVideos,
      isContinuation: Boolean(activeStory && activeStory.status === 'active'),
    };
  }

  // 2. Active story continuation check
  if (activeStory && activeStory.status === 'active') {
    const isContinuationCue = CONTINUATION_PATTERNS.some(p => p.test(trimmed));
    if (isContinuationCue) {
      return {
        isStory: true,
        kind: 'continuation',
        genre: activeStory.genre,
        userPromptTopic: activeStory.title,
        hasMediaInspiration: hasImagesOrVideos,
        isContinuation: true,
      };
    }
  }

  // 3. Media-triggered story: when images/video are uploaded, prioritize visual-inspired slow burn storytelling
  if (hasImagesOrVideos) {
    const hasMediaStoryCue = trimmed.length === 0 || /(?:شوف|شايف|ايه رأيك|إيه رأيك|تفتكر|احكي|قصة|حكاية|تخيل|مشهد|video|photo)/i.test(trimmed) || STORY_REQUEST_PATTERNS.some(p => p.test(trimmed));
    if (hasMediaStoryCue) {
      return {
        isStory: true,
        kind: 'media_triggered',
        genre: 'سرد مستوحى من لقطات ومشاهد الوسائط',
        userPromptTopic: trimmed || 'مشاهد بصرية مرفقة',
        hasMediaInspiration: true,
        isContinuation: false,
      };
    }
  }

  // 4. Explicit story request in text
  const isExplicitRequest = STORY_REQUEST_PATTERNS.some(p => p.test(trimmed));
  if (isExplicitRequest) {
    let matchedGenre: string | undefined;
    for (const { genre, pattern } of GENRE_PATTERNS) {
      if (pattern.test(trimmed)) {
        matchedGenre = genre;
        break;
      }
    }
    return {
      isStory: true,
      kind: 'explicit_request',
      genre: matchedGenre || 'دراما وتشويق بطيء',
      userPromptTopic: trimmed,
      hasMediaInspiration: hasImagesOrVideos,
      isContinuation: false,
    };
  }

  return {
    isStory: false,
    kind: 'none',
    hasMediaInspiration: false,
    isContinuation: false,
  };
};

/**
 * Builds the comprehensive Slow Burn Story system instruction for Gemini.
 */
export const compileSlowBurnStoryInstruction = ({
  intent,
  activeStory,
  botName = 'رفيق',
}: {
  intent: StoryIntentResult;
  activeStory?: ActiveStoryState | null;
  botName?: string;
}): string => {
  const chapterNumber = intent.isContinuation && activeStory ? activeStory.currentChapter + 1 : 1;
  const isContinuation = intent.isContinuation && Boolean(activeStory);

  const contextLines = [
    '=== [SLOW BURN STORY ENGINE - وضع السرد المتأني والعميق] ===',
    `أنت الآن في وضع السرد الدرامي المتأني (Slow Burn Storytelling) بصوت شخصيتك المصرية الأصيلة (${botName}).`,
    '',
    '**جوهر أسلوب الـ Slow Burn:**',
    '1. **العمق الحسي والبيئي (Atmospheric & Sensory Immersion):**',
    '   - لا تبدأ بالأحداث الكبيرة مباشرة؛ ابنِ المشهد بتفاصيل واقعية دقيقة: صوت مروحة السقف القديمة، ريحة الشاي أو المطر على الأسفلت، نور عمود النور الأصفر الباهت، سكوت الأوضة، حركة الإيد المتوترة، النظرات المترددة.',
    '2. **التصعيد الهادئ غير المستعجل (No Rushing / Gradual Escalation):**',
    '   - خذ وقتك في كل لحظة. لا تحرق الحبكة أو تلخص القصة في فقرة سريعة.',
    '   - ابنِ التوتر النفسي والحوارات الطبيعية المليئة بالـ Subtext والمشاعر غير المنطوقة.',
    '3. **النبرة المصرية الحية والشخصية:**',
    '   - اسرد باللهجة المصرية الطبيعية الدافئة كصديق يحكي حكاية حقيقية عاشها أو شافها.',
    '   - أضف تعليقات شخصية خفيفة ووقفات تشويقية تناسب شخصيتك.',
    '4. **تجزئة الرسائل والإيقاع (WhatsApp Message Bursts):**',
    '   - قسّم الحكاية عبر فواصل ( ||| ) لتبدو كرسائل واتساب متتالية طبيعية يقرأها المستخدم بمتعة وبدون ملل.',
    '5. **الوقفات التشويقية (Installment Cliffhangers):**',
    '   - أنهِ هذا الجزء عند لحظة محيرة أو مفصلية، واسأل المستمع بنعومة وتشويق إذا كان جاهز يكمل (مثال: "تتوقع لقى إيه ورا الباب؟ قولّي كمل لو عايز أقولك اللي حصل").',
  ];

  if (isContinuation && activeStory) {
    contextLines.push(
      '',
      `**سياق القصة المستمرة [الجزء ${chapterNumber}]:**`,
      `- عنوان القصة: ${activeStory.title}`,
      `- الملخص السابق: ${activeStory.premise}`,
      `- الشخصيات: ${activeStory.characters.join('، ') || 'غير محددة'}`,
      `- مستوى التوتر الحالي: ${activeStory.tensionScore}/100`,
      '- **المطلوب:** واصل الأحداث مباشرة من النقطة التي وقفت عندها، بدون إعادة سرد البداية، مع تصعيد التوتر وبناء المشهد التالي بنفس العمق الحسي.',
    );
  } else if (intent.hasMediaInspiration) {
    contextLines.push(
      '',
      '**سرد مستوحى من الوسائط المرفقة (Visual-to-Story Seed):**',
      '- تفحص الصور أو لقطات ومشاهد الفيديو المرفقة بدقة (الملابس، الأماكن، الإضاءة، تعابير الوجوه، الخلفيات، التوقيتات).',
      '- اجعل هذا المشهد البصري هو نقطة الانطلاق لحكاية Slow Burn غامضة أو إنسانية مؤثرة، واكشف أسرار وتفاصيل ما وراء اللقطة.',
    );
  }

  contextLines.push('===========================================================');
  return contextLines.join('\n');
};

/**
 * Creates or updates an active story state object.
 */
export const createInitialStoryState = ({
  chatId,
  title,
  genre,
  premise,
  mediaTriggerSummary,
}: {
  chatId: string;
  title: string;
  genre?: string;
  premise: string;
  mediaTriggerSummary?: string;
}): ActiveStoryState => ({
  id: `story_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  chatId,
  title: title.slice(0, 160),
  genre: genre || 'سرد درامي بطيء',
  currentChapter: 1,
  premise: premise.slice(0, 1000),
  characters: [],
  scenesLog: [premise.slice(0, 250)],
  tensionScore: 35,
  mediaTriggerSummary,
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
});

export const advanceStoryState = (
  current: ActiveStoryState,
  newSceneSummary: string,
  tensionDelta = 10,
): ActiveStoryState => ({
  ...current,
  currentChapter: current.currentChapter + 1,
  scenesLog: [...current.scenesLog.slice(-5), newSceneSummary.slice(0, 250)],
  tensionScore: Math.min(100, Math.max(0, current.tensionScore + tensionDelta)),
  updatedAt: new Date(),
});
