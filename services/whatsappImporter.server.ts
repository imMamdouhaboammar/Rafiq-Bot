
import { Type, type Schema } from "@google/genai";
import { z } from "zod";
import { RelationType } from "../types.js";
import type { BotSettings } from "../types.js";
import { createGoogleGenAIClient } from "./googleClient.server.js";
import { GEMINI_SAFETY_OFF_SETTINGS } from './geminiSafety.server.js';

// --- Types ---

export interface ParsedMessage {
  date: Date;
  sender: string;
  content: string;
}

export const MAX_WHATSAPP_EXPORT_BYTES = 20 * 1024 * 1024;

export class WhatsAppExportTooLargeError extends Error {
  readonly statusCode = 413;

  constructor(actualBytes: number) {
    super(
      `WhatsApp export is too large (${actualBytes} bytes). Maximum supported size is ${MAX_WHATSAPP_EXPORT_BYTES} bytes. Export the chat without media and try again.`,
    );
    this.name = "WhatsAppExportTooLargeError";
  }
}

// --- Parsing Logic ---

/**
 * Normalizes a captured timestamp component from an Arabic/localized export.
 * Message bodies deliberately never pass through this function: timestamp
 * normalization must not rewrite Arabic words, punctuation, or digits users
 * actually sent.
 */
const normalizeTimestampComponent = (text: string): string => {
  let clean = text
    // Remove LTR/RTL marks, Zero-width joiners, etc.
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\u200B-\u200D]/g, "") 
    .replace(/\u00A0/g, " ") // Non-breaking space to normal space
    .trim();

  // 1. Convert Arabic Indic Digits to Latin
  const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  clean = clean.replace(/[٠-٩]/g, (w) => arabicDigits.indexOf(w).toString());

  // Arabic markers are safe to replace here because `text` is only the
  // timestamp capture, never the sender or message content.
  clean = clean.replace(/\s*(?:ص|صباحاً|صباحا)\s*$/u, " AM");
  clean = clean.replace(/\s*(?:م|مساءً|مساء)\s*$/u, " PM");

  // Handle dot in AM/PM (a.m. / p.m.)
  clean = clean.replace(/a\.m\./gi, "AM").replace(/p\.m\./gi, "PM");

  return clean;
};

const SYSTEM_MESSAGE_PATTERN = /(?:omitted|end-to-end encryption|waiting for this message|created group|added you|left the group|changed the subject|changed the group icon|صورة محذوفة|فيديو محذوف|ملصق محذوف|مقطع صوتي محذوف|رسالة محذوفة|تم حذف هذه الرسالة|تم استبعاد الوسائط|الرسائل والمكالمات مشفرة)/i;

/**
 * Tries to parse a date string into a JS Date object.
 * Handles DD/MM/YYYY, MM/DD/YYYY, and various separators.
 */
const parseDateString = (dateStr: string, timeStr: string): Date | null => {
  const dateParts = dateStr.replace(/[.-]/g, "/").split("/").map(Number);
  if (dateParts.length !== 3 || dateParts.some((part) => !Number.isInteger(part))) return null;

  let [first, second, third] = dateParts;
  let year: number;
  let month: number;
  let day: number;

  if (String(first).length === 4) {
    year = first;
    month = second;
    day = third;
  } else {
    year = third < 100 ? 2000 + third : third;
    // WhatsApp exports follow the device locale. When both positions are
    // ambiguous, use DD/MM consistently for Rafiq's Cairo locale.
    if (first > 12 && second <= 12) {
      day = first;
      month = second;
    } else if (second > 12 && first <= 12) {
      month = first;
      day = second;
    } else {
      day = first;
      month = second;
    }
  }

  const timeMatch = timeStr
    .trim()
    .replace(/[.]/g, ":")
    .match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!timeMatch) return null;

  let hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const secondValue = Number(timeMatch[3] || 0);
  const marker = timeMatch[4]?.toUpperCase();
  if (marker) {
    if (hour < 1 || hour > 12) return null;
    if (marker === "AM") hour %= 12;
    if (marker === "PM") hour = (hour % 12) + 12;
  }

  if (
    year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31 ||
    hour < 0 || hour > 23 || minute < 0 || minute > 59 || secondValue < 0 || secondValue > 59
  ) return null;

  const parsed = new Date(year, month - 1, day, hour, minute, secondValue, 0);
  if (
    parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day ||
    parsed.getHours() !== hour || parsed.getMinutes() !== minute || parsed.getSeconds() !== secondValue
  ) return null;

  return parsed;
};

/**
 * Parses a raw WhatsApp export string into structured messages.
 * Uses relaxed regex patterns to handle variations like "Mon, 12/12/2024" or "[12/12/2024]".
 */
