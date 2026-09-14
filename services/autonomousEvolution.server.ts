import { Type } from '@google/genai';
import type { Schema } from '@google/genai';
import { z } from 'zod';
import { BotMood, MessageRole, type PsychologicalState } from '../types.js';
import { getChatSession, getMessagesForChat, saveChatSession } from './db.js';
import { createGoogleGenAIClient } from './googleClient.server.js';
import { GEMINI_SAFETY_OFF_SETTINGS } from './geminiSafety.server.js';
import { indexVectorMemoryRecords } from './redisVectorMemory.server.js';
import { executeWebSearch } from './tools/webSearchTool.server.js';
import { mergeIntoGraph } from './graphMemory.server.js';
import { BoundedAsyncQueue } from './boundedAsyncQueue.js';
import { resolveRuntimeLocale } from './runtimeLocale.js';

const MAX_PENDING_EVOLUTION_JOBS = 20;
const MAX_DEBOUNCE_TIMERS = 100;
const DEBOUNCE_MS = 5000;
const MAX_INTIMACY_DELTA_PER_RUN = 5;

const EvolutionAnalysisSchema = z.object({
  consolidatedFacts: z.array(z.object({
    text: z.string().trim().min(1).max(1000),
    category: z.string().trim().min(1).max(80),
    salience: z.number().min(0).max(10),
  })).max(8).default([]),
  psychologyUpdate: z.object({
    intimacyChange: z.number().min(-20).max(20),
    moodUpdate: z.string().nullable(),
    reason: z.string().trim().max(500),
  }),
  mistakesToAvoid: z.array(z.string().trim().min(1).max(500)).max(8).default([]),
  curiosityGaps: z.array(z.string().trim().min(1).max(300)).max(3).default([]),
  graphExtraction: z.object({
    nodes: z.array(z.object({
      label: z.string().trim().min(1).max(160),
      type: z.string().trim().min(1).max(80),
      description: z.string().trim().max(500),
    })).max(20).default([]),
    edges: z.array(z.object({
      source: z.string().trim().min(1).max(160),
      target: z.string().trim().min(1).max(160),
      relation: z.string().trim().min(1).max(200),
      weight: z.number().min(0.1).max(1).optional(),
    })).max(30).default([]),
  }).optional(),
});

export type EvolutionAnalysis = z.infer<typeof EvolutionAnalysisSchema>;

const backgroundQueue = new BoundedAsyncQueue({
  maxPending: MAX_PENDING_EVOLUTION_JOBS,
  onError: (error, chatId) => {
    console.error(`[AutonomousEvolution] Job failed for chat ${chatId}:`, error);
  },
});
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

const removeOldestDebounceTimer = (): void => {
  const oldest = debounceTimers.entries().next().value as [string, ReturnType<typeof setTimeout>] | undefined;
  if (!oldest) return;
  clearTimeout(oldest[1]);
  debounceTimers.delete(oldest[0]);
};

export const cancelBackgroundSelfEvolution = (chatId: string): boolean => {
  const timer = debounceTimers.get(chatId);
  if (timer) {
    clearTimeout(timer);
    debounceTimers.delete(chatId);
  }
  return backgroundQueue.cancel(chatId) || Boolean(timer);
};

export const triggerBackgroundSelfEvolution = async (chatId: string): Promise<boolean> => {
  const normalizedChatId = chatId.trim();
  if (!normalizedChatId) return false;

  const existingTimer = debounceTimers.get(normalizedChatId);
  if (existingTimer) clearTimeout(existingTimer);
  if (!existingTimer && debounceTimers.size >= MAX_DEBOUNCE_TIMERS) removeOldestDebounceTimer();

  const timer = setTimeout(() => {
    debounceTimers.delete(normalizedChatId);
    backgroundQueue.enqueue(normalizedChatId, () => runSelfEvolutionStep(normalizedChatId));
  }, DEBOUNCE_MS);
  debounceTimers.set(normalizedChatId, timer);
  return true;
};

const evolutionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    consolidatedFacts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          category: { type: Type.STRING },
          salience: { type: Type.NUMBER },
        },
        required: ['text', 'category', 'salience'],
      },
    },
    psychologyUpdate: {
      type: Type.OBJECT,
      properties: {
        intimacyChange: { type: Type.NUMBER },
        moodUpdate: { type: Type.STRING, nullable: true },
        reason: { type: Type.STRING },
      },
      required: ['intimacyChange', 'moodUpdate', 'reason'],
    },
    mistakesToAvoid: { type: Type.ARRAY, items: { type: Type.STRING } },
    curiosityGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
    graphExtraction: {
      type: Type.OBJECT,
      properties: {
        nodes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              type: { type: Type.STRING },
              description: { type: Type.STRING },
            },
            required: ['label', 'type', 'description'],
          },
        },
        edges: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              source: { type: Type.STRING },
              target: { type: Type.STRING },
              relation: { type: Type.STRING },
              weight: { type: Type.NUMBER },
            },
            required: ['source', 'target', 'relation'],
          },
        },
      },
    },
  },
  required: ['consolidatedFacts', 'psychologyUpdate', 'mistakesToAvoid', 'curiosityGaps'],
};

export const normalizeAutonomousMood = (mood?: string | null): BotMood | null => {
  if (!mood) return null;
  const candidate = mood.toLowerCase() as BotMood;
  if (candidate === BotMood.HANGRY || candidate === BotMood.BROKE) return BotMood.NEUTRAL;
  return Object.values(BotMood).includes(candidate) ? candidate : null;
};

const buildDefaultPsychology = (): PsychologicalState => ({
  mood: BotMood.NEUTRAL,
  energyLevel: 7,
  socialMeter: 5,
  emotionalLedger: 0,
  currentScenario: 'Standard Routine',
  intimacyLevel: 10,
  secretUnlocked: false,
});

const parseEvolutionAnalysis = (rawJson: string): EvolutionAnalysis => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson || '{}');
  } catch {
    throw new Error('Autonomous evolution returned malformed JSON.');
  }
  const result = EvolutionAnalysisSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Autonomous evolution response failed validation: ${result.error.issues[0]?.message || 'unknown error'}`);
  }
  return result.data;
};

export const runSelfEvolutionStep = async (chatId: string): Promise<void> => {
  const session = await getChatSession(chatId);
  if (!session) return;

  const messages = await getMessagesForChat(chatId, 10, Boolean(session.isGroup));
  if (messages.length === 0) return;

  const transcriptText = messages
    .map(message => `[${message.role === MessageRole.USER ? 'User' : 'Rafiq'}]: ${message.text}`)
    .join('\n')
    .slice(0, 12_000);
  const ai = createGoogleGenAIClient();
  const runtimeLocale = resolveRuntimeLocale({
    locale: session.settings.locale,
    timezone: session.settings.timezone,
    direction: session.settings.direction,
    culture: session.settings.culture,
    conversationLanguage: session.settings.conversationLanguage,
  });
  const reflectionPrompt = `
Analyze this recent conversation for gradual background persona learning.
Return only structured JSON matching the supplied schema.
Do not invent facts. Treat corrections as stronger evidence than casual statements.
Do not infer hunger, illness, exhaustion, financial distress, death, jealousy, dependency, or crises unless the user explicitly stated them as biography or roleplay.
Keep personality changes slow and evidence-based.
Keep free-text analysis fields in the conversation language indicated by ${runtimeLocale.conversationLanguage}; do not impose a different regional dialect.

