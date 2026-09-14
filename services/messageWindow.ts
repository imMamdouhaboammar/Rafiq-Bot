export interface MessageWindow {
  startIndex: number;
  endIndex: number;
  hasOlder: boolean;
  hasNewer: boolean;
}

export const DEFAULT_MESSAGE_PAGE_SIZE = 80;
export const MAX_RENDERED_MESSAGES = 240;

export const createInitialMessageWindow = (
  messageCount: number,
  pageSize = DEFAULT_MESSAGE_PAGE_SIZE,
): MessageWindow => {
  const safeCount = Math.max(0, Math.floor(messageCount));
  const safePageSize = Math.max(1, Math.min(MAX_RENDERED_MESSAGES, Math.floor(pageSize)));
  const startIndex = Math.max(0, safeCount - safePageSize);
  return {
    startIndex,
    endIndex: safeCount,
    hasOlder: startIndex > 0,
    hasNewer: false,
  };
};

export const loadOlderMessagePage = (
  window: MessageWindow,
  messageCount: number,
  pageSize = DEFAULT_MESSAGE_PAGE_SIZE,
): MessageWindow => {
  const safeCount = Math.max(0, Math.floor(messageCount));
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const currentSize = Math.max(0, window.endIndex - window.startIndex);
  const expandedStart = Math.max(0, window.startIndex - safePageSize);
  const endIndex = currentSize < MAX_RENDERED_MESSAGES
    ? Math.min(safeCount, window.endIndex)
    : Math.max(window.endIndex - safePageSize, expandedStart + MAX_RENDERED_MESSAGES);
  const boundedStart = currentSize < MAX_RENDERED_MESSAGES
    ? Math.max(expandedStart, endIndex - MAX_RENDERED_MESSAGES)
    : Math.max(0, endIndex - MAX_RENDERED_MESSAGES);
  return {
    startIndex: boundedStart,
    endIndex,
    hasOlder: boundedStart > 0,
    hasNewer: endIndex < safeCount,
  };
};

export const followLatestMessages = (
  window: MessageWindow,
  previousCount: number,
  nextCount: number,
): MessageWindow => {
  const safeNextCount = Math.max(0, Math.floor(nextCount));
  const wasAtLatest = window.endIndex >= Math.max(0, previousCount);
  if (!wasAtLatest) {
    return {
      ...window,
      endIndex: Math.min(window.endIndex, safeNextCount),
      hasOlder: window.startIndex > 0,
      hasNewer: window.endIndex < safeNextCount,
    };
  }

  const visibleCount = Math.max(DEFAULT_MESSAGE_PAGE_SIZE, window.endIndex - window.startIndex);
  const endIndex = safeNextCount;
  const startIndex = Math.max(0, endIndex - Math.min(MAX_RENDERED_MESSAGES, visibleCount));
  return {
    startIndex,
    endIndex,
    hasOlder: startIndex > 0,
    hasNewer: false,
  };
};

export const getWindowedMessages = <T>(
  messages: T[],
  window: MessageWindow,
): T[] => messages.slice(window.startIndex, window.endIndex);
