import assert from "node:assert/strict";
import {
  matchLorebookEntries,
  normalizeArabicForSearch,
  formatLorebookPromptContext,
  extractLorebookCandidatesFromChat,
  type LorebookEntry,
} from "../services/lorebookEngine.js";

// 1. Normalizes Arabic text correctly
const text1 = "فَاكِرْ يَوْمَ رُحْنَا إِسْكَنْدَرِيَّة؟";
const normalized = normalizeArabicForSearch(text1);
assert.equal(normalized, "فاكر يوم رحنا اسكندريه؟");

const text2 = "أَحْمَدْ  صَاحِبْنَا   فِي   الْقَاهِرَةِ";
assert.equal(normalizeArabicForSearch(text2), "احمد صاحبنا في القاهره");

// 2. Matches lorebook entries on keywords with priorities
const entries: LorebookEntry[] = [
  {
    id: "1",
    chatId: "chat-1",
    title: "خناقة الساحل",
    keywords: ["الساحل", "مارينا", "تضييع المفاتيح"],
    content: "اتخانقنا في مارينا في صيف 2023 بسبب تضييع مفاتيح الشاليه وقعدنا نضحك.",
    category: "event",
    sentiment: "conflict",
    priority: 8,
    enabled: true,
    triggerCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "2",
    chatId: "chat-1",
    title: "قهوة الفيشاوي",
    keywords: ["الفيشاوي", "شاي بالنعناع"],
    content: "قعدتنا المفضلة يوم الخميس بليل في الحسين.",
    category: "place",
    sentiment: "warm",
    priority: 5,
    enabled: true,
    triggerCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const matches1 = matchLorebookEntries("فاكر لما كنا في الساحل وضيعت المفاتيح؟", entries);
assert.equal(matches1.length, 1);
assert.equal(matches1[0].entry.title, "خناقة الساحل");
assert.ok(matches1[0].matchedKeywords.includes("الساحل"));

const promptBlock = formatLorebookPromptContext(matches1);
assert.ok(promptBlock.includes("LOREBOOK FLASHBACKS"));
assert.ok(promptBlock.includes("خناقة الساحل"));
assert.ok(promptBlock.includes("طابع: conflict"));

// 3. Extracts lorebook candidates from WhatsApp chat patterns
const sampleChat = [
  { text: "فاكر يوم ما روحنا المعمورة وفضلنا صاحيين للصبح؟", sender: "Ahmed" },
  { text: "خناقة كشري التحرير لما الحساب طلع غلط وقومنا خناقة", sender: "Mohamed" },
  { text: "ألو عامل إيه النهاردة؟", sender: "Ahmed" },
];

const candidates = extractLorebookCandidatesFromChat("test-chat", sampleChat);
assert.equal(candidates.length, 2);
assert.ok(candidates.some((c) => c.title.includes("المعمورة")));
assert.ok(candidates.some((c) => c.title.includes("كشري التحرير")));

console.log("Lorebook Engine tests passed successfully!");