Transcript:
${transcriptText}
  `.trim();

  const response = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: [{ role: 'user', parts: [{ text: reflectionPrompt }] }],
    config: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: evolutionSchema,
      safetySettings: GEMINI_SAFETY_OFF_SETTINGS,
    },
  });
  const analysis = parseEvolutionAnalysis(response.text?.trim() || '{}');

  if (analysis.consolidatedFacts.length > 0) {
    await indexVectorMemoryRecords(chatId, analysis.consolidatedFacts.map(fact => ({
      role: MessageRole.USER,
      text: fact.text,
      category: fact.category,
      timestamp: new Date(),
      salience: fact.salience / 10,
    })));
  }

  if (analysis.mistakesToAvoid.length > 0) {
    await indexVectorMemoryRecords(chatId, analysis.mistakesToAvoid.map(mistake => ({
      role: MessageRole.MODEL,
      text: `[AVOID] ${mistake}`,
      category: 'gotcha',
      timestamp: new Date(),
      salience: 0.9,
    })));
  }

  if (analysis.graphExtraction) {
    const { nodes, edges } = analysis.graphExtraction;
    const validatedNodes = nodes.flatMap(node => (
      node.label && node.type && typeof node.description === 'string'
        ? [{ label: node.label, type: node.type, description: node.description }]
        : []
    ));
    const validatedEdges = edges.flatMap(edge => (
      edge.source && edge.target && edge.relation
        ? [{ source: edge.source, target: edge.target, relation: edge.relation, weight: edge.weight }]
        : []
    ));
    if (validatedNodes.length > 0 || validatedEdges.length > 0) {
      await mergeIntoGraph(chatId, validatedNodes, validatedEdges);
    }
  }

  const psychology: PsychologicalState = {
    ...buildDefaultPsychology(),
    ...(session.psychology || {}),
  };
  const normalizedMood = normalizeAutonomousMood(psychology.mood) || BotMood.NEUTRAL;
  let changed = psychology.mood !== normalizedMood;
  psychology.mood = normalizedMood;

  const requestedDelta = analysis.psychologyUpdate.intimacyChange;
  const intimacyDelta = Math.max(
    -MAX_INTIMACY_DELTA_PER_RUN,
    Math.min(MAX_INTIMACY_DELTA_PER_RUN, requestedDelta),
  );
  if (intimacyDelta !== 0) {
    psychology.intimacyLevel = Math.max(0, Math.min(100, psychology.intimacyLevel + intimacyDelta));
    changed = true;
  }

  const suggestedMood = normalizeAutonomousMood(analysis.psychologyUpdate.moodUpdate);
  if (suggestedMood && suggestedMood !== psychology.mood) {
    psychology.mood = suggestedMood;
    psychology.lastMoodChangedAt = new Date();
    psychology.lastMoodChangeReason = analysis.psychologyUpdate.reason || 'تحديث تدريجي مبني على المحادثة';
    changed = true;
  }

  if (changed) {
    psychology.lastInteractionTime = new Date();
    session.psychology = psychology;
    await saveChatSession(session);
  }

  for (const query of analysis.curiosityGaps.slice(0, 2)) {
    const searchResult = await executeWebSearch({ query, maxResults: 3 });
    if (searchResult.provider === 'unavailable' || searchResult.results.length === 0) continue;

    const resultsSnippet = searchResult.results
      .map((result, index) => `[${index + 1}] ${result.title}: ${result.snippet}`)
      .join('\n')
      .slice(0, 5000);
    const digestResponse = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [{
        role: 'user',
        parts: [{
          text: `Summarize only the supplied search results in one or two factual sentences. Use the query's language and the configured conversation language (${runtimeLocale.conversationLanguage}) as guidance. Do not add unsupported claims.\nQuery: ${query}\n${resultsSnippet}`,
        }],
      }],
      config: { temperature: 0.2, safetySettings: GEMINI_SAFETY_OFF_SETTINGS },
    });
    const summary = digestResponse.text?.trim();
    if (!summary) continue;

    await indexVectorMemoryRecords(chatId, [{
      role: MessageRole.MODEL,
      text: `[VERIFIED] ${query}: ${summary}`,
      category: 'fact',
      timestamp: new Date(),
      salience: 0.7,
    }]);
  }
};
