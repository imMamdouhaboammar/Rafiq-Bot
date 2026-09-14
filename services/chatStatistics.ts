
import type { ChatStatistics, ParticipantProfile } from "../types.js";

// --- Local Types (mirrors whatsappImporter.server.ts — no import to avoid circular deps) ---

export interface ParsedMessage {
  date: Date;
  sender: string;
  content: string;
}

export const MIN_TARGET_MESSAGE_COUNT = 20;

export class TargetParticipantError extends Error {
  readonly statusCode = 422;

  constructor(message: string) {
    super(message);
    this.name = "TargetParticipantError";
  }
}

const normalizeParticipantName = (name: string): string => (
  name.normalize("NFKC").trim().toLocaleLowerCase()
);

// --- Helpers ---

/**
 * Broad emoji regex covering Emoji_Presentation, Emoji_Modifier_Base,
 * regional indicators, and common symbol blocks.
 */
const EMOJI_REGEX =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;

/** Arabic Unicode block */
const ARABIC_CHAR_REGEX = /[\u0600-\u06FF]/;

/** Franco-Arab: digits commonly used inside words (e.g. 7aga, 3ady, 2a) */
const FRANCO_REGEX = /(?:[a-zA-Z]+[2-9][a-zA-Z]*|[2-9][a-zA-Z]+)/;

/** Emotional keywords for smart sampling */
const EMOTIONAL_KEYWORDS_REGEX =
  /زعلان|مبسوط|بحبك|مخنوق|وحشتني|بموت|حبيبي|angry|happy|love|hate|crying|miss you|😂|😭|❤️|💔|🥺|😡/i;

// --- 1. computeStatistics ---

export function computeStatistics(messages: ParsedMessage[]): ChatStatistics {
  if (messages.length === 0) {
    return {
      totalMessages: 0,
      participants: [],
      dateRange: { start: new Date().toISOString(), end: new Date().toISOString() },
      dominantLanguage: "arabic",
      averageMessagesPerDay: 0,
      isGroupChat: false,
    };
  }

  // --- Group messages by sender ---
  const bySender = new Map<string, ParsedMessage[]>();
  for (const msg of messages) {
    const existing = bySender.get(msg.sender);
    if (existing) {
      existing.push(msg);
    } else {
      bySender.set(msg.sender, [msg]);
    }
  }

  // --- Build participant profiles ---
  const participants: ParticipantProfile[] = [];

  for (const [sender, senderMessages] of bySender) {
    // Message count
    const messageCount = senderMessages.length;

    // Average message length (character count)
    const totalChars = senderMessages.reduce((sum, m) => sum + m.content.length, 0);
    const averageMessageLength = messageCount > 0 ? Math.round(totalChars / messageCount) : 0;

    // Emoji frequency (emojis per message)
    let totalEmojis = 0;
    for (const m of senderMessages) {
      const matches = m.content.match(EMOJI_REGEX);
      if (matches) totalEmojis += matches.length;
    }
    const emojiFrequency = messageCount > 0 ? parseFloat((totalEmojis / messageCount).toFixed(2)) : 0;

    // Question frequency (messages with ? or ؟ per 100 messages)
    let questionCount = 0;
    for (const m of senderMessages) {
      if (m.content.includes("?") || m.content.includes("؟")) {
        questionCount++;
      }
    }
    const questionFrequency =
      messageCount > 0 ? parseFloat(((questionCount / messageCount) * 100).toFixed(2)) : 0;

    // Media message count (messages containing 'omitted' or 'محذوفة')
    let mediaMessageCount = 0;
    for (const m of senderMessages) {
      if (m.content.includes("omitted") || m.content.includes("محذوفة")) {
        mediaMessageCount++;
      }
    }

    // Active hours — bucket by hour, sort descending, top 5
    const hourCounts = new Map<number, number>();
    for (const m of senderMessages) {
      const h = m.date.getHours();
      hourCounts.set(h, (hourCounts.get(h) || 0) + 1);
    }
    const activeHours = [...hourCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([hour]) => hour);

    // Fragmented message ratio
    // Consecutive messages from same sender within 60s / total messages from sender
    let fragmentedCount = 0;
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].sender !== sender) continue;
      if (i > 0 && messages[i - 1].sender === sender) {
        const diffMs = messages[i].date.getTime() - messages[i - 1].date.getTime();
        if (diffMs >= 0 && diffMs <= 60_000) {
          fragmentedCount++;
        }
      }
    }
    const fragmentedMessageRatio =
      messageCount > 0 ? parseFloat((fragmentedCount / messageCount).toFixed(3)) : 0;

    participants.push({
      name: sender,
      messageCount,
      averageMessageLength,
      emojiFrequency,
      questionFrequency,
      mediaMessageCount,
      activeHours,
      fragmentedMessageRatio,
    });
  }

  // Sort participants by message count descending
  participants.sort((a, b) => b.messageCount - a.messageCount);

  // --- Date range ---
  const sortedDates = messages.map((m) => m.date.getTime()).sort((a, b) => a - b);
  const startDate = new Date(sortedDates[0]);
  const endDate = new Date(sortedDates[sortedDates.length - 1]);

  // --- Dominant language ---
  const dominantLanguage = detectDominantLanguage(messages);

  // --- Average messages per day ---
  const daySpan = Math.max(
    1,
    Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  );
  const averageMessagesPerDay = parseFloat((messages.length / daySpan).toFixed(2));

  // --- Group chat ---
  const isGroupChat = bySender.size > 2;

  return {
    totalMessages: messages.length,
    participants,
    dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
    dominantLanguage,
    averageMessagesPerDay,
    isGroupChat,
  };
}

