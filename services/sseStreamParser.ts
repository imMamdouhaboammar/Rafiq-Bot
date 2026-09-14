export interface StreamGroundingUrl {
  title?: string;
  uri: string;
}

export interface SseStreamResult {
  text: string;
  urls: StreamGroundingUrl[];
  toolsUsed: unknown[];
}

export interface SseStreamHandlers {
  onText: (text: string) => void;
  onMalformedData?: (data: string, error: unknown) => void;
}

type ParsedSseChunk = {
  text?: unknown;
  urls?: unknown;
  toolsUsed?: unknown;
  isError?: unknown;
};

const isGroundingUrl = (value: unknown): value is StreamGroundingUrl => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { title?: unknown; uri?: unknown };
  return typeof candidate.uri === 'string'
    && (candidate.title === undefined || typeof candidate.title === 'string');
};

const parseDataPayload = (
  data: string,
  handlers: SseStreamHandlers,
): ParsedSseChunk | undefined => {
  try {
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === 'object' ? parsed as ParsedSseChunk : undefined;
  } catch (error) {
    handlers.onMalformedData?.(data, error);
    return undefined;
  }
};

export const consumeSseResponse = async (
  response: Response,
  handlers: SseStreamHandlers,
): Promise<SseStreamResult> => {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Streaming request failed');
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body reader available.');

  const decoder = new TextDecoder();
  let lineBuffer = '';
  let dataLines: string[] = [];
  let fullText = '';
  let latestUrls: StreamGroundingUrl[] = [];
  let latestToolsUsed: unknown[] = [];
  let done = false;

  const dispatchEvent = () => {
    if (dataLines.length === 0 || done) {
      dataLines = [];
      return;
    }

    const data = dataLines.join('\n');
    dataLines = [];
    if (data === '[DONE]') {
      done = true;
      return;
    }

    const parsed = parseDataPayload(data, handlers);
    if (!parsed) return;

    if (parsed.isError) {
      const message = typeof parsed.text === 'string' && parsed.text.trim()
        ? parsed.text
        : 'Streaming request failed';
      throw new Error(message);
    }

    if (Array.isArray(parsed.urls)) {
      latestUrls = parsed.urls.filter(isGroundingUrl);
    }
    if (Array.isArray(parsed.toolsUsed)) {
      latestToolsUsed = parsed.toolsUsed;
    }
    if (typeof parsed.text === 'string' && parsed.text.length > 0) {
      fullText += parsed.text;
      handlers.onText(parsed.text);
    }
  };

  const processAvailableLines = (flush = false) => {
    const lines = lineBuffer.split(/\r?\n/);
    lineBuffer = flush ? '' : lines.pop() || '';

    for (const line of lines) {
      if (line === '') {
        dispatchEvent();
        continue;
      }
      if (line.startsWith(':')) continue;
      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).replace(/^ /, ''));
      }
    }

    if (flush && lineBuffer) {
      if (lineBuffer.startsWith('data:')) {
        dataLines.push(lineBuffer.slice(5).replace(/^ /, ''));
      }
      lineBuffer = '';
    }
  };

  while (!done) {
    const { done: readerDone, value } = await reader.read();
    if (readerDone) break;
    lineBuffer += decoder.decode(value, { stream: true });
    processAvailableLines();
  }

  lineBuffer += decoder.decode();
  processAvailableLines(true);
  if (dataLines.length > 0 && !done) dispatchEvent();

  if (done) await reader.cancel().catch(() => undefined);

  return { text: fullText, urls: latestUrls, toolsUsed: latestToolsUsed };
};
