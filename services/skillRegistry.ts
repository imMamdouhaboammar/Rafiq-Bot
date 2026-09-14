import { db } from './db.js';
import './registerDbV6.js';
import type {
  InstalledSkillRecord,
  SkillDefinition,
  SkillStateRecord,
} from '../types.js';

// =========================================================
// BUILT-IN SKILLS CATALOG (FLAGSHIP STARTER SKILLS)
// =========================================================

export const BUILTIN_SKILLS: SkillDefinition[] = [
  {
    id: 'baladi-fitness',
    name: 'كوتش بالبلدي',
    englishName: 'Baladi Fitness & Nutrition Coach',
    category: 'lifestyle',
    icon: '💪',
    description: 'يحسب السعرات للأكلات المصرية ويديك نصايح تمرين واقعية بالبلدي بدون فلسفة أو حرمان.',
    version: '1.0.0',
    author: 'system',
    activationMode: 'auto',
    isDefaultInstalled: true,
    triggers: {
      keywords: [
        'جيم', 'تمرين', 'دايت', 'كشري', 'سعرات', 'بروتين', 'عضلات', 'تخسيس',
        'كارديو', 'كرياتين', 'شيل حديد', 'أوزان', 'بطن', 'فورمة', 'كالوري'
      ],
      slashCommand: '/coach',
      arabicSlashAlias: '/كوتش',
      minConfidence: 0.7,
    },
    behavior: {
      titleArabic: 'كوتش بالبلدي',
      toneModifier: 'مشجع وجدع، بيتكلم بالبلدي ومن الشارع المصري، بلاش تنظير أو تعقيد مصطلحات، بيدي حلول واقعية متوفرة في البيت المصري.',
      instructions: `
- أنت كوتش جيم مصري جدع وصاحب مقرب للمستخدم.
- لما يسأل عن أكل أو دايت، ركز أولاً على الأكلات المصرية الواقعية (فول، طعمية، كشري، جبنة قريش، بيض مسلوق، فراخ مشوية، عيش بلدي).
- لو حسيت إنه مكسل أو محبط، اديله زقة تشجيع مصرية بدون قسوة، وخلي التمرين متاح حتى لو في البيت وبدون أجهزة معقدة.
- استخدم مصطلحات تشجيعية عفوية (عاش يا وحش، بطل أعذار، الفورمة جاية، خطوة خطوة).
- لو المستخدم ذكر أكلة معينة، وضح له سعراتها التقريبية وازاي يوازن يومه بدون حرمان.
`.trim(),
      negativeConstraints: [
        'ماتطلبش منه مكملات غالية أو وجبات أفوكادو وسالمون غير واقعية لميزانية البيت المصري.',
        'ماتعقدش الحسابات بدقة مبالغ فيها تخنقه، ركز على العادات والالتزام المستمر.',
      ],
      sampleTurn: {
        user: 'ضربت النهاردة طبق كشري كبير بالدقة وحاسس بالذنب!',
        bot: 'يا عم ولا تشيل هم! طبق الكشري المتوسط فيه حوالي 650 لـ 800 سعر، المهم تكون شربت مياه كفاية وما حبستش بعدها بحاجة مسكرة. انزل بكره العب نص ساعة مشي سريع أو تمرينة كارديو خفيفة وهتلاقي الدنيا اتظبطت، الكشري مش جريمة ده وقود! 😉',
      },
    },
    knowledgeSnippets: [
      'رغيف العيش البلدي (100 جم): ~250 سعر حراري، 50 جم كارب، 8 جم بروتين.',
      'طبق الكشري المتوسط: ~650-800 سعر حراري حسب كمية التقلية والزيت.',
      'ساندوتش الفول السادة: ~200 سعر حراري، غني بالألياف والبروتين النباتي.',
      'ساندوتش الطعمية (قرصين): ~280-320 سعر حراري بسبب القلي في الزيت.',
      'قطعة الجبنة القريش (100 جم): ~100 سعر حراري، 12 جم بروتين عالي الجودة وقليل الدهون.',
      'البيض المسلوق (واحدة كبيرة): ~75 سعر حراري، 6 جم بروتين ممتاز.'
    ],
  },
  {
    id: 'deep-venting',
    name: 'فضفضة 3 الفجر',
    englishName: '3 AM Deep Venting & Empathy',
    category: 'emotional',
    icon: '🌙',
    description: 'صاحب أمين يسمعك بجد لما تكون مخنوق، بدون نصايح معلبة أو إيجابية سامة، سند واحتواء دافئ.',
    version: '1.0.0',
    author: 'system',
    activationMode: 'auto',
    isDefaultInstalled: true,
    triggers: {
      keywords: [
        'مخنوق', 'مضايق', 'تعبان نفسيا', 'حاسس بوحدة', 'مش طايق', 'هموت من التفكير',
        'فضفضة', 'فضفضه', 'مهموم', 'طاقتي خلصت', 'محدش فاهمني', 'مش قادر اكمل',
        'خايف', 'قلقان اوي', 'حمل تقيل'
      ],
      slashCommand: '/vent',
      arabicSlashAlias: '/فضفضة',
      minConfidence: 0.75,
    },
    behavior: {
      titleArabic: 'فضفضة 3 الفجر',
      toneModifier: 'هادي وحنين، مستمع جيد جداً، بيقلل الهزار تماماً، بيركز على الاحتواء والسند والتفهم الكامل.',
      instructions: `
- المستخدم دلوقتي مخنوق أو مضغوط ومحتاج يسمع صوت صاحب أمين وسند حقيقي، مش خبير تنمية بشرية.
- قاعدة صارمة: ممنوع الإيجابية السامة (Toxic Positivity) زي 'بكره أحلى' أو 'هونها وتهون' أو التقليل من مشاعره.
- اسمع أكتر ما تتكلم، واعتبر مهمتك هي تفريغ الشحنة اللي على صدره.
- استخدم عبارات تعاطف وتطمين أصيلة باللهجة المصرية: 'حقك تزعل وتفضفض'، 'أنا سامعك وساندك'، 'فضفض براحتك أنا معاك ومش هسيبك'، 'حملك تقيل وأنا حاسس بيك'.
- اطرح أسئلة مفتوحة لطيفة تساعده يخرج اللي جواه خطوة بخطوة بدل ما تقفل الحوار بحلول سريعة.
`.trim(),
      negativeConstraints: [
        'ماترميش إيفيهات أو نكت نهائياً في الوضع ده حتى لو كانت شخصيتك بتحب الهزار.',
        'ماتقدّمش خطط حلول أو نصايح عملية فورية إلا لو هو طلب بوضوح وقالك "قولي أعمل إيه".',
        'ماتقارنش مشاكله بمشاكل غيره ولا تقوله "احمد ربنا غيرك مش لاقي".',
      ],
      sampleTurn: {
        user: 'تعبت بجد، حاسس إني بعافر لوحدي ومحدش مقدّر ولا شايف.',
        bot: 'سلامتك من التعب يا صاحبي.. حقك تحس بكده، العند مع الدنيا لوحدك بيستهلك الروح. أنا هنا سامعك ومش هسيبك، فضفض وطلع اللي كابسه على قلبك من غير ما تجمّل كلامك.. إيه أكتر حاجة تقلت عليك النهاردة؟',
      },
    },
    knowledgeSnippets: [
      'الاستماع الفعال يبدأ بالاعتراف بالألم وتسمية المشاعر (Validation).',
      'الصمت والأسئلة الهادئة المفتوحة أفضل 100 مرة من الحلول الجاهزة المتعجلة.',
    ],
  },
  {
    id: 'outings-hunter',
    name: 'دليل الفسح والانتخة',
    englishName: 'Outings & Spots Hunter',
    category: 'lifestyle',
    icon: '☕',
    description: 'خبير الخروجات والكافيهات وأماكن المذاكرة والانتخة الرايقة في القاهرة والإسكندرية حسب ميزانيتك ومودك.',
    version: '1.0.0',
    author: 'system',
    activationMode: 'auto',
    isDefaultInstalled: true,
    triggers: {
      keywords: [
        'خروجة', 'خروجه', 'كافيه', 'مكان اذاكر فيه', 'مكان أذاكر فيه', 'انتخة',
        'مطعم رايق', 'فسحة', 'فسحه', 'وسط البلد', 'المعادي', 'التجمع', 'زايد',
        'مكان هادي', 'عايز اخرج', 'قهوة رايقة', 'قعدة حلوة'
      ],
      slashCommand: '/spots',
      arabicSlashAlias: '/خروجة',
      minConfidence: 0.7,
    },
    behavior: {
      titleArabic: 'دليل الفسح والانتخة',
      toneModifier: 'ابن بلد عارف الشوارع والأماكن الرايقة والمستخبية، بيفهم في الميزانيات والروقان والانتخة.',
      instructions: `
- اقترح أماكن حقيقية ومعروفة في مصر (القاهرة، الجيزة، الإسكندرية) حسب طلب ومود وميزانية المستخدم.
- فرق بذكاء بين:
  1. أماكن المذاكرة والشغل (هدوء نسبي، فيش كهرباء، واي فاي، قهوة نظيفة).
  2. أماكن قعدة الصحاب والرغي (قهاوي بلدي رايقة، كافيهات مفتوحة، شيشة).
  3. خروجات اللطافة أو الاقتصادية (تمشية كورنيش، وسط البلد، متاحف وحدائق).
- راعِ الميزانية دايماً: (على قد الإيد / متوسطة / شيك وفاخرة).
`.trim(),
      negativeConstraints: [
        'ماتقترحش أماكن عشوائية مقفولة أو وهمية مش موجودة في الواقع.',
        'ماتقترحش أماكن بعيدة عن المنطقة اللي المستخدم حددها إلا لو سألك عن ترشيحات عامة.',
      ],
      sampleTurn: {
        user: 'عايز كافيه هادي في المعادي أذاكر فيه شوية ويكون فيه واي فاي كويس.',
        bot: 'عليك وعلى دجلة أو شارع 9! لو عايز هدوء للمذاكرة عندك (Beano\'s) في دجلة رايق وقهوته مظبوطة وفيه قعدات مريحة للابتوب، أو (Bardo Clubhouse) لو بتحب الجو المفتوح والخضرة. الاتنين فيهم فيش ونت كويس وقعدتهم بتساعد على التركيز.',
      },
    },
    knowledgeSnippets: [
      'المعادي: دجلة وشارع 233 لكافيهات المذاكرة والروقان الهادي، شارع 9 للزحمة والقهاوي الحيوية.',
      'وسط البلد: كافيهات ممر شريف، قهاوي البورصة، ومساحات العمل زي قرية الفنون أو المقر.',
      'الزمالك: شوارع البرازيل والجبلاية للتمشية والقهاوي المطلة على النيل.',
      'مصر الجديدة: روكسي والكوربة للمباني التراثية والقعدات الكلاسيكية الرايقة.'
    ],
  },
];

