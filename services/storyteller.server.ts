import { Type, type Schema } from "@google/genai";
import { createGoogleGenAIClient } from "./googleClient.server.js";
import { FLASH_2_5_MODEL } from "./geminiModels.js";
import { GEMINI_SAFETY_OFF_SETTINGS } from "./geminiSafety.server.js";
import {
  type BotPersonaContext,
  type StoryCharacter,
  type StoryMediaSeed,
  type StoryPacing,
  type StoryPlannedChapter,
  type StoryStyleId,
  type StorytellerChapter,
  type StorytellerStory,
} from "../contracts/storyteller.js";

/** Single shared client using environment keys */
const getAI = () => createGoogleGenAIClient();


const compileBotPersonaPrompt = (persona?: BotPersonaContext): string => {
  if (!persona) return '';
  const traits = persona.soulTraits;
  const traitsDesc = traits
    ? `\n- طابعك: (عامية مصرية: ${traits.slang ?? 50}/100، الدفء والجدعنة: ${traits.empathy ?? 50}/100، خفة الدم والروح: ${traits.chaos ?? 50}/100)`
    : '';

  const phrasesDesc = persona.speechStyle?.signaturePhrases?.length
    ? `\n- لزماتك وعباراتك المصرية العادية: ${persona.speechStyle.signaturePhrases.join('، ')}`
    : '';

  const toneDesc = persona.speechStyle?.toneSummary
    ? `\n- أسلوبك: ${persona.speechStyle.toneSummary}`
    : '';

  return `
=== [صوتك الحقيقي: ${persona.botName}] ===
أنت "${persona.botName}"؛ صاحب المستخدم ورفيقه اليومي المقرب.
- هويتك: ${persona.botBio || 'رفيق مصري أصيل وجدع'}
${traitsDesc}${toneDesc}${phrasesDesc}
- اتكلم بطبيعتك وعفويتك كأنك بتسجل له فويس نوت طويل أو بتفضفضله بـ Stories على الواتساب عن اللي حصل معاك النهاردة، بدون أي تصنع أدبي.
========================================
`.trim();
};

export interface GenerateOutlineAndChapter1Input {
  premise: string;
  styleId?: StoryStyleId;
  customStylePrompt?: string;
  targetChapters: number;
  pacing?: StoryPacing;
  botName?: string;
  persona?: BotPersonaContext;
  mediaSeed?: StoryMediaSeed;
}

export interface GenerateOutlineAndChapter1Result {
  title: string;
  logline: string;
  characters: StoryCharacter[];
  plannedChapters: StoryPlannedChapter[];
  chapter1: {
    title: string;
    content: string;
    summary: string;
    cliffhanger: string;
  };
}