/**
 * Detect the dominant language by sampling message content.
 */
function detectDominantLanguage(
  messages: ParsedMessage[]
): "arabic" | "english" | "franco" | "mixed" {
  let arabicScore = 0;
  let francoScore = 0;
  let englishScore = 0;

  // Sample up to 500 messages evenly
  const step = Math.max(1, Math.floor(messages.length / 500));
  let sampled = 0;

  for (let i = 0; i < messages.length; i += step) {
    const text = messages[i].content;
    if (!text || text.length < 2) continue;

    if (ARABIC_CHAR_REGEX.test(text)) {
      arabicScore++;
    } else if (FRANCO_REGEX.test(text)) {
      francoScore++;
    } else {
      englishScore++;
    }
    sampled++;
  }

  if (sampled === 0) return "arabic";

  const total = arabicScore + francoScore + englishScore;
  const arabicPct = arabicScore / total;
  const francoPct = francoScore / total;
  const englishPct = englishScore / total;

  // If no single language dominates (>55%), call it mixed
  if (arabicPct > 0.55) return "arabic";
  if (francoPct > 0.55) return "franco";
  if (englishPct > 0.55) return "english";
  return "mixed";
}

// --- 2. resolveTargetName ---

export function resolveTargetName(
  messages: ParsedMessage[],
  statistics: ChatStatistics,
  targetNameHint?: string
): string {
  const { participants } = statistics;

  if (participants.length === 0) {
    throw new TargetParticipantError("The WhatsApp export contains no participants.");
  }

  // --- If hint provided, try to match ---
  if (targetNameHint && targetNameHint.trim()) {
    const hint = normalizeParticipantName(targetNameHint);
    const exact = participants.find((p) => normalizeParticipantName(p.name) === hint);
    if (exact) return exact.name;
    throw new TargetParticipantError(
      `Target participant "${targetNameHint.trim()}" was not found exactly in this WhatsApp export.`,
    );
  }

  // --- Two-person chat: pick the one that is NOT "You" ---
  if (participants.length === 2) {
    const notYou = participants.find(
      (p) => p.name.toLowerCase() !== "you" && p.name.toLowerCase() !== "أنت"
    );
    if (notYou) return notYou.name;
    // If both have proper names, pick the one with fewer messages (likely not the phone owner)
    return participants[1].name;
  }

  // --- Group chat: pick participant with most messages, excluding "You" ---
  const sorted = [...participants]
    .filter((p) => p.name.toLowerCase() !== "you" && p.name.toLowerCase() !== "أنت")
    .sort((a, b) => b.messageCount - a.messageCount);

  return sorted[0]?.name || participants[0].name;
}

