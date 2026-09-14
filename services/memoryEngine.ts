import { ChatMessage, ChatSession, MemoryEntry, MessageRole, type SoulMemorySeed } from "../types.js";
import { MemoryRecordSchema, type MemoryRecord } from '../contracts/rafiqV6.js';
import * as DB from "./db.js";
import './registerDbV6.js';
import { calculateMemoryExpiry, inferMemoryRetention } from './memoryPolicy.js';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'have', 'from', 'your', 'you', 'are', 'was', 'but', 'not',
  'انا', 'انت', 'انتي', 'هو', 'هي', 'هم', 'احنا', 'على', 'في', 'من', 'الى', 'عن', 'مع', 'ده', 'دي', 'دا',
  'ايه', 'اي', 'او', 'بس', 'يعني', 'مش', 'مش', 'كان', 'كانت', 'يكون', 'تكون', 'عشان', 'كده', 'جدا', 'اوي'
]);

const FACTUAL_QUERY_PATTERN = /(النهارده|اليوم|دلوقتي|دلوقت|آخر|اخر|news|latest|current|price|سعر|مين|من هو|what|who|when|where|why|how much|كام|تاريخ|خبر)/i;

const PERSONAL_MEMORY_PATTERN = /(انا|اسمي|عندي|بحب|بكره|نفسي|بحلم|عايز|عاوزه|هدفي|مشكلتي|خايف|زعلان|مبسوط|ساكن|شغال|بشتغل|من\s+\w+)/i;

const normalizeText = (text: string): string => (
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
);

const tokenize = (text: string): string[] => (
  normalizeText(text)
    .split(' ')
    .filter(token => token.length > 1 && !STOP_WORDS.has(token))
    .slice(0, 24)
);

const inferCategory = (text: string): MemoryEntry['category'] => {
  if (/(بحب|بكره|favorite|افضل|مفضل)/i.test(text)) return 'preference';
  if (/(نفسي|هدفي|بحلم|عايز|عاوزه|خطة|plan)/i.test(text)) return 'goal';
  if (/(اسمي|سنّي|عندي|من|شغال|بشتغل|ساكن)/i.test(text)) return 'identity';
  if (/(زعلان|فرحان|مبسوط|مخنوق|متضايق|خايف|قلقان)/i.test(text)) return 'emotion';
  if (/(افتكر|فاكر|remember|مرة|زمان|حصل|ذكري)/i.test(text)) return 'memory';
  if (/(معلومة|fact|تعرف|تعرفي|مين|كام|تاريخ)/i.test(text)) return 'fact';
  return 'general';
};

const computeSalience = (message: ChatMessage, category: MemoryEntry['category']): number => {
  let salience = message.role === MessageRole.USER ? 0.7 : 0.45;
  if (message.text.length > 80) salience += 0.1;
  if (PERSONAL_MEMORY_PATTERN.test(message.text)) salience += 0.2;
  if (category === 'identity' || category === 'goal' || category === 'emotion') salience += 0.15;
  if (message.replyTo) salience += 0.05;
  return Math.min(1, salience);
};

const summarize = (text: string): string => {
  const trimmed = text.trim();
  return trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed;
};

export const buildMemoryEntry = (chatId: string, message: ChatMessage): MemoryEntry | null => {
  if (!message.text.trim() || message.text.trim().length < 6) return null;

  const keywords = tokenize(message.text);
  if (keywords.length < 2 && !PERSONAL_MEMORY_PATTERN.test(message.text)) return null;

  const category = inferCategory(message.text);
  const now = message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp);

  return {
    id: `${chatId}:${message.id}`,
    chatId,
    sourceMessageId: message.id,
    sourceRole: message.role,
    text: message.text,
    summary: summarize(message.text),
    normalizedText: normalizeText(message.text),
    keywords,
    category,
    salience: computeSalience(message, category),
    createdAt: now,
    updatedAt: now,
  };
};

export const ensureBoostMemoryIndex = async (chat: ChatSession, messages: ChatMessage[]) => {
  if (chat.isGroup || !chat.settings.boostRafiq) return;

  const existingCount = await DB.countMemoryEntriesForChat(chat.id);
  const candidateMessages = messages.filter(message => message.text.trim().length >= 6);
  if (existingCount >= Math.max(3, Math.floor(candidateMessages.length * 0.7))) return;

  const entries = candidateMessages
    .map(message => buildMemoryEntry(chat.id, message))
    .filter((entry): entry is MemoryEntry => Boolean(entry));

  if (entries.length > 0) {
    await DB.bulkUpsertMemoryEntries(entries);
  }
};

