import dns from "node:dns";
import { promisify } from "node:util";
import { OpenUrlArgs, OpenUrlResult } from "./toolTypes.js";

const lookup = promisify(dns.lookup);

const WEB_READER_CONFIG = {
  timeoutMs: 8000,
  maxBytes: 2_000_000,
  maxChars: 12000,
  maxRedirects: 3,
  allowedProtocols: ["http:", "https:"],
  blockPrivateNetworks: true
};

const pageCache = new Map<string, { data: OpenUrlResult; expires: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes TTL

/**
 * Checks if an IP is in the private/loopback/link-local ranges.
 */
export const isPrivateIp = (ip: string): boolean => {
  if (ip === "::1" || ip === "0.0.0.0" || ip === "localhost") return true;

  // IPv4 Private Ranges
  // 127.0.0.0/8 (Loopback)
  // 10.0.0.0/8 (Private Class A)
  // 192.168.0.0/16 (Private Class C)
  // 172.16.0.0/12 (Private Class B)
  // 169.254.0.0/16 (Link-Local)
  const ipv4Match = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const o1 = parseInt(ipv4Match[1], 10);
    const o2 = parseInt(ipv4Match[2], 10);
    if (o1 === 127) return true;
    if (o1 === 10) return true;
    if (o1 === 192 && o2 === 168) return true;
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;
    if (o1 === 169 && o2 === 254) return true;
    if (o1 === 0) return true;
  }

  // IPv6 Private Ranges
  // Unique Local Addresses (fc00::/7)
  // Link-Local (fe80::/10)
  const ipv6Lower = ip.toLowerCase();
  if (
    ipv6Lower.startsWith("fe80:") ||
    ipv6Lower.startsWith("fc00:") ||
    ipv6Lower.startsWith("fd00:")
  ) {
    return true;
  }

  return false;
};

/**
 * Validates a URL hostname and resolves its DNS IP to block SSRF.
 */
const validateHostnameAndIp = async (urlStr: string): Promise<string> => {
  const parsed = new URL(urlStr);
  if (!WEB_READER_CONFIG.allowedProtocols.includes(parsed.protocol)) {
    throw new Error(`Protocol "${parsed.protocol}" is not allowed.`);
  }

  const hostname = parsed.hostname;

  // If it's a direct IP, validate it
  if (/^[0-9.]+$/.test(hostname) || hostname.includes(":")) {
    if (WEB_READER_CONFIG.blockPrivateNetworks && isPrivateIp(hostname)) {
      throw new Error(`Access to private IP range is blocked: ${hostname}`);
    }
    return hostname;
  }

  // Otherwise, lookup DNS
  try {
    const { address } = await lookup(hostname);
    if (WEB_READER_CONFIG.blockPrivateNetworks && isPrivateIp(address)) {
      throw new Error(`Access to resolved private IP range is blocked: ${address}`);
    }
    return address;
  } catch (err: any) {
    if (err.message.includes("blocked")) throw err;
    throw new Error(`Failed to resolve hostname: ${hostname}`);
  }
};

/**
 * Strips HTML tags, styles, scripts, comments and collapses whitespace.
 */
