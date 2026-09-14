import { CurrentTimeResult, WebSearchResult, OpenUrlResult, ResearchWebResult } from "./toolTypes.js";

/**
 * Formats time results into a compact block for the LLM prompt.
 */
export const formatTimeResult = (result: CurrentTimeResult): string => {
  return `
[TIME_TOOL_RESULT]
- ISO Timestamp: ${result.iso}
- Timezone: ${result.timezone}
- Date: ${result.dateText}
- Local Time: ${result.timeText}
- Day: ${result.dayName}
- Period: ${result.period}
`;
};

/**
 * Formats web search results into a clean, compact block for the LLM prompt.
 */
export const formatSearchResult = (result: WebSearchResult): string => {
  if (!result.results || result.results.length === 0) {
    return `
[WEB_SEARCH_RESULT]
Query: "${result.query}"
Results: No relevant web results found.
`;
  }

  const formattedItems = result.results
    .map((item, index) => {
      return `Result ${index + 1}:
- Title: ${item.title}
- URL: ${item.url}
- Snippet: ${item.snippet}
`;
    })
    .join("\n");

  return `
[WEB_SEARCH_RESULT]
Query: "${result.query}"
Provider: ${result.provider}
Searched At: ${result.searchedAt}

${formattedItems}
`;
};

/**
 * Formats webpage read results compactly to avoid cluttering prompts.
 */
export const formatReaderResult = (result: OpenUrlResult): string => {
  if (result.error) {
    return `
[WEB_READER_RESULT]
URL: ${result.url}
Error: Failed to read page contents. ${result.error}
`;
  }

  return `
[WEB_READER_RESULT]
URL: ${result.url}
Final URL: ${result.finalUrl || result.url}
Title: ${result.title}
Description: ${result.description || "No description available"}
Fetched At: ${result.fetchedAt}

Extracted Excerpt:
"""
${result.excerpt}
"""

Extracted Full Content (First ${result.text.length} chars):
"""
${result.text}
"""
`;
};

/**
 * Formats search and read research results together into a single, cohesive block.
 */
export const formatResearchResult = (result: ResearchWebResult): string => {
  const searchFormatted = formatSearchResult({
    query: result.query,
    results: result.searchResults,
    searchedAt: result.researchedAt,
    provider: "research-flow"
  });

  const pagesFormatted = result.openedPages
    .map((page, index) => {
      if (page.error) {
        return `Opened Page ${index + 1} (${page.url}): Failed to read contents (${page.error})`;
      }
      return `Opened Page ${index + 1}:
- Title: ${page.title}
- URL: ${page.url}
- Excerpt: ${page.excerpt}
`;
    })
    .join("\n\n");

  return `
${searchFormatted}

[RESEARCH_PAGES_READ]
${pagesFormatted || "No pages were read."}
`;
};