export function assertTargetEvidenceFloor(
  messages: ParsedMessage[],
  targetName: string,
  minimum = MIN_TARGET_MESSAGE_COUNT,
): void {
  const targetMessageCount = messages.reduce(
    (count, message) => count + (message.sender === targetName ? 1 : 0),
    0,
  );
  if (targetMessageCount < minimum) {
    throw new TargetParticipantError(
      `Not enough messages from "${targetName}" to build a reliable clone (${targetMessageCount}/${minimum}).`,
    );
  }
}

// --- 3. prepareSmartSample ---

export function prepareSmartSample(
  messages: ParsedMessage[],
  targetName: string
): string {
  const targetMessages = messages.filter((m) => m.sender === targetName);

  if (targetMessages.length === 0) {
    return "";
  }

  const sections: { header: string; lines: string[] }[] = [];
  const seen = new Set<string>();

  const addUnique = (msg: ParsedMessage): boolean => {
    const key = msg.content.trim();
    if (seen.has(key) || key.length === 0) return false;
    seen.add(key);
    return true;
  };

  const formatMsg = (m: ParsedMessage): string => `${m.sender}: ${m.content}`;

  // Section 1: Recent behavior (last 200)
  const recentSlice = targetMessages.slice(-200);
  const recentLines: string[] = [];
  for (const m of recentSlice) {
    if (addUnique(m)) recentLines.push(formatMsg(m));
  }
  sections.push({ header: "=== RECENT MESSAGES ===", lines: recentLines });

  // Section 2: Middle-range sample (30-70% of timeline, pick 50 evenly)
  const midStart = Math.floor(targetMessages.length * 0.3);
  const midEnd = Math.floor(targetMessages.length * 0.7);
  const midRange = targetMessages.slice(midStart, midEnd);
  const midStep = Math.max(1, Math.floor(midRange.length / 50));
  const midLines: string[] = [];
  for (let i = 0; i < midRange.length && midLines.length < 50; i += midStep) {
    if (addUnique(midRange[i])) midLines.push(formatMsg(midRange[i]));
  }
  sections.push({ header: "=== MID-TIMELINE SAMPLE ===", lines: midLines });

  // Section 3: Emotional messages (up to 30)
  const emotionalLines: string[] = [];
  for (const m of targetMessages) {
    if (emotionalLines.length >= 30) break;
    if (EMOTIONAL_KEYWORDS_REGEX.test(m.content) && addUnique(m)) {
      emotionalLines.push(formatMsg(m));
    }
  }
  sections.push({ header: "=== EMOTIONAL MESSAGES ===", lines: emotionalLines });

  // Section 4: Longest messages — deep thoughts (top 30)
  const byLength = [...targetMessages].sort((a, b) => b.content.length - a.content.length);
  const longLines: string[] = [];
  for (const m of byLength) {
    if (longLines.length >= 30) break;
    if (addUnique(m)) longLines.push(formatMsg(m));
  }
  sections.push({ header: "=== LONGEST MESSAGES ===", lines: longLines });

  // Section 5: Conversation pairs (target reply + preceding message, within 5 min)
  const pairLines: string[] = [];
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  let pairsFound = 0;
  for (let i = 1; i < messages.length && pairsFound < 80; i++) {
    if (messages[i].sender !== targetName) continue;
    if (messages[i - 1].sender === targetName) continue; // Skip self-replies

    const timeDiff = messages[i].date.getTime() - messages[i - 1].date.getTime();
    if (timeDiff >= 0 && timeDiff <= FIVE_MINUTES_MS) {
      const pairKey = `${messages[i - 1].content.trim()}||${messages[i].content.trim()}`;
      if (!seen.has(pairKey)) {
        seen.add(pairKey);
        pairLines.push(`${messages[i - 1].sender}: ${messages[i - 1].content}`);
        pairLines.push(`${messages[i].sender}: ${messages[i].content}`);
        pairLines.push("---");
        pairsFound++;
      }
    }
  }
  sections.push({ header: "=== CONVERSATION PAIRS ===", lines: pairLines });

  // --- Assemble & cap at 60,000 characters ---
  const MAX_CHARS = 60_000;
  let output = "";

  for (const section of sections) {
    const block = `${section.header}\n${section.lines.join("\n")}\n\n`;
    if (output.length + block.length > MAX_CHARS) {
      // Add as much as fits
      const remaining = MAX_CHARS - output.length;
      if (remaining > section.header.length + 10) {
        output += block.slice(0, remaining);
      }
      break;
    }
    output += block;
  }

  return output;
}