const extractReadableText = (html: string): { text: string; excerpt: string; title: string; description: string } => {
  // Extract Title
  const titleMatch = html.match(/<title[^]*?>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";

  // Extract Meta Description
  let description = "";
  const metaMatch = html.match(/<meta[^>]*?name=["']description["'][^>]*?content=["']([\s\S]*?)["']/i) ||
                    html.match(/<meta[^>]*?content=["']([\s\S]*?)["'][^>]*?name=["']description["']/i);
  if (metaMatch) {
    description = metaMatch[1].trim();
  }

  let cleaned = html;

  // 1. Strip script and style tags
  cleaned = cleaned.replace(/<script[^]*?>[\s\S]*?<\/script>/gi, " ");
  cleaned = cleaned.replace(/<style[^]*?>[\s\S]*?<\/style>/gi, " ");

  // 2. Strip comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, " ");

  // 3. Strip nav, header, footer elements to focus on main content
  cleaned = cleaned.replace(/<nav[^]*?>[\s\S]*?<\/nav>/gi, " ");
  cleaned = cleaned.replace(/<header[^]*?>[\s\S]*?<\/header>/gi, " ");
  cleaned = cleaned.replace(/<footer[^]*?>[\s\S]*?<\/footer>/gi, " ");

  // 4. Strip remaining HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, " ");

  // 5. Replace HTML entities
  cleaned = cleaned
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // 6. Collapse whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // Create excerpt
  const excerpt = cleaned.slice(0, 300) + (cleaned.length > 300 ? "..." : "");

  return {
    text: cleaned,
    excerpt,
    title,
    description
  };
};

/**
 * Extracts external links from the raw HTML.
 */
const extractLinks = (html: string, baseUrl: string): Array<{ text: string; url: string }> => {
  const links: Array<{ text: string; url: string }> = [];
  const linkRegex = /<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*?>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null && links.length < 10) {
    const url = match[1];
    const text = match[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (text && url && !url.includes("javascript:")) {
      links.push({ text: text.slice(0, 50), url });
    }
  }

  return links;
};

/**
 * Executes URL fetching and text parsing server-side with strict security constraints.
 */
export const executeWebReader = async (args: OpenUrlArgs): Promise<OpenUrlResult> => {
  const urlStr = args.url.trim();
  const maxChars = args.maxChars || WEB_READER_CONFIG.maxChars;

  if (!urlStr) {
    return { url: "", text: "", excerpt: "", fetchedAt: new Date().toISOString(), statusCode: 400, error: "Empty URL" };
  }

  // 1. Check cache first
  const cacheKey = `${urlStr}:${maxChars}`;
  const cached = pageCache.get(cacheKey);
  if (cached && Date.now() < cached.expires) {
    console.log(`[WebReaderTool] Cache HIT for URL: ${urlStr}`);
    return cached.data;
  }

  let currentUrl = urlStr;
  let redirectCount = 0;
  let response: any = null;

  try {
    // Manually handle redirects to enforce SSRF validation at every hop
    while (true) {
      await validateHostnameAndIp(currentUrl);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), WEB_READER_CONFIG.timeoutMs);

      try {
        response = await fetch(currentUrl, {
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 RafiqBot/1.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "ar-EG,ar;q=0.9,en-US;q=0.8,en;q=0.7"
          },
          redirect: "manual",
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }

      // Check redirection status
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          break; // Stop redirecting if no location header is found
        }
        redirectCount++;
        if (redirectCount > WEB_READER_CONFIG.maxRedirects) {
          throw new Error(`Redirect limit exceeded (max: ${WEB_READER_CONFIG.maxRedirects})`);
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      break;
    }

    if (!response.ok) {
      throw new Error(`Website responded with status code ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType && !contentType.includes("text/html") && !contentType.includes("text/plain") && !contentType.includes("application/xhtml+xml")) {
      throw new Error(`Unsupported content type: ${contentType}. Only HTML/text pages can be read.`);
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > WEB_READER_CONFIG.maxBytes) {
      throw new Error(`Page size exceeds limit of ${WEB_READER_CONFIG.maxBytes} bytes`);
    }

    const rawHtml = await response.text();
    if (rawHtml.length > WEB_READER_CONFIG.maxBytes) {
      throw new Error(`Page text length exceeds memory limit`);
    }

    // Extract readable components
    const parsed = extractReadableText(rawHtml);
    const links = extractLinks(rawHtml, currentUrl);

    // Limit character size to avoid overloading LLM prompt token limits
    const textSnippet = parsed.text.slice(0, maxChars);

    const openResult: OpenUrlResult = {
      url: urlStr,
      finalUrl: currentUrl,
      title: parsed.title || "صفحة إنترنت",
      description: parsed.description,
      text: textSnippet,
      excerpt: parsed.excerpt,
      links,
      fetchedAt: new Date().toISOString(),
      contentType,
      statusCode: response.status
    };

    // Cache the result
    pageCache.set(cacheKey, { data: openResult, expires: Date.now() + CACHE_TTL });

    return openResult;
  } catch (err: any) {
    console.error(`[WebReaderTool] Failed to read URL ${urlStr}:`, err.message);
    const errorResult: OpenUrlResult = {
      url: urlStr,
      text: "",
      excerpt: "",
      fetchedAt: new Date().toISOString(),
      statusCode: response ? response.status : 500,
      error: err.message || "Failed to fetch webpage contents"
    };
    return errorResult;
  }
};
