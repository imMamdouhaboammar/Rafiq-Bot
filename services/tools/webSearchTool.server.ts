import { BoundedLru } from "../boundedLru.js";
import { resolveRuntimeLocale } from "../runtimeLocale.js";
import { WebSearchArgs, WebSearchResult, WebSearchResultItem } from "./toolTypes.js";

const CACHE_TTL_MS = 15 * 60 * 1000;
const SEARCH_CACHE_MAX_ENTRIES = 100;
const searchCache = new BoundedLru<string, { data: WebSearchResult; expires: number }>({
  maxEntries: SEARCH_CACHE_MAX_ENTRIES,
});

const cleanExpiredCache = () => {
  const now = Date.now();
  for (const [key, value] of searchCache.entriesSnapshot()) {
    if (now > value.expires) searchCache.delete(key);
  }
};

const unavailableResult = (query: string): WebSearchResult => ({
  query,
  results: [],
  searchedAt: new Date().toISOString(),
  provider: "unavailable",
});

export const executeWebSearch = async (args: WebSearchArgs): Promise<WebSearchResult> => {
  const query = args.query.trim();
  const runtimeLocale = resolveRuntimeLocale({
    locale: args.locale,
    searchLocale: args.locale,
    searchRegion: args.region,
  });
  const locale = runtimeLocale.searchLocale;
  const region = runtimeLocale.searchRegion || '';
  const maxResults = Math.max(1, Math.min(10, args.maxResults || 5));

  if (!query) {
    return { query: "", results: [], searchedAt: new Date().toISOString(), provider: "none" };
  }

  cleanExpiredCache();
  const cacheKey = `${query.toLowerCase()}:${locale}:${region}:${maxResults}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() < cached.expires) return cached.data;

  const provider = (process.env.RAFIQ_WEB_SEARCH_PROVIDER || "").trim().toLowerCase();
  const apiKey = process.env.RAFIQ_WEB_SEARCH_API_KEY?.trim();
  const engineId = process.env.RAFIQ_WEB_SEARCH_ENGINE_ID?.trim();

  if (!provider || !apiKey) {
    console.warn("[WebSearchTool] Search is unavailable because provider configuration is incomplete.");
    return unavailableResult(query);
  }

  if (provider === "google" && !engineId) {
    console.warn("[WebSearchTool] Google search is unavailable because the engine ID is missing.");
    return unavailableResult(query);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    let results: WebSearchResultItem[] = [];

    if (provider === "tavily") {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          max_results: maxResults,
          include_answer: false,
          search_depth: "basic",
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Tavily API responded with status ${response.status}`);
      const data = await response.json();
      results = (data.results || []).map((result: any) => ({
        title: result.title || "",
        url: result.url || "",
        snippet: result.content || result.snippet || "",
      }));
    } else if (provider === "serpapi") {
      const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(apiKey)}&hl=${encodeURIComponent(locale)}&gl=${encodeURIComponent(region)}`;
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`SerpAPI responded with status ${response.status}`);
      const data = await response.json();
      results = (data.organic_results || []).slice(0, maxResults).map((result: any) => ({
        title: result.title || "",
        url: result.link || "",
        snippet: result.snippet || "",
      }));
    } else if (provider === "google") {
      const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(engineId!)}&hl=${encodeURIComponent(locale)}`;
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`Google Custom Search responded with status ${response.status}`);
      const data = await response.json();
      results = (data.items || []).slice(0, maxResults).map((result: any) => ({
        title: result.title || "",
        url: result.link || "",
        snippet: result.snippet || "",
      }));
    } else if (provider === "brave") {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`;
      const response = await fetch(url, {
        headers: { "X-Subscription-Token": apiKey },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Brave Search responded with status ${response.status}`);
      const data = await response.json();
      results = (data.web?.results || []).map((result: any) => ({
        title: result.title || "",
        url: result.url || "",
        snippet: result.description || "",
      }));
    } else if (provider === "bing") {
      const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=${maxResults}&mkt=${encodeURIComponent(locale)}`;
      const response = await fetch(url, {
        headers: { "Ocp-Apim-Subscription-Key": apiKey },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Bing Search responded with status ${response.status}`);
      const data = await response.json();
      results = (data.webPages?.value || []).map((result: any) => ({
        title: result.name || "",
        url: result.url || "",
        snippet: result.snippet || "",
      }));
    } else {
      console.warn(`[WebSearchTool] Unsupported provider configured: ${provider}`);
      return unavailableResult(query);
    }

    const finalResult: WebSearchResult = {
      query,
      results: results.slice(0, maxResults),
      searchedAt: new Date().toISOString(),
      provider,
    };

    searchCache.set(cacheKey, { data: finalResult, expires: Date.now() + CACHE_TTL_MS });
    return finalResult;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[WebSearchTool] Search failed for provider ${provider}: ${reason}`);
    return unavailableResult(query);
  } finally {
    clearTimeout(timeoutId);
  }
};