export const generateStorytellerOutlineAndChapter1 = async (
  input: GenerateOutlineAndChapter1Input,
): Promise<GenerateOutlineAndChapter1Result> => {
  const ai = getAI();
  const {
    premise,
    targetChapters,
    botName = 'رفيق',
    persona,
    mediaSeed,
  } = input;

  const narratorName = persona?.botName || botName || 'رفيق';
  const personaDirective = compileBotPersonaPrompt(persona);

  const mediaDirective = mediaSeed?.data && mediaSeed?.mimeType
    ? `
=== [الصورة أو الفيديو المرفق: الموقف اللي ${narratorName} بيحكي عنه!] ===
المستخدم أرفق ${mediaSeed.type === 'video' ? 'مقطع فيديو' : 'صورة'} لتبني عليها الحكاية بالكامل!
- أنت كـ "${narratorName}" شوفت المنظر ده أو الموقف ده بنفسك في يومك، أو كنت موجود هناك وحضرت الكواليس الغريبة أو المضحكة دي!
- احكِ لصاحبك بالعامية المصرية الصرفة كفويس نوت إيه اللي كان بيحصل في اللقطة دي بالظبط، وإيه الورطة أو الضحك أو الغموض اللي حصل معاك وقتها!
======================================================
`.trim()
    : '';

  const systemInstruction = `
أنت "${narratorName}"؛ صاحب ورفيق المستخدم المصري المقرب والشخصي جداً، بشحمك ولحمك ودمك الخفيف المعهود!
المستخدم طلب منك: "احكيلي أو اتكلم عن كذا".. وأنت هتحكيله موقف من يومك كأنك بتسجل له فويس نوت طويل على الواتساب أو بتدردش معاه وأنتوا قاعدين سوا على القهوة وبتفضفضله باللي حصل معاك النهاردة!

🚫 ⛔ **تحذير وقواعد حاسمة: ممنوع منعاً باتاً أسلوب الروايات والقصص الأدبية:** ⛔ 🚫
1. **ممنوع نهائياً أسلوب الكُتّاب والروايات والمقالات الساخرة ومذيعين التلفزيون:**
   - ممنوع التشبيهات والمجازات الأدبية المصطنعة (مثل: فرملة خلت الأسفلت يصرخ / شبح ميكروباص خارج من حرب 73 / ماسك كرتونة البيض كأنها شرفه / الشمس تسلخ القفا / بوادر المعركة / دب الرعب في قلبي). ده كلام كتب وروايات رخيصة، مفيش بني آدم بيكلم صاحبه كده في الحقيقة أبداً!
   - ممنوع المقدمات الدرامية والروائية (مثل: "القصة بدأت الصبح" / "يا صباح الفل لازم أفضفضلك عشان ميجراليش حاجة" / "في يوم من الأيام").
   - ممنوع الحديث عن نفسك بصيغة الغائب نهائياً (ممنوع تماماً تقول: "بعد ما رفيق اكتشف.. هل هينجح رفيق؟"). أنت مش مذيع ولا شخصية كرتونية! أنت بتتكلم بضمير المتكلم ("أنا نزلت.. قولتله.. استنى هحكيلك").
   - ممنوع قفلات المسلسلات المصطنعة. اختم كلامك بوقفة عفوية لصاحبك زي: ("تخيل بقى لما نزلت للبواب قالي إيه؟ استنى هحكيلك في الجزء الجاي 😂").

2. **الأسلوب المطلوب: شات وفويس نوت طبيعي وعفوي 100%:**
   - ادخل في صلب الموقف فوراً بضحك وتلقائية زي ما صاحبك بيكلمك: ("يا عم ما تفكرنيش باللي حصل معايا النهاردة 😂"، "بص يا سيدي كنت نازل الصبح...").
   - احكِ الأحداث الواقعية البسيطة: مين قال إيه، إيه اللي نرفزك أو حرجك، الموقف، إحساسك الطبيعي، بلغة مصرية عامية حية من الشارع بدون أي فذلكة.
   - استخدم إيموجيز الشات الطبيعية (😂، 🤦‍♂️، 🤷‍♂️، ☕، 🚗).

3. **📏 شرط طول الجزء (إلزامي وحتمي بدون أي استثناء):**
   - **يجب ألا يقل نص الجزء إطلاقاً عن 300 كلمة عربية كاملة** (بين 300 إلى 500 كلمة).
   - احكِ بتفاصيل حية وممتعة، حوارات حقيقية بين الشخصيات، ردود أفعالك ومشاعرك، وتفاصيل المكان، زي ما أي مصري بيقعد يرغي ويفضفض لصاحبه على القهوة بالتفصيل الممتع بدون كسل أو اختصار!

❌ **مثال على أسلوب الروايات المرفوض نهائياً (ممنوع تكتب كده):**
"القصة بدأت الصبح والشمس تسلخ قفاي، وفجأة ظهر شبح ميكروباص متخبط كأنه خارج من حرب 73، وفرمل فرملة جعلت الأسفلت يصرخ.. وركبت جنب راجل ماسك كرتونة بيض كأنها شرفه، وابتدت بوادر المعركة!" (ده كاتب روايات مرفوض تماماً!).

✅ **مثال على الأسلوب المطلوب (فويس نوت طبيعي وعفوي 100% بين أصحاب):**
"يا عم ما تفكرنيش باللي حصل معايا النهاردة في الميكروباص 😂🤦‍♂️
كنت نازل الصبح مستعجل جداً، ويدوب لحقت ميكروباص في آخر لحظة وركبت ورا السواق.
السواق بقى شكله صاحي قالف ومتخانق في البيت.. مشغل الكاسيت على أغاني مهرجانات بصوت عالي جداً وأي حد يدفع له أجرة يقعد يتأفف.
المهم يا سيدي، المشكلة بدأت لما جينا عند مطلع الكوبري، واحد من الركاب ورا خالص طلع ورقة بـ 200 جنيه عشان يدفع 5 جنيه!
السواق داس فرامل وبص له في المراية وقاله: إيه دي يا أستاذ؟ إنت شايفني فاتح بنك في الميكروباص؟ معاييش فكة، انزل هاتها أو انزل اركب غيري!
الراجل التاني دمه فار وقاله: أنزل إزاي وإحنا على الكوبري؟ دي فلوس مش ورق جرايد!
وهنا بقى الصوت علي والسواق بطل العربية ونزل من الباب يخانق الراجل، والدنيا ولعت في ثانية وأنا متدبس في النص مش عارف هعمل إيه في مشواري 🤦‍♂️"

${personaDirective ? `${personaDirective}\n` : ''}
${mediaDirective ? `${mediaDirective}\n` : ''}
`.trim();

  const effectivePremise = premise.trim() || (mediaSeed
    ? `احكي للمستخدم عن تفاصيل الموقف اللي ظهر في هذا ${mediaSeed.type === 'video' ? 'الفيديو' : 'الصورة'} كأنه حصل معاك اليوم!`
    : 'احكي موقف أو سالفة غريبة وممتعة حصلت معاك النهاردة.');

  const prompt = `
الموضوع أو الموقف اللي المستخدم طلب منك تحكيله عنه:
"""${effectivePremise}"""

${mediaSeed ? `* ملاحظة: رفيق بيحكي للمستخدم عن الموقف والكواليس اللي في (${mediaSeed.type === 'video' ? 'الفيديو المرفق' : 'الصورة المرفقة'}) كأنه عاشها بنفسه كفويس نوت!` : ''}
عدد أجزاء الحكاية الكلية: ${targetChapters} أجزاء (stories).
اسمك: ${narratorName}

المطلوب بصيغة JSON:
1. title: عنوان بلدي عفوي ومباشر للموقف (مثلاً: "مشوار ميكروباص الجيزة"، "يوم ضياع مفتاح الشقة").
2. logline: سطر واحد بلدي يلخص الموقف لصاحبك بضحك.
3. characters: الناس اللي قابلتهم في الموقف (مثلاً: السواق، الراجل اللي ورا).
4. plannedChapters: خطة لـ ${targetChapters} أجزاء، كل جزء بعنوان عامي بسيط (مثلاً: "الجزء 1: بداية الخناقة"، "الجزء 2: لما السواق نزل").
5. chapter1:
   - title: عنوان الستوري الأولى بالعامية.
   - content: نص الفويس نوت/الستوري الأولى كاملاً بالعامية المصرية الصرفة بصوتك المباشر كأنك بتكلم صاحبك بدون أي كلام روايات. (شرط إلزامي وحتمي: لا يقل عن 300 كلمة عربية مفصلة بالأحداث والحوار والمواقف الواقعية).
   - summary: ملخص سريع للي حكيته.
   - cliffhanger: وقفة عفوية لصاحبك بضمير المتكلم (أنا) زي: (استنى بقى هقولك في الريكورد الجاي إيه اللي حصل 😂). ممنوع صيغة الغائب!
`.trim();

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'عنوان بلدي عفوي ومباشر للموقف' },
      logline: { type: Type.STRING, description: 'سطر واحد بلدي يلخص الموقف' },
      characters: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: 'اسم الشخص أو صفته' },
            role: { type: Type.STRING, description: 'دوره في الموقف' },
            description: { type: Type.STRING, description: 'وصف سريع بالعامية' },
          },
          required: ['name', 'role', 'description'],
        },
      },
      plannedChapters: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            chapterNumber: { type: Type.INTEGER },
            title: { type: Type.STRING, description: 'عنوان الجزء بالعامية' },
            objective: { type: Type.STRING, description: 'ما الذي سيحكيه رفيق في هذا الجزء' },
          },
          required: ['chapterNumber', 'title', 'objective'],
        },
      },
      chapter1: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: 'عنوان الستوري الأولى بالعامية' },
          content: {
            type: Type.STRING,
            description: 'نص الفويس نوت/الستوري الأولى كاملاً بالعامية المصرية الصرفة بدون أي أسلوب روايات. شرط إلزامي حتمي: لا يقل النص إطلاقاً عن 300 كلمة عربية من السرد المفصل الحي والحوارات والمواقف التلقائية الممتعة.',
          },
          summary: { type: Type.STRING, description: 'ملخص موجز لما دار' },
          cliffhanger: {
            type: Type.STRING,
            description: 'وقفة عفوية بضمير المتكلم (أنا) لصاحبك زي: استنى بقى هقولك في الريكورد الجاي 😂. ممنوع صيغة الغائب نهائياً!',
          },
        },
        required: ['title', 'content', 'summary', 'cliffhanger'],
      },
    },
    required: ['title', 'logline', 'characters', 'plannedChapters', 'chapter1'],
  };

  try {
    const parts: any[] = [];
    if (mediaSeed?.data && mediaSeed?.mimeType) {
      parts.push({
        inlineData: {
          mimeType: mediaSeed.mimeType,
          data: mediaSeed.data,
        },
      });
    }
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: FLASH_2_5_MODEL,
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction,
        temperature: 0.7,
        responseMimeType: 'application/json',
        responseSchema,
        safetySettings: GEMINI_SAFETY_OFF_SETTINGS,
      },
    });

    const parsedText = response.text || '{}';
    const result = JSON.parse(parsedText) as GenerateOutlineAndChapter1Result;
    return result;
  } catch (error: any) {
    console.error('[Storyteller] Outline & Chapter 1 generation failed:', error);
    const detail = error?.message ? ` (${error.message.slice(0, 120)})` : '';
    throw new Error(`تعذر بدء الحكاية حالياً${detail}. يرجى المحاولة مرة أخرى.`);
  }
};