export const indexBoostMemoryMessage = async (chat: ChatSession, message: ChatMessage) => {
  if (chat.isGroup || !chat.settings.boostRafiq) return;
  const entry = buildMemoryEntry(chat.id, message);
  if (entry) {
    await DB.saveMemoryEntry(entry);
  }
};

const scoreMemory = (entry: MemoryEntry, queryTokens: string[]): number => {
  const overlap = queryTokens.filter(token => entry.keywords.includes(token)).length;
  const recencyBoost = Math.max(0, 0.25 - ((Date.now() - entry.updatedAt.getTime()) / (1000 * 60 * 60 * 24 * 90)));
  const categoryBoost = entry.category === 'identity' || entry.category === 'goal' || entry.category === 'emotion' ? 0.12 : 0;
  return overlap * 0.45 + entry.salience * 0.4 + recencyBoost + categoryBoost;
};

const formatMemoryContext = (entries: MemoryEntry[]): string => {
  if (entries.length === 0) return '';
  const lines = entries.map(entry => `- [${entry.category}] ${entry.summary}`);
  return `Retrieved memory index:\n${lines.join('\n')}`;
};

export const retrieveBoostContext = async (chat: ChatSession, query: string) => {
  if (chat.isGroup || !chat.settings.boostRafiq) {
    return { externalContext: undefined, allowSearch: false };
  }

  const entries = await DB.getMemoryEntriesForChat(chat.id);
  const queryTokens = tokenize(query);
  const ranked = entries
    .map(entry => ({ entry, score: scoreMemory(entry, queryTokens) }))
    .filter(item => item.score > 0.18)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const factualIntent = FACTUAL_QUERY_PATTERN.test(query);
  const weakMemoryCoverage = ranked.length === 0 || ranked[0].score < 0.65;

  return {
    externalContext: formatMemoryContext(ranked.map(item => item.entry)) || undefined,
    allowSearch: factualIntent && weakMemoryCoverage,
  };
};

/**
 * Seeds memory entries from a SoulBlueprint's memory seeds.
 * Used when creating a cloned Rafiq from WhatsApp chat analysis.
 * This gives the clone "memories" from the original conversation.
 */
export const buildBlueprintMemoryRecords = (
  chatId: string,
  seeds: SoulMemorySeed[],
  now = new Date(),
): { legacyEntries: MemoryEntry[]; memoryRecords: MemoryRecord[] } => {
  const validSeeds = (seeds || []).filter(seed => seed.text && seed.text.trim().length >= 4);
  const legacyEntries: MemoryEntry[] = validSeeds
    .map((seed, i) => ({
      id: `${chatId}:seed_${i}`,
      chatId,
      sourceMessageId: `seed_${i}`,
      sourceRole: seed.subject === 'user' ? MessageRole.USER : MessageRole.MODEL,
      text: seed.text.trim(),
      summary: seed.text.trim().length > 180 ? `${seed.text.trim().slice(0, 177)}...` : seed.text.trim(),
      normalizedText: normalizeText(seed.text),
      keywords: tokenize(seed.text),
      category: seed.category,
      salience: Math.max(0, Math.min(1, seed.salience || 0.7)),
      createdAt: now,
      updatedAt: now,
    }));

  const memoryRecords = legacyEntries.map((entry, index) => {
    const seed = validSeeds[index];
    const retention = inferMemoryRetention(entry.category);
    return MemoryRecordSchema.parse({
      id: `clone:${entry.id}`,
      ownerUserId: 'main_user',
      scope: 'chat',
      scopeId: chatId,
      text: entry.text,
      summary: entry.summary,
      category: entry.category,
      provenance: {
        kind: seed?.subject === 'user' ? 'user_message' : 'bot_message',
        sourceIds: [entry.sourceMessageId],
        observedAt: now,
      },
      confidence: 0.8,
      salience: entry.salience,
      sensitivity: 'normal',
      retention,
      expiresAt: calculateMemoryExpiry(retention, now),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
  });

  return { legacyEntries, memoryRecords };
};

export const seedMemoriesFromBlueprint = async (
  chatId: string,
  seeds: SoulMemorySeed[],
): Promise<number> => {
  const { legacyEntries, memoryRecords } = buildBlueprintMemoryRecords(chatId, seeds);

  if (legacyEntries.length > 0) {
    await DB.saveCloneMemoryRecords(legacyEntries, memoryRecords);
  }

  return legacyEntries.length;
};
