export type GetCurrentTimeArgs = {
  timezone?: string;
  locale?: string;
};

export type CurrentTimeResult = {
  iso: string;
  timezone: string;
  locale: string;
  dateText: string;
  timeText: string;
  dayName: string;
  hour: number;
  minute: number;
  period: "morning" | "afternoon" | "evening" | "night";
};

export type WebSearchArgs = {
  query: string;
  locale?: string;
  region?: string;
  maxResults?: number;
  recencyDays?: number;
};

export type WebSearchResultItem = {
  title: string;
  url: string;
  snippet: string;
  source?: string;
  publishedAt?: string;
};

export type WebSearchResult = {
  query: string;
  results: WebSearchResultItem[];
  searchedAt: string;
  provider: string;
};

export type OpenUrlArgs = {
  url: string;
  maxChars?: number;
};

export type OpenUrlResult = {
  url: string;
  finalUrl?: string;
  title?: string;
  description?: string;
  text: string;
  excerpt: string;
  links?: Array<{ text: string; url: string }>;
  fetchedAt: string;
  contentType?: string;
  statusCode?: number;
  error?: string;
};

export type ResearchWebArgs = {
  query: string;
  maxSearchResults?: number;
  maxPagesToRead?: number;
  recencyDays?: number;
};

export type ResearchWebResult = {
  query: string;
  searchResults: WebSearchResultItem[];
  openedPages: OpenUrlResult[];
  researchedAt: string;
};

export type ToolIntent =
  | "none"
  | "current_time"
  | "web_search"
  | "open_url"
  | "search_and_read"
  | "uncertain";

export type ExtractedUrl = {
  raw: string;
  normalized: string;
};

export type RuntimeAwarenessContext = {
  nowIso: string;
  timezone: string;
  localDate: string;
  localTime: string;
  dayName: string;
  currentActivityArabic?: string;
  currentLocation?: string;
  currentAvailability?: string;
  prayerContext?: string;
  fridayGreeting?: string;
};
