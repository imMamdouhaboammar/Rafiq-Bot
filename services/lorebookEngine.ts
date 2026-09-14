import { z } from "zod";

export const LorebookCategorySchema = z.enum([
  "person",
  "place",
  "event",
  "inside_joke",
  "habit",
  "secret",
  "general",
]);

export type LorebookCategory = z.infer<typeof LorebookCategorySchema>;

export const LorebookEntrySchema = z.object({
  id: z.string(),
  chatId: z.string(),
  title: z.string().trim().min(1).max(120),
  keywords: z.array(z.string().trim().min(1).max(80)).min(1),
  content: z.string().trim().min(1).max(1200),
  category: LorebookCategorySchema.default("general"),
  sentiment: z.enum(["warm", "funny", "nostalgic", "conflict", "neutral"]).default("neutral"),
  priority: z.number().int().min(1).max(10).default(5),
  enabled: z.boolean().default(true),
  triggerCount: z.number().int().min(0).default(0),
  lastTriggeredAt: z.coerce.date().optional(),
  createdAt: z.coerce.date().default(() => new Date()),
  updatedAt: z.coerce.date().default(() => new Date()),
});

export type LorebookEntry = z.infer<typeof LorebookEntrySchema>;

export interface LorebookMatchResult {
  entry: LorebookEntry;
  matchedKeywords: string[];
  score: number;
}

export interface LorebookMatchOptions {
  maxEntries?: number;
  minScore?: number;
  incrementTriggerCount?: boolean;
}

/**
 * Normalizes Arabic text by removing diacritics, unifying alef/yaa/taa marbouta,
 * and stripping non-alphanumeric noise for robust keyword detection.
 */
export function normalizeArabicForSearch(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    // Remove Arabic diacritics (tashkeel)
    .replace(/[\u064B-\u065F\u0670]/g, "")
    // Remove tatweel (kashida)
    .replace(/\u0640/g, "")
    // Normalize Alefs
    .replace(/[إأآا]/g, "ا")
    // Normalize Yaa / Alef Maksura
    .replace(/[ىي]/g, "ي")
    // Normalize Taa Marbouta / Haa
    .replace(/ة/g, "ه")
    // Normalize Persian/Urdu Kaf & Gaf
    .replace(/ك/g, "ك")
    .replace(/[\s\t\n]+/g, " ")
    .trim();
}

/**
 * Matches user or context text against active lorebook entries using normalized token & phrase matching.
 */
export function matchLorebookEntries(
  text: string,
  entries: LorebookEntry[],
  options: LorebookMatchOptions = {}
): LorebookMatchResult[] {
  const { maxEntries = 5, minScore = 1 } = options;
  if (!text || !entries || entries.length === 0) return [];

  const normalizedInput = normalizeArabicForSearch(text);
  if (!normalizedInput) return [];

  const results: LorebookMatchResult[] = [];

  for (const entry of entries) {
    if (!entry.enabled) continue;

    const matchedKeywords: string[] = [];
    let entryScore = 0;

    for (const keyword of entry.keywords) {
      const normalizedKeyword = normalizeArabicForSearch(keyword);
      if (!normalizedKeyword) continue;

      // Exact substring or word boundary match
      if (normalizedInput.includes(normalizedKeyword)) {
        matchedKeywords.push(keyword);
        // Multi-word keywords get higher weight
        const wordCount = normalizedKeyword.split(" ").length;
        entryScore += wordCount * 2 + entry.priority;
      }
    }

    if (matchedKeywords.length > 0 && entryScore >= minScore) {
      results.push({
        entry,
        matchedKeywords,
        score: entryScore,
      });
    }
  }

  // Sort by highest match score and priority
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.entry.priority - a.entry.priority;
  });

  return results.slice(0, maxEntries);
}

/**
 * Formats matched lorebook entries into an authentic Egyptian prompt context block.
 */
export function formatLorebookPromptContext(matches: LorebookMatchResult[]): string {
  if (!matches || matches.length === 0) return "";

  const lines: string[] = [
    "=== دفتر الذكريات والمواقف المشتركة (LOREBOOK FLASHBACKS) ===",
    "تذكر هذه المواقف والتفاصيل المشتركة واستحضرها بعفوية إذا ناسبت سياق الكلام:",
  ];

  for (const match of matches) {
    const { title, content, sentiment } = match.entry;
    const sentimentTag = sentiment && sentiment !== "neutral" ? ` [طابع: ${sentiment}]` : "";
    lines.push(`• [${title}]${sentimentTag}: ${content}`);
  }

  lines.push("==========================================================");
  return lines.join("\n");
}

/**
 * Heuristic/Pattern extractor for generating initial Lorebook candidates from WhatsApp export messages.
 */
export function extractLorebookCandidatesFromChat(
  chatId: string,
  messages: Array<{ text: string; sender?: string; timestamp?: Date }>
): LorebookEntry[] {
  const candidates: LorebookEntry[] = [];
  const seenTitles = new Set<string>();

  // Egyptian trigger phrases indicating memorable shared events or inside jokes
  const patternRules: Array<{
    regex: RegExp;
    category: LorebookCategory;
    titleGen: (match: RegExpMatchArray) => string;
    sentiment: "warm" | "funny" | "nostalgic" | "conflict";
  }> = [
    {
      regex: /فاكر (?:يوم|لما|ساعة|وقت) ([^\n.؟!?]+)/i,
      category: "event",
      titleGen: (m) => `ذكرى: ${m[1].slice(0, 30).trim()}`,
      sentiment: "nostalgic",
    },
    {
      regex: /(?:خناقة|يوم ما اتخانقنا|الزعلة بتاعة) ([^\n.؟!?]+)/i,
      category: "event",
      titleGen: (m) => `موقف: ${m[1].slice(0, 30).trim()}`,
      sentiment: "conflict",
    },
    {
      regex: /(?:كل ما نروح|لما بنروح|قعدة|سهرة) ([^\n.؟!?]+)/i,
      category: "place",
      titleGen: (m) => `مكان وقعدة: ${m[1].slice(0, 30).trim()}`,
      sentiment: "warm",
    },
    {
      regex: /(?:الإيفيه بتاع|الألشة بتاعة|كلمة) ([^\n.؟!?]+)/i,
      category: "inside_joke",
      titleGen: (m) => `إيفيه مشترك: ${m[1].slice(0, 30).trim()}`,
      sentiment: "funny",
    },
  ];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg.text || msg.text.length < 15) continue;

    for (const rule of patternRules) {
      const match = msg.text.match(rule.regex);
      if (match && match[1]) {
        const rawSubject = match[1].trim();
        const title = rule.titleGen(match);
        if (seenTitles.has(title) || rawSubject.length < 3) continue;

        seenTitles.add(title);

        // Keywords extraction: subject words + trigger word
        const keywords = [
          ...rawSubject.split(/\s+/).filter((w) => w.length > 2),
          rawSubject,
        ].slice(0, 5);

        candidates.push({
          id: `lore_${chatId}_${Date.now()}_${candidates.length}`,
          chatId,
          title,
          keywords,
          content: msg.text.slice(0, 300).trim(),
          category: rule.category,
          sentiment: rule.sentiment,
          priority: 6,
          enabled: true,
          triggerCount: 0,
          createdAt: msg.timestamp || new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }

  return candidates;
}