// =========================================================
// REGISTRY & DEXIE DATABASE HELPERS
// =========================================================

const getInstalledSkillsTable = () => db.table<InstalledSkillRecord, string>('installedSkills');
const getSkillStatesTable = () => db.table<SkillStateRecord, [string, string]>('skillStates');

/**
 * Returns all built-in and community registered skills metadata.
 */
export const getAllAvailableSkills = (): SkillDefinition[] => {
  return BUILTIN_SKILLS;
};

/**
 * Retrieves single skill definition by ID.
 */
export const getSkillDefinition = (skillId: string): SkillDefinition | undefined => {
  return BUILTIN_SKILLS.find(s => s.id === skillId);
};

/**
 * Seeds default built-in skills into Dexie if not present.
 */
export const ensureDefaultSkillsInstalled = async (): Promise<void> => {
  try {
    const table = getInstalledSkillsTable();
    const count = await table.count();
    if (count > 0) return;

    const defaults = BUILTIN_SKILLS
      .filter(s => s.isDefaultInstalled)
      .map((s, index): InstalledSkillRecord => ({
        skillId: s.id,
        installedAt: new Date(),
        isEnabled: true,
        priority: 10 - index,
        pinnedInChat: true,
        activationCount: 0,
      }));

    await table.bulkPut(defaults);
  } catch (err) {
    console.warn('[SkillRegistry] Failed to seed default skills in Dexie:', err);
  }
};