// --- 4. extractConversationPairs ---

export function extractConversationPairs(
  messages: ParsedMessage[],
  targetName: string,
  limit: number
): string {
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  const pairs: { other: ParsedMessage; target: ParsedMessage; index: number }[] = [];

  for (let i = 1; i < messages.length; i++) {
    if (messages[i].sender !== targetName) continue;
    if (messages[i - 1].sender === targetName) continue;

    const timeDiff = messages[i].date.getTime() - messages[i - 1].date.getTime();
    if (timeDiff >= 0 && timeDiff <= FIVE_MINUTES_MS) {
      pairs.push({ other: messages[i - 1], target: messages[i], index: i });
    }
  }

  // Diversify across timeline — sample evenly
  const step = Math.max(1, Math.floor(pairs.length / limit));
  const selected: typeof pairs = [];
  for (let i = 0; i < pairs.length && selected.length < limit; i += step) {
    selected.push(pairs[i]);
  }

  // Format with role labels instead of participant names so participant PII is
  // not sent to the model. scrubPII handles PII inside message bodies.
  const lines: string[] = [];
  for (const pair of selected) {
    lines.push(`[OTHER]: ${pair.other.content}`);
    lines.push(`[TARGET]: ${pair.target.content}`);
    lines.push("---");
  }

  return scrubPII(lines.join("\n"));
}

export function extractTargetReplyExamples(
  messages: ParsedMessage[],
  targetName: string,
  limit = 24,
): Array<{ context: string; response: string }> {
  if (!Number.isInteger(limit) || limit < 1) return [];

  const candidates: Array<{ context: string; response: string }> = [];
  const replyWindowMs = 12 * 60 * 60 * 1000;
  for (let index = 1; index < messages.length; index++) {
    const target = messages[index];
    const other = messages[index - 1];
    if (target.sender !== targetName || other.sender === targetName) continue;
    const timeDiff = target.date.getTime() - other.date.getTime();
    if (timeDiff < 0 || timeDiff > replyWindowMs) continue;
    candidates.push({
      context: scrubPII(other.content).trim().slice(0, 500),
      response: scrubPII(target.content).trim().slice(0, 500),
    });
  }

  if (candidates.length <= limit) return candidates;
  if (limit === 1) return [candidates[candidates.length - 1]];

  const selected: Array<{ context: string; response: string }> = [];
  for (let index = 0; index < limit; index++) {
    const candidateIndex = Math.round(index * (candidates.length - 1) / (limit - 1));
    selected.push(candidates[candidateIndex]);
  }
  return selected;
}

// --- 5. scrubPII ---

/** Phone numbers: international format with 10-15 digits */
const PHONE_REGEX = /(?<!\w)\+?(?:\d[\s().-]?){9,14}\d(?!\w)/g;

/** Standard email pattern */
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** Credit card-like sequences: 14-16 consecutive digits */
const CARD_REGEX = /(?<!\d)(?:\d[ -]?){13,18}\d(?!\d)/g;

export function scrubPII(text: string): string {
  return text
    .replace(EMAIL_REGEX, "[EMAIL]")
    .replace(CARD_REGEX, "[CARD]")
    .replace(PHONE_REGEX, "[PHONE]");
}
