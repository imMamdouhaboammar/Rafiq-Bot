import assert from "node:assert/strict";
import { getRuntimeAwarenessContext, injectRuntimeAwarenessPrompt } from "../services/realtimeAwareness.server.ts";
import { getCurrentTime } from "../services/tools/timeTool.server.ts";
import { routeIntent, extractUrls } from "../services/tools/toolRouter.server.ts";
import { isPrivateIp, executeWebReader } from "../services/tools/webReaderTool.server.ts";
import { executeWebSearch } from "../services/tools/webSearchTool.server.ts";
import { executeResearchWeb } from "../services/tools/researchTool.server.ts";
import { formatTimeResult, formatSearchResult, formatReaderResult, formatResearchResult } from "../services/tools/toolResultFormatter.ts";

console.log("🚀 Starting Real-time Awareness and Web Tools Test Suite...");

// -------------------------------------------------------------
// Test 1: Time Awareness & Timezone calculations
// -------------------------------------------------------------
console.log("🧪 Testing: Time Awareness & Timezone Calculations");
{
  const timeResult = getCurrentTime({ timezone: "Africa/Cairo", locale: "ar-EG" });
  
  assert.ok(timeResult.iso, "ISO timestamp should be present");
  assert.equal(timeResult.timezone, "Africa/Cairo");
  assert.equal(timeResult.locale, "ar-EG");
  assert.ok(timeResult.dateText, "Date text should be present");
  assert.ok(timeResult.timeText, "Time text should be present");
  assert.ok(timeResult.dayName, "Day name should be present");
  assert.ok(typeof timeResult.hour === "number", "Hour should be a number");
  assert.ok(typeof timeResult.minute === "number", "Minute should be a number");
  assert.ok(["morning", "afternoon", "evening", "night"].includes(timeResult.period), "Period must be valid");

  // Validate that default configurations fallback cleanly
  const defaultTime = getCurrentTime();
  assert.ok(defaultTime.iso);
}

// -------------------------------------------------------------
// Test 2: Runtime Awareness Prompt Injection
// -------------------------------------------------------------
console.log("🧪 Testing: Runtime Awareness Prompt Injection");
{
  const context = getRuntimeAwarenessContext("Africa/Cairo", "ar-EG");
  assert.ok(context.nowIso);
  assert.equal(context.timezone, "Africa/Cairo");
  assert.ok(context.localDate);
  assert.ok(context.localTime);
  assert.ok(context.dayName);

  const promptBlock = injectRuntimeAwarenessPrompt(context);
  assert.match(promptBlock, /\[REALTIME_CONTEXT\]/);
  assert.match(promptBlock, /Current Time State:/);
  assert.match(promptBlock, /ISO Timestamp:/);
  assert.match(promptBlock, /Timezone:/);
  assert.match(promptBlock, /Day:/);
}

// -------------------------------------------------------------
// Test 3: URL Extraction & Normalization
// -------------------------------------------------------------
console.log("🧪 Testing: URL Extraction & Normalization");
{
  const textWithUrls = "شوف الموقع ده https://example.com وكمان www.google.com/search?q=test والمقالة دي wikipedia.org/wiki/Egypt";
  const extracted = extractUrls(textWithUrls);
  
  assert.equal(extracted.length, 3);
  assert.equal(extracted[0].raw, "https://example.com");
  assert.equal(extracted[0].normalized, "https://example.com");
  
  assert.equal(extracted[1].raw, "www.google.com/search?q=test");
  assert.equal(extracted[1].normalized, "https://www.google.com/search?q=test");
  
  assert.equal(extracted[2].raw, "wikipedia.org/wiki/Egypt");
  assert.equal(extracted[2].normalized, "https://wikipedia.org/wiki/Egypt");
}

// -------------------------------------------------------------
// Test 4: Tool Routing (Pre-flight intent detection)
// -------------------------------------------------------------
console.log("🧪 Testing: Tool Routing (Pre-flight Intent Detection)");
{
  // current_time routing
  assert.equal(routeIntent("الساعة كام دلوقتي يا كنزى؟"), "current_time");
  assert.equal(routeIntent("النهارده إيه في الأسبوع؟"), "current_time");
  assert.equal(routeIntent("what time is it right now?"), "current_time");

  // open_url routing
  assert.equal(routeIntent("افتح الرابط ده https://example.com وقولي رأيك"), "open_url");
  assert.equal(routeIntent("اقرأ الصفحة دي www.github.com/trending"), "open_url");
  // bare URL without triggers should also match if short
  assert.equal(routeIntent("https://wikipedia.org"), "open_url");

  // search_and_read routing
  assert.equal(routeIntent("اعمل بحث وقارن بين أداة X وأداة Y"), "search_and_read");
  assert.equal(routeIntent("دورلي على أفضل لابتوب في السوق حاليا"), "search_and_read");

  // web_search routing
  assert.equal(routeIntent("دورلي على سعر الذهب النهارده"), "web_search");
  assert.equal(routeIntent("ابحث عن آخر أخبار الذكاء الاصطناعي"), "web_search");
  assert.equal(routeIntent("هاتلي ماتش النهارده وترتيب الدوري"), "web_search");

  // none routing (casual chat/roleplay should trigger 'none' instantly for fast 20ms UX)
  assert.equal(routeIntent("مساء الخير يا قمر عامله ايه النهارده؟"), "none");
  assert.equal(routeIntent("أنا حاسس بملل وعايز أرغي معاكي شوية"), "none");
  assert.equal(routeIntent("اكتبيلي قصيدة عن الإسكندرية والقهوة"), "none");
}