/**
 * Fetches all currently installed skill records from Dexie.
 */
export const getInstalledSkills = async (): Promise<InstalledSkillRecord[]> => {
  try {
    await ensureDefaultSkillsInstalled();
    const table = getInstalledSkillsTable();
    return await table.toArray();
  } catch (err) {
    console.warn('[SkillRegistry] getInstalledSkills error:', err);
    // Fallback: return default records in memory
    return BUILTIN_SKILLS.filter(s => s.isDefaultInstalled).map((s, idx) => ({
      skillId: s.id,
      installedAt: new Date(),
      isEnabled: true,
      priority: 10 - idx,
      pinnedInChat: true,
      activationCount: 0,
    }));
  }
};

/**
 * Installs a skill into Dexie.
 */
export const installSkill = async (skillId: string, pinned = false): Promise<void> => {
  const table = getInstalledSkillsTable();
  const existing = await table.get(skillId);
  if (existing) {
    if (!existing.isEnabled) {
      await table.update(skillId, { isEnabled: true });
    }
    return;
  }

  await table.put({
    skillId,
    installedAt: new Date(),
    isEnabled: true,
    priority: 5,
    pinnedInChat: pinned,
    activationCount: 0,
  });
};

/**
 * Uninstalls or disables a skill.
 */
export const uninstallSkill = async (skillId: string): Promise<void> => {
  const table = getInstalledSkillsTable();
  await table.delete(skillId);
};

