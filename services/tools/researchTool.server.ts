import { ResearchWebArgs, ResearchWebResult, OpenUrlResult } from "./toolTypes.js";
import { executeWebSearch } from "./webSearchTool.server.js";
import { executeWebReader } from "./webReaderTool.server.js";

/**
 * Combines Web Search and Web Reader to perform deep research on a query.
 * Fetches search results, selects the top pages, and fetches their contents.
 */
export const executeResearchWeb = async (args: ResearchWebArgs): Promise<ResearchWebResult> => {
  const query = args.query.trim();
  const maxSearchResults = args.maxSearchResults || 5;
  const maxPagesToRead = args.maxPagesToRead || 3; // Limit to max 3 pages to avoid excessive token sizes/latency

  if (!query) {
    return {
      query: "",
      searchResults: [],
      openedPages: [],
      researchedAt: new Date().toISOString()
    };
  }

  try {
    // 1. Run the web search
    console.log(`[ResearchTool] Running web search for deep research: "${query}"`);
    const searchResult = await executeWebSearch({
      query,
      maxResults: maxSearchResults
    });

    const searchResults = searchResult.results || [];
    const openedPages: OpenUrlResult[] = [];

    // 2. Select top pages to read (maxPagesToRead)
    // Avoid reading social media platforms or raw search indices if possible, or just take top results
    const urlsToRead = searchResults
      .slice(0, maxPagesToRead)
      .map(item => item.url)
      .filter(url => url && /^https?:\/\//i.test(url));

    console.log(`[ResearchTool] Selected URLs to read for query "${query}":`, urlsToRead);

    // 3. Read pages in parallel with a strict timeout
    const readPromises = urlsToRead.map(async (url) => {
      try {
        const pageContent = await executeWebReader({ url });
        return pageContent;
      } catch (err: any) {
        console.error(`[ResearchTool] Error reading URL ${url} during research:`, err.message);
        return {
          url,
          text: "",
          excerpt: "",
          fetchedAt: new Date().toISOString(),
          statusCode: 500,
          error: err.message || "Failed to fetch webpage contents during research"
        };
      }
    });

    const results = await Promise.all(readPromises);
    openedPages.push(...results);

    return {
      query,
      searchResults,
      openedPages,
      researchedAt: new Date().toISOString()
    };
  } catch (err: any) {
    console.error(`[ResearchTool] Deep research failed for query "${query}":`, err);
    return {
      query,
      searchResults: [],
      openedPages: [],
      researchedAt: new Date().toISOString()
    };
  }
};