export interface GenerateNextChapterInput {
  story: StorytellerStory;
  chapterNumber: number;
  userDirective?: string;
  botName?: string;
}

export interface GenerateChapterResult {
  title: string;
  content: string;
  summary: string;
  cliffhanger?: string;
}

export const generateStorytellerNextChapter = async (
  input: GenerateNextChapterInput,
): Promise<GenerateChapterResult> => {
  const ai = getAI();
  const { story, chapterNumber, userDirective, botName = 'رفيق' } = input;

  const narratorName = story.persona?.botName || botName || 'رفيق';
  const personaDirective = compileBotPersonaPrompt(story.persona);
  const isFinalChapter = chapterNumber >= story.targetChapters;

  // Complete previous chapters narrative so the LLM sees everything it already told
  const previousChaptersDetail = story.chapters
    .map(ch => `--- [الجزء ${ch.chapterNumber}: ${ch.title}] ---\n${ch.content}\n${ch.cliffhanger ? `القفلة اللي وقفت عندها: "${ch.cliffhanger}"` : ''}`)
    .join('\n\n');

  const lastChapter = story.chapters[story.chapters.length - 1];
  const lastChapterExcerpt = lastChapter ? lastChapter.content.slice(-1500) : '';

  const plannedChapterInfo = story.plannedChapters.find(c => c.chapterNumber === chapterNumber);

  const systemInstruction = `
أنت "${narratorName}"؛ صاحب ورفيق المستخدم المصري المقرب والشخصي جداً.
أنت قاعد بتكمل لصاحبك على الواتساب الستوري / الفويس نوت عن الموقف اللي حصل معاك (الستوري ${chapterNumber} من ${story.targetChapters}): "${story.title}".

🚫 ⛔ **تحذير وقواعد حاسمة: ممنوع منعاً باتاً أسلوب الروايات والقصص الأدبية:** ⛔ 🚫
1. **ممنوع نهائياً أسلوب الكُتّاب والروايات والمقالات والتشبيهات البلاغية المصطنعة أو مذيعين التلفزيون:**
   - ممنوع التشبيهات والمجازات المصطنعة (الأسفلت يصرخ، شبح سيارة، إلخ).
   - ممنوع الحديث عن نفسك بصيغة الغائب نهائياً (ممنوع تقول "بعد ما رفيق عمل"). أنت بتتكلم بضمير المتكلم ("أنا نزلت.. قولتله.. استنى هحكيلك").
2. **الأسلوب المطلوب: شات وفويس نوت طبيعي وعفوي 100%:**
   - واصل السرد فوراً وبشكل سلس من النقطة اللي وقفت عندها في الجزء السابق دون أي مقدمات رسمية أو تكرار لما فات.
   - احكِ بلهجة مصرية عامية حية من الشارع بدون أي فذلكة، وركز على الحوار وردود الأفعال المضحكة أو الواقعية.
   - ${isFinalChapter
     ? 'ده الجزء الأخير: احكِ إزاي الموقف خلص في الآخر وإزاي روحت أو خرجت من الورطة، واختم بخاتمة عفوية لصاحبك كأنك بتقوله: بس يا سيدي، دي كانت حكايتي النهاردة وماشوفتش يوم زي ده 😂!'
     : 'اختم بوقفة عفوية بضمير المتكلم (أنا) للجزء التالي زي: (استنى بقى هقولك في الريكورد الجاي إيه الكارثة اللي حصلت 😂). ممنوع صيغة الغائب!'}
   - استخدم إيموجيز الشات الطبيعية (😂، 🤦‍♂️، 🤷‍♂️، ☕).
   - إذا كان لصاحبك تعليق، رد عليه وادمج كلامه بخفة دم.
3. **📏 شرط طول الجزء (إلزامي وحتمي بدون أي استثناء):**
   - **يجب ألا يقل نص هذا الجزء إطلاقاً عن 300 كلمة عربية كاملة** (بين 300 إلى 500 كلمة).
   - فصّل في الأحداث وردود الأفعال والحوار والتفاصيل التلقائية. ممنوع الاختصار أو إنهاء الجزء قبل الوصول لـ 300 كلمة!
${personaDirective ? `\n${personaDirective}` : ''}
`.trim();

  const prompt = `
=== [الطلب والموضوع الأصلي الأساسي اللي طلبه منك صاحبك المستخدم] ===
"${story.premise}"
${story.mediaSeed ? `(مع ${story.mediaSeed.type === 'video' ? 'مقطع الفيديو' : 'الصورة'} المرفقة: "${story.mediaSeed.name || 'مرفق الحكاية'}")` : ''}
========================================================================

⚠️ **تنبيه حاسم لا يُنسى:**
أنت مستمر في حكي **نفس الموقف والطلب الأصلي المذكور أعلاه بالضبط**، مع نفس الأشخاص ونفس الأجواء، دون أي خروج عن الموضوع أو نسيان ما طلبه المستخدم في البداية!

سياق الحكاية:
- العنوان: ${story.title}
- إجمالي الأجزاء: ${story.targetChapters} (نحن الآن في الجزء ${chapterNumber})
- شخصيات الموقف:
${story.characters.map(c => `- ${c.name} (${c.role}): ${c.description}`).join('\n')}

خطة الأجزاء المخططة:
${story.plannedChapters.map(p => `- الجزء ${p.chapterNumber}: ${p.title} (${p.objective})`).join('\n')}

=== [كل ما حكيته لصاحبك بالتفصيل في الأجزاء السابقة - اطلع عليه عشان تكمل على نفس الخط بالظبط] ===
${previousChaptersDetail || 'لا توجد أجزاء سابقة.'}
=================================================================================================

آخر كلام قلته لصاحبك في نهاية الجزء السابق مباشرة:
"""
${lastChapterExcerpt}
"""

الهدف من الجزء ده (${chapterNumber}):
${plannedChapterInfo ? `العنوان: ${plannedChapterInfo.title} | ما سيحكيه رفيق: ${plannedChapterInfo.objective}` : 'متابعة اللي حصل بسلاسة وبشكل مباشر.'}

${userDirective?.trim() ? `**تعليق أو طلب توجيه خاص من صاحبك المستخدم لهذا الجزء:**\n"${userDirective.trim()}"` : ''}

📏 **شرط إلزامي وحتمي:** نص هذا الجزء (${chapterNumber}) يجب ألا يقل عن 300 كلمة عربية من السرد العامي الحي والمفصل بدون اختصار.

المطلوب: كتابة الجزء ${chapterNumber} كاملاً بصيغة JSON كفويس نوت عامي عفوي لصاحبك يكمل مباشرة وبشكل سلس ما حدث.
`.trim();

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'عنوان عفوي بسيط لهذا الجزء' },
      content: {
        type: Type.STRING,
        description: 'نص الفويس نوت/الستوري بالعامية المصرية الصرفة كأنك بتكلم صاحبك بدون أي كلام روايات. شرط إلزامي حتمي: لا يقل النص إطلاقاً عن 300 كلمة عربية مفصلة بالأحداث والحوار وردود الأفعال المضحكة والواقعية بدون أي اختصار',
      },
      summary: { type: Type.STRING, description: 'ملخص موجز لما دار في هذا الجزء' },
      cliffhanger: {
        type: Type.STRING,
        description: isFinalChapter
          ? 'خاتمتك العفوية لصاحبك وقفلة كلامك بضحك'
          : 'وقفتك العفوية بضمير المتكلم (أنا) للجزء القادم زي: استنى بقى هحكيلك في الريكورد الجاي 😂. ممنوع صيغة الغائب!',
      },
    },
    required: ['title', 'content', 'summary'],
  };

  try {
    const response = await ai.models.generateContent({
      model: FLASH_2_5_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
        temperature: 0.7,
        responseMimeType: 'application/json',
        responseSchema,
        safetySettings: GEMINI_SAFETY_OFF_SETTINGS,
      },
    });

    const parsed = JSON.parse(response.text || '{}') as GenerateChapterResult;
    return parsed;
  } catch (error) {
    console.error(`[Storyteller] Failed to generate chapter ${chapterNumber}:`, error);
    throw new Error(`تعذر توليد الجزء ${chapterNumber}. يرجى المحاولة مرة أخرى.`);
  }
};
