export interface FoodItemNutrition {
  name: string;
  arabicName: string;
  serving: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  notes?: string;
}

export const BALADI_FOOD_DATABASE: Record<string, FoodItemNutrition> = {
  'koshary_small': {
    name: 'Koshary (Small)',
    arabicName: 'كشري (علبة صغيرة)',
    serving: 'علبة صغيرة (~300 جم)',
    calories: 500,
    proteinGrams: 16,
    carbsGrams: 90,
    fatGrams: 9,
    notes: 'مصدر كارب عالي وألياف ممتازة من العدس والحمص.',
  },
  'koshary_medium': {
    name: 'Koshary (Medium)',
    arabicName: 'كشري (طبق متوسط)',
    serving: 'طبق متوسط (~450 جم)',
    calories: 750,
    proteinGrams: 22,
    carbsGrams: 130,
    fatGrams: 14,
    notes: 'التقلية والصلصة بالزيت بتزود السعرات.',
  },
  'koshary_large': {
    name: 'Koshary (Large / Special)',
    arabicName: 'كشري (طبق كبير / فويل)',
    serving: 'طبق كبير (~600 جم)',
    calories: 1050,
    proteinGrams: 30,
    carbsGrams: 180,
    fatGrams: 22,
    notes: 'وجبة ضخمة جداً، ممتازة كـ Bulking لو بتتمرن تقيل.',
  },
  'ful_plain': {
    name: 'Ful Mudammas (Plain)',
    arabicName: 'فول مدمس سادة',
    serving: 'طبق صغير (~150 جم)',
    calories: 160,
    proteinGrams: 11,
    carbsGrams: 26,
    fatGrams: 1.5,
    notes: 'بروتين نباتي بطيء الامتصاص وألياف مشبعة جداً.',
  },
  'ful_olive_oil': {
    name: 'Ful with Olive Oil',
    arabicName: 'فول بزيت زيتون وليمون',
    serving: 'طبق متوسط (~200 جم مع معلقة زيت زيتون)',
    calories: 260,
    proteinGrams: 13,
    carbsGrams: 28,
    fatGrams: 11,
    notes: 'دهون صحية ممتازة للقلب.',
  },
  'ful_flaxseed': {
    name: 'Ful with Hot/Flaxseed Oil',
    arabicName: 'فول بزيت حار',
    serving: 'طبق متوسط مع زيت بذر الكتان',
    calories: 270,
    proteinGrams: 13,
    carbsGrams: 28,
    fatGrams: 12,
    notes: 'غني بأوميجا 3 الطبيعي.',
  },
  'taameya_piece': {
    name: 'Taameya (1 piece)',
    arabicName: 'قرص طعمية',
    serving: 'قرص واحد مقلي',
    calories: 85,
    proteinGrams: 3,
    carbsGrams: 8,
    fatGrams: 5,
    notes: 'السعرات الأساسية جاية من تشرب زيت القلي.',
  },
  'taameya_sandwich': {
    name: 'Taameya Sandwich with Salad',
    arabicName: 'ساندوتش طعمية بالسلطة والطحينة',
    serving: 'نص رغيف بلدي أو شامي فيه قرصين وسلطة',
    calories: 320,
    proteinGrams: 8,
    carbsGrams: 42,
    fatGrams: 14,
    notes: 'حاول تقلل الطحينة عشان ما ترفعش الدهون.',
  },
  'baladi_bread': {
    name: 'Egyptian Baladi Bread',
    arabicName: 'رغيف عيش بلدي بالردة',
    serving: 'رغيف كامل واحد (~100-110 جم)',
    calories: 250,
    proteinGrams: 8.5,
    carbsGrams: 52,
    fatGrams: 1.2,
    notes: 'الردة بتوفر ألياف بتبطئ امتصاص السكر مقارنة بالعيش الفينو.',
  },
  'gebna_areesh': {
    name: 'Gebna Areesh (Cottage Cheese)',
    arabicName: 'جبنة قريش',
    serving: '100 جم',
    calories: 98,
    proteinGrams: 12.5,
    carbsGrams: 3.2,
    fatGrams: 1.5,
    notes: 'سحر الكازين (Casein) للجيم، بروتين بطيء الهضم وممتاز قبل النوم.',
  },
  'boiled_egg': {
    name: 'Boiled Egg',
    arabicName: 'بيضة مسلوقة',
    serving: 'بيضة واحدة كبيرة',
    calories: 75,
    proteinGrams: 6.3,
    carbsGrams: 0.6,
    fatGrams: 5.2,
    notes: 'القيمة الحيوية لأعلى بروتين ممكن في الطبيعة.',
  },
  'hawawshi': {
    name: 'Hawawshi',
    arabicName: 'رغيف حواوشي بلدي',
    serving: 'رغيف كامل',
    calories: 520,
    proteinGrams: 24,
    carbsGrams: 48,
    fatGrams: 26,
    notes: 'دهون اللحمة والعيش بتخليه دسم، ممتاز كوجبة مفتوحة محسوبة.',
  },
  'grilled_chicken_breast': {
    name: 'Grilled Chicken Breast',
    arabicName: 'صدر فرخة مشوي',
    serving: '150 جم مشوي بدون جلد',
    calories: 220,
    proteinGrams: 38,
    carbsGrams: 0,
    fatGrams: 4.5,
    notes: 'الملك الصافي للبروتين والتنشيف.',
  },
};

/**
 * Calculates total nutritional breakdown from a list of Egyptian food keys or queries.
 */
export function calculateBaladiMeal(foodKeys: string[]): {
  items: FoodItemNutrition[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  coachAdvice: string;
} {
  const items: FoodItemNutrition[] = [];
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  for (const key of foodKeys) {
    const item = BALADI_FOOD_DATABASE[key];
    if (item) {
      items.push(item);
      totalCalories += item.calories;
      totalProtein += item.proteinGrams;
      totalCarbs += item.carbsGrams;
      totalFat += item.fatGrams;
    }
  }

  let coachAdvice = 'وجبة متوازنة يا بطل!';
  if (totalProtein >= 25) {
    coachAdvice = 'عاش يا وحش، جرعة بروتين محترمة جداً للبناء العضلي.';
  } else if (totalCarbs >= 100) {
    coachAdvice = 'كارب عالي يديك طاقة جبارة للتمرين، بس راعي باقي اليوم لو بتنشف.';
  } else if (totalFat >= 30) {
    coachAdvice = 'الوجبة دسمة شوية، اشرب مياه كتير وخلي وجبتك الجاية خفيفة في الدهون.';
  }

  return {
    items,
    totalCalories,
    totalProtein: Math.round(totalProtein * 10) / 10,
    totalCarbs: Math.round(totalCarbs * 10) / 10,
    totalFat: Math.round(totalFat * 10) / 10,
    coachAdvice,
  };
}
