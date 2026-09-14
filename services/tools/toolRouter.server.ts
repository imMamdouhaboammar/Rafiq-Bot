import { ToolIntent, ExtractedUrl } from "./toolTypes.js";

/**
 * Extracts URLs from a given text string.
 * Supports http, https, www, and bare domains with paths if clearly URLs.
 */
export const extractUrls = (text: string): ExtractedUrl[] => {
  if (!text) return [];

  // Regex to match:
  // 1. https://... or http://...
  // 2. www.domain.com...
  // 3. domain.com/path (clearly a URL)
  // 4. bare domains ending in common TLDs like .com, .net, .org, .info, .io, .ai, .edu, .gov
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)|([a-zA-Z0-9-]+\.(?:com|net|org|info|io|ai|edu|gov|co|me|ly)(?:\/[^\s]*)?)/gi;

  const urls: ExtractedUrl[] = [];
  const seen = new Set<string>();
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    const raw = match[0].replace(/[.,;:!?"')\]]+$/, ""); // Strip trailing punctuation
    if (seen.has(raw)) continue;
    seen.add(raw);

    let normalized = raw;
    if (!/^https?:\/\//i.test(raw)) {
      if (/^www\./i.test(raw)) {
        normalized = `https://${raw}`;
      } else {
        normalized = `https://${raw}`;
      }
    }

    try {
      new URL(normalized);
      urls.push({ raw, normalized });
    } catch {
      // Ignore invalid URLs
    }
  }

  return urls;
};

/**
 * Pre-flight routing logic to determine the user's intent.
 * Evaluates rules quickly without making expensive LLM calls.
 */
export const routeIntent = (messageText: string): ToolIntent => {
  if (!messageText) return "none";

  const text = messageText.trim().toLowerCase();
  const urls = extractUrls(messageText);

  // 1. Check for URL reader intent first (if message contains URLs)
  if (urls.length > 0) {
    const openUrlTriggers = [
      "افتح", "اقرأ", "اقرا", "لخص", "قولي رأيك", "شوفلي", "بص على",
      "شيك على", "حلل", "مكتوب ايه", "مكتوب إيه", "open", "read", "summarize",
      "analyze", "audit", "opinion", "inspect"
    ];

    const hasOpenTrigger = openUrlTriggers.some(trigger => text.includes(trigger));
    if (hasOpenTrigger) {
      return "open_url";
    }

    // If there is a URL and the message is very short or general, default to opening the URL
    // e.g., "https://example.com" or "الموقع ده https://example.com"
    if (text.length < 150) {
      return "open_url";
    }
  }

  // 2. Check for time awareness triggers (date, time, relative day inquiries)
  // We match specific time/date questions. General chats mentioning "today" or "tomorrow"
  // are handled via always-on cheap RuntimeAwarenessContext inside the main prompt, so they remain fast.
  const timeInquiryTriggers = [
    "الساعة كام", "الساعه كام", "الوقت كام", "الوقت دلوقتي", "النهارده كام", "النهارده كام في الشهر",
    "تاريخ النهارده", "النهارده ايه", "النهارده إيه", "تاريخ اليوم", "بكره كام", "بكرة كام",
    "الساعة كام عندك", "الساعه كام عندك", "كم الساعة", "كم الساعه", "ما هو تاريخ اليوم",
    "what time is it", "current time", "what is today", "what's the date", "today's date"
  ];

  const isTimeInquiry = timeInquiryTriggers.some(trigger => text.includes(trigger));
  if (isTimeInquiry) {
    return "current_time";
  }

  // 3. Check for deep search / research triggers ("search_and_read")
  // These represent complex requests needing both search and reading sources.
  const deepSearchTriggers = [
    "اعمل بحث", "اعملي بحث", "قارن بين", "دورلي على أفضل", "دورلي على افضل", "سوي بحث",
    "أفضل أدوات", "افضل ادوات", "deep search", "research about", "compare between"
  ];

  const isDeepSearch = deepSearchTriggers.some(trigger => text.includes(trigger));
  if (isDeepSearch) {
    return "search_and_read";
  }

  // 4. Check for general web search triggers
  const webSearchTriggers = [
    "دورلي", "دور لي", "ابحث عن", "هات آخر", "آخر أخبار", "اخر اخبار", "ترند",
    "سعر الدولار", "سعر الذهب", "طقس", "اخبار الرياضة", "ترتيب الدوري", "سعر اليوم",
    "search for", "latest news", "weather in", "stock price", "current version",
    "مواعيد", "قوانين", "إحصائيات حديثة", "احصائيات حديثة", "آخر سعر"
  ];

  const isWebSearch = webSearchTriggers.some(trigger => text.includes(trigger));
  if (isWebSearch) {
    return "web_search";
  }

  // 5. Check if the question is about current facts or models (e.g. Gemini 1.5, GPT-4o, years >= 2024, etc.)
  // which definitely require current facts.
  const currentFactKeywords = [
    "سعر الذهب", "سعر الدولار", "سعر العملات", "أسعار العملات", "اسعار العملات",
    "سعر الفائدة", "البنك المركزي", "تريند", "ترند", "مباراة اليوم", "ماتش النهارده", "ماتش النهار ده"
  ];
  if (currentFactKeywords.some(keyword => text.includes(keyword))) {
    return "web_search";
  }

  // Safe fallback to none (casual chat, emotional support, general knowledge, etc.)
  return "none";
};