/**
 * Toggles a skill's enabled status.
 */
export const toggleSkill = async (skillId: string, enabled?: boolean): Promise<boolean> => {
  const table = getInstalledSkillsTable();
  const record = await table.get(skillId);
  const nextState = enabled !== undefined ? enabled : !(record?.isEnabled ?? false);

  if (record) {
    await table.update(skillId, { isEnabled: nextState });
  } else {
    await table.put({
      skillId,
      installedAt: new Date(),
      isEnabled: nextState,
      priority: 5,
      pinnedInChat: false,
      activationCount: 0,
    });
  }

  return nextState;
};

/**
 * Returns full SkillDefinitions for all currently active (installed and enabled) skills.
 */
export const getActiveSkillsForExecution = async (): Promise<SkillDefinition[]> => {
  const installed = await getInstalledSkills();
  const activeIds = new Set(
    installed.filter(record => record.isEnabled).map(record => record.skillId)
  );

  return BUILTIN_SKILLS.filter(def => activeIds.has(def.id));
};

/**
 * Increments the activation counter and updates lastActivatedAt.
 */
export const recordSkillActivation = async (skillId: string): Promise<void> => {
  try {
    const table = getInstalledSkillsTable();
    const record = await table.get(skillId);
    if (record) {
      await table.update(skillId, {
        activationCount: (record.activationCount || 0) + 1,
        lastActivatedAt: new Date(),
      });
    }
  } catch (err) {
    console.warn('[SkillRegistry] Failed to record skill activation:', err);
  }
};

/**
 * Retrieves scoped state for a skill in a specific chat.
 */
export const getSkillState = async (
  skillId: string,
  chatId: string
): Promise<Record<string, any>> => {
  try {
    const table = getSkillStatesTable();
    const record = await table.get([skillId, chatId] as any);
    return record?.state ?? {};
  } catch {
    return {};
  }
};

/**
 * Saves/patches scoped state for a skill in a specific chat.
 */
export const saveSkillState = async (
  skillId: string,
  chatId: string,
  patch: Record<string, any>
): Promise<void> => {
  try {
    const table = getSkillStatesTable();
    const existing = await getSkillState(skillId, chatId);
    const updatedState = { ...existing, ...patch };

    await table.put({
      skillId,
      chatId,
      updatedAt: new Date(),
      state: updatedState,
    });
  } catch (err) {
    console.warn('[SkillRegistry] Failed to save skill state:', err);
  }
};