export const parseWhatsAppChat = (text: string): ParsedMessage[] => {
  const inputBytes = Buffer.byteLength(text, "utf8");
  if (inputBytes > MAX_WHATSAPP_EXPORT_BYTES) {
    throw new WhatsAppExportTooLargeError(inputBytes);
  }

  const lines = text.split(/\r?\n/);
  const messages: ParsedMessage[] = [];

  // --- Regex Components ---
  const localizedDigit = `\\d٠-٩`;
  const directionalMarks = `[\\u200e\\u200f\\u202a-\\u202e\\u2066-\\u2069\\u200B-\\u200D]*`;
  // Matches localized forms of 12/12/2024 or 12-12-24.
  const datePat = `([${localizedDigit}]{1,4}${directionalMarks}[./-]${directionalMarks}[${localizedDigit}]{1,2}${directionalMarks}[./-]${directionalMarks}[${localizedDigit}]{2,4})`;
  // Matches 10:30, 10:30:55, 10:30 PM, or Arabic AM/PM markers.
  const timeMarkerPat = `(?:[aApP]\\.?[mM]\\.?|ص|صباحاً|صباحا|م|مساءً|مساء)`;
  const timePat = `([${localizedDigit}]{1,2}[:.][${localizedDigit}]{2}(?:[:.][${localizedDigit}]{2})?(?:\\s*${timeMarkerPat})?)`;

  // A weekday prefix is allowed, but the timestamp itself must stay at the
  // beginning of the line. Matching a date anywhere in a continuation line
  // fabricates participants from ordinary text such as "Location: Cairo".
  const weekdayPrefixPat = `(?:[^${localizedDigit}\\[][^${localizedDigit}]{0,24}[,،]\\s*)?`;

  // 1. iOS: Starts with [, optional weekday, Date, Time, ], Sender: Content
  // Example: [Monday, 12/12/2024, 10:30 PM] Sender: Msg
  const iosRegex = new RegExp(`^${directionalMarks}\\[${weekdayPrefixPat}${datePat}\\s*[,،]\\s*${timePat}\\s*\\]\\s+(.*?):\\s+(.*)`, "u");
  
  // 2. Android: Starts with optional weekday, Date, Time, - , Sender: Content
  // Example: 12/12/2024, 10:30 PM - Sender: Msg
  const androidRegex = new RegExp(`^${directionalMarks}${weekdayPrefixPat}${datePat}\\s*[,،]\\s*${timePat}\\s*[-–—]\\s+(.*?):\\s+(.*)`, "u");

  lines.forEach(rawLine => {
    const line = rawLine.replace(/\r$/, "");
    if (!line.trim()) return;

    let match = line.match(iosRegex) || line.match(androidRegex);

    if (match) {
        // New Message Found
        const datePart = normalizeTimestampComponent(match[1]);
        const timePart = normalizeTimestampComponent(match[2]);
        const sender = match[3]
          .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\u200B-\u200D]/g, "")
          .trim();
        const messageContent = match[4].trim();

        // Filter System Messages
        if (SYSTEM_MESSAGE_PATTERN.test(messageContent)) return;

        const parsedDate = parseDateString(datePart, timePart);
        if (!parsedDate) return;

        messages.push({
            date: parsedDate,
            sender: sender,
            content: messageContent
        });

    } else {
        // Multi-line message continuation
        // If the line DOES NOT start with something looking like a date/timestamp, append it.
        // Simple check: does it start with digit or bracket-digit?
        const looksLikeNewMessage = new RegExp(
          `^${directionalMarks}(?:\\[)?${weekdayPrefixPat}${datePat}\\s*[,،]\\s*${timePat}`,
          "iu",
        ).test(line);
        
        if (!looksLikeNewMessage && messages.length > 0) {
            messages[messages.length - 1].content += `\n${line}`;
        }
    }
  });

  return messages;
};

/**
 * Prepares chat text for AI analysis.
 */
const prepareChatForAnalysis = (messages: ParsedMessage[]): string => {
  // Take last 600 messages (increased from 400 for more context)
  const RECENT_LIMIT = 600;
  const recentMessages = messages.slice(-RECENT_LIMIT);
  
  return recentMessages.map(m => `${m.sender}: ${m.content}`).join('\n');
};

/**
 * Checks if a string contains Arabic characters.
 */
const isArabicText = (text: string) => {
    const arabicPattern = /[\u0600-\u06FF]/;
    return arabicPattern.test(text);
};

// --- Analysis Logic ---