// -------------------------------------------------------------
// Test 5: SSRF Protections & Private Network Checks
// -------------------------------------------------------------
console.log("🧪 Testing: SSRF Protections & Private IP Identification");
{
  // IPv4 Loopback and Private Ranges
  assert.equal(isPrivateIp("127.0.0.1"), true);
  assert.equal(isPrivateIp("127.255.255.255"), true);
  assert.equal(isPrivateIp("10.0.0.1"), true);
  assert.equal(isPrivateIp("192.168.1.50"), true);
  assert.equal(isPrivateIp("172.16.4.25"), true);
  assert.equal(isPrivateIp("172.31.255.255"), true);
  assert.equal(isPrivateIp("169.254.10.20"), true);
  assert.equal(isPrivateIp("0.0.0.0"), true);

  // IPv6 Loopback and Local Ranges
  assert.equal(isPrivateIp("::1"), true);
  assert.equal(isPrivateIp("fe80::1ff:fe23:4567:890a"), true);
  assert.equal(isPrivateIp("fc00::abc:123"), true);
  assert.equal(isPrivateIp("fd00::1"), true);

  // Public IPv4/IPv6 Ranges
  assert.equal(isPrivateIp("8.8.8.8"), false);
  assert.equal(isPrivateIp("1.1.1.1"), false);
  assert.equal(isPrivateIp("142.250.190.46"), false);
  assert.equal(isPrivateIp("2607:f8b0:4005:805::200e"), false);
}

// -------------------------------------------------------------
// Test 6: Honest Web Search Unavailability
// -------------------------------------------------------------
console.log("🧪 Testing: Honest Web Search Unavailability");
async function testSearchUnavailability() {
  const query = "آخر أخبار تكنولوجيا الفضاء 2026";
  delete process.env.RAFIQ_WEB_SEARCH_PROVIDER;
  delete process.env.RAFIQ_WEB_SEARCH_API_KEY;
  delete process.env.RAFIQ_WEB_SEARCH_ENGINE_ID;

  const result1 = await executeWebSearch({ query, maxResults: 3 });

  assert.ok(result1);
  assert.equal(result1.query, query);
  assert.equal(result1.provider, "unavailable");
  assert.deepEqual(result1.results, []);

  const result2 = await executeWebSearch({ query, maxResults: 3 });
  assert.equal(result2.query, query);
  assert.equal(result2.provider, "unavailable");
  assert.deepEqual(result2.results, []);
}

// -------------------------------------------------------------
// Test 7: Combined Research Flow & Scrape limit
// -------------------------------------------------------------
console.log("🧪 Testing: Combined Research Flow");
async function testResearchFlow() {
  const query = "الذكاء الاصطناعي التوليدي ومستقبل البرمجة";
  const research = await executeResearchWeb({ query, maxSearchResults: 3, maxPagesToRead: 2 });
  
  assert.ok(research);
  assert.equal(research.query, query);
  assert.deepEqual(research.searchResults, []);
  assert.deepEqual(research.openedPages, []);
}

// -------------------------------------------------------------
// Test 8: Tool Result Formatter
// -------------------------------------------------------------
console.log("🧪 Testing: Tool Result Formatter Output Consistency");
{
  // Time Result
  const timeResult = getCurrentTime();
  const formattedTime = formatTimeResult(timeResult);
  assert.match(formattedTime, /\[TIME_TOOL_RESULT\]/);
  assert.match(formattedTime, /Timezone:/);

  // Search Result
  const searchResult = {
    query: "أفضل الهواتف في 2026",
    results: [
      { title: "أفضل الهواتف 2026", url: "https://example.com/best-phones", snippet: "مراجعة شاملة لأحدث الهواتف الذكية في عام 2026 وأسعارها." }
    ],
    searchedAt: new Date().toISOString(),
    provider: "tavily"
  };
  const formattedSearch = formatSearchResult(searchResult);
  assert.match(formattedSearch, /\[WEB_SEARCH_RESULT\]/);
  assert.match(formattedSearch, /Query: "أفضل الهواتف في 2026"/);
  assert.match(formattedSearch, /Provider: tavily/);
  assert.match(formattedSearch, /Title: أفضل الهواتف 2026/);

  // Reader Result
  const readerResult = {
    url: "https://example.com/best-phones",
    title: "أفضل الهواتف 2026",
    text: "هذا النص هو محتوى المقالة الطويل...",
    excerpt: "هذا النص هو محتوى المقالة...",
    fetchedAt: new Date().toISOString(),
    statusCode: 200
  };
  const formattedReader = formatReaderResult(readerResult);
  assert.match(formattedReader, /\[WEB_READER_RESULT\]/);
  assert.match(formattedReader, /URL: https:\/\/example.com\/best-phones/);
  assert.match(formattedReader, /Title: أفضل الهواتف 2026/);
}

// Run asynchronous tests
async function runAsyncTests() {
  try {
    await testSearchUnavailability();
    await testResearchFlow();
    console.log("✅ All Real-time Awareness and Web Tools Tests Passed Successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Tests Failed with error:", err);
    process.exit(1);
  }
}

runAsyncTests();