export const analyzeChatAndGeneratePersona = async (fileContent: string, targetNameHint?: string): Promise<BotSettings> => {
  const ai = createGoogleGenAIClient();

  // 1. Parse
  const messages = parseWhatsAppChat(fileContent);
  
  if (messages.length === 0) {
    throw new Error("لم نتمكن من قراءة أي رسائل. تأكد أن الملف هو 'Export Chat' من واتساب بصيغة .txt (حاول استخدام ملف بدون وسائط)");
  }

  // 2. Identify likely User vs Target
  const senderCounts: Record<string, number> = {};
  messages.forEach(m => { senderCounts[m.sender] = (senderCounts[m.sender] || 0) + 1; });
  
  const participants = Object.keys(senderCounts);
  
  // 3. Prepare Chat Sample
  const chatSample = prepareChatForAnalysis(messages);
  
  // 4. Detect Dominant Language
  const isArabic = isArabicText(chatSample);
  const langInstruction = isArabic 
    ? "THE CHAT IS IN ARABIC. YOUR OUTPUT (Bio, Impersonation Profile) MUST BE IN EGYPTIAN ARABIC (DIALECT). Do not write in English." 
    : "The chat is in English. Output in English.";

  // 5. Construct Target Logic
  let targetLogic = `
    1. **Identify Target:** If one person is "You", the OTHER is the Target. If both have names, pick the one with the most distinct personality.
  `;
  
  if (targetNameHint && targetNameHint.trim()) {
      const requestedTarget = targetNameHint.trim();
      const exactTarget = participants.find(
        participant => participant.localeCompare(requestedTarget, undefined, { sensitivity: "accent" }) === 0,
      );
      if (!exactTarget) {
        throw new Error(`Target participant "${requestedTarget}" was not found exactly in this WhatsApp export.`);
      }
      targetLogic = `
        1. **MANDATORY TARGET:** Analyze only the exact participant "${exactTarget}".
        - Do not substitute a nickname, partial match, or another participant.
        - IGNORE everyone else. Focus ONLY on "${exactTarget}".
      `;
  }

  const prompt = `
    You are an expert Psychologist, Linguist, and Ghostwriter.
    
    I have a WhatsApp chat export between: ${participants.join(', ')}
    
    **GOAL:** Clone the personality of the "Target" person.
    
    **CRITICAL RULES:**
    ${targetLogic}
    2. **Language:** ${langInstruction}
    3. **Depth:** Do NOT summarize. I need deep, granular details. Capture their soul.
    4. **Output Format:** JSON.

    **REQUIRED ANALYSIS:**
    - **Bio:** A deep, 1st-person psychological summary. Not just facts, but fears, dreams, and vibes.
    - **Impersonation Profile:** This is the most important field. It acts as the "System Instruction" for an AI. It must be a LONG, comprehensive block of text (4-5 paragraphs) covering:
        - Exact slang words they use (e.g., "Ya sahby", "Ashta", "Lol", "A7a").
        - Typing style (do they use punctuation? do they split messages? do they use specific emojis like 😂 vs 😭?).
        - Their mood swings and emotional triggers.
        - Their relationship dynamic with the other person (Are they flirty? Cold? Needy? Sarcastic?).
        - Specific topics they obsess over.

    **Chat Sample:**
    ${chatSample}
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      targetName: { type: Type.STRING },
      gender: { type: Type.STRING, enum: ['male', 'female'] },
      age: { type: Type.INTEGER },
      bio: { 
          type: Type.STRING, 
          description: "Detailed 1st person psychological bio. If Arabic chat, write in Arabic." 
      },
      chattiness: { type: Type.STRING, enum: ['low', 'balanced', 'high'] },
      fragmentedMessages: { type: Type.BOOLEAN },
      impersonationProfile: { 
          type: Type.STRING, 
          description: "A HUGE, detailed system instruction block. MUST BE IN THE SAME LANGUAGE/DIALECT AS THE CHAT. Include specific slang, emoji habits, and behavioral rules. Do not be brief." 
      },
      relationshipType: { type: Type.STRING, enum: Object.values(RelationType) },
    },
    required: ['targetName', 'gender', 'age', 'bio', 'chattiness', 'fragmentedMessages', 'impersonationProfile'],
  };

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      temperature: 1.0,
      responseMimeType: 'application/json',
      responseSchema: schema,
      safetySettings: GEMINI_SAFETY_OFF_SETTINGS,
    }
  });

  const legacyPersonaSchema = z.object({
    targetName: z.string().trim().min(1).max(160),
    gender: z.enum(["male", "female"]),
    age: z.number().int().min(13).max(100),
    bio: z.string().trim().min(40).max(4_000),
    chattiness: z.enum(["low", "balanced", "high"]),
    fragmentedMessages: z.boolean(),
    impersonationProfile: z.string().trim().min(120).max(12_000),
    relationshipType: z.nativeEnum(RelationType),
  }).strict();

  let result: z.infer<typeof legacyPersonaSchema>;
  try {
    result = legacyPersonaSchema.parse(JSON.parse(response.text || ""));
  } catch (error) {
    throw new Error("WhatsApp persona analysis returned an invalid result.", { cause: error });
  }

  if (targetNameHint && result.targetName !== targetNameHint.trim()) {
    throw new Error("WhatsApp persona analysis returned a different target participant.");
  }

  return {
    botName: result.targetName,
    botGender: result.gender,
    botAge: result.age,
    botBio: result.bio,
    avatarUrl: undefined,
    chattiness: result.chattiness,
    fragmentedMessages: result.fragmentedMessages,
    relationshipWithUser: result.relationshipType,
    relationshipsWithBots: [],
    impersonationProfile: result.impersonationProfile,
    visualSeed: undefined
  };
};
