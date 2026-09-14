import type { ChatStatistics, SoulSynthesisResult, SynthesisProgress } from "../types.js";
import { splitWhatsAppTextIntoBatches } from './progressiveCloneJob.js';

/**
 * Client-side orchestrator for the WhatsApp Clone → Rafiq pipeline.
 * Calls server endpoints via /api/gemini.
 */

export type CloneRequestStage = 'participants' | 'analysis';

export class CloneRequestError extends Error {
  readonly stage: CloneRequestStage;
  readonly statusCode: number;

  constructor(stage: CloneRequestStage, message: string, statusCode: number) {
    super(message);
    this.name = 'CloneRequestError';
    this.stage = stage;
    this.statusCode = statusCode;
  }
}

type CloneApiResponse<T> = {
  success?: boolean;
  result?: T;
  error?: string;
  stage?: CloneRequestStage;
};

const readResponseBody = async <T>(response: Response): Promise<CloneApiResponse<T>> => {
  try {
    return await response.json() as CloneApiResponse<T>;
  } catch {
    return {};
  }
};

const callServer = async <T>(
  action: string,
  args: unknown[],
  requestStage: CloneRequestStage,
): Promise<T> => {
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, args })
  });
  const data = await readResponseBody<T>(res);
  if (!res.ok || !data.success) {
    const stage = data.stage === 'participants' || data.stage === 'analysis'
      ? data.stage
      : requestStage;
    throw new CloneRequestError(
      stage,
      data.error?.trim() || 'الخدمة مردّتش بشكل مفهوم. جرّب تاني.',
      res.status,
    );
  }
  return data.result as T;
};

const STAGE_ERROR_PREFIX: Record<CloneRequestStage, string> = {
  participants: 'مقدرتش أقرأ المشاركين من الملف',
  analysis: 'تحليل الشخصية مكتملش',
};

export const getCloneRequestErrorMessage = (
  error: unknown,
  fallbackStage: CloneRequestStage,
): string => {
  const stage = error instanceof CloneRequestError ? error.stage : fallbackStage;
  const prefix = STAGE_ERROR_PREFIX[stage];
  const detail = error instanceof Error ? error.message.trim() : '';
  return detail ? `${prefix}: ${detail}` : `${prefix}. جرّب تاني.`;
};

/**
 * Step 1: Get participants from a chat export.
 * Used to show the participant picker UI.
 */
export const getParticipantsFromChat = async (fileContent: string): Promise<ChatStatistics> => {
  const batches = splitWhatsAppTextIntoBatches(fileContent);
  if (batches.length === 1) {
    return callServer<ChatStatistics>('getParticipantsFromChat', [fileContent], 'participants');
  }

  const statistics: ChatStatistics[] = new Array(batches.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < batches.length) {
      const index = nextIndex++;
      statistics[index] = await callServer<ChatStatistics>(
        'getParticipantsFromChat',
        [batches[index]],
        'participants',
      );
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, batches.length) }, worker));

  const totalMessages = statistics.reduce((sum, item) => sum + item.totalMessages, 0);
  const participants = new Map<string, ChatStatistics['participants'][number]>();
  for (const item of statistics) {
    for (const participant of item.participants) {
      const previous = participants.get(participant.name);
      if (!previous) {
        participants.set(participant.name, { ...participant, activeHours: [...participant.activeHours] });
        continue;
      }
      const combinedCount = previous.messageCount + participant.messageCount;
      const weighted = (left: number, right: number) => (
        ((left * previous.messageCount) + (right * participant.messageCount)) / combinedCount
      );
      participants.set(participant.name, {
        ...previous,
        messageCount: combinedCount,
        averageMessageLength: Math.round(weighted(previous.averageMessageLength, participant.averageMessageLength)),
        emojiFrequency: Number(weighted(previous.emojiFrequency, participant.emojiFrequency).toFixed(2)),
        questionFrequency: Number(weighted(previous.questionFrequency, participant.questionFrequency).toFixed(2)),
        fragmentedMessageRatio: Number(weighted(previous.fragmentedMessageRatio, participant.fragmentedMessageRatio).toFixed(3)),
        mediaMessageCount: previous.mediaMessageCount + participant.mediaMessageCount,
        activeHours: [...new Set([...previous.activeHours, ...participant.activeHours])].slice(0, 5),
      });
    }
  }

  const starts = statistics.map(item => Date.parse(item.dateRange.start)).filter(Number.isFinite);
  const ends = statistics.map(item => Date.parse(item.dateRange.end)).filter(Number.isFinite);
  const start = new Date(Math.min(...starts));
  const end = new Date(Math.max(...ends));
  const daySpan = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
  const languageWeights = new Map<ChatStatistics['dominantLanguage'], number>();
  for (const item of statistics) {
    languageWeights.set(item.dominantLanguage, (languageWeights.get(item.dominantLanguage) || 0) + item.totalMessages);
  }
  const dominantLanguage = [...languageWeights.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || 'mixed';

  return {
    totalMessages,
    participants: [...participants.values()].sort((left, right) => right.messageCount - left.messageCount),
    dateRange: { start: start.toISOString(), end: end.toISOString() },
    dominantLanguage,
    averageMessagesPerDay: Number((totalMessages / daySpan).toFixed(2)),
    isGroupChat: participants.size > 2,
  };
};

/**
 * Step 2: Full soul synthesis pipeline.
 * This is the main function that runs the 3-pass AI analysis.
 * 
 * The server call is a single request, so only coarse start/completion states are
 * reported. Intermediate stages would be misleading without a streaming protocol.
 */
export const synthesizeSoulFromChat = async (
  fileContent: string,
  targetNameHint?: string,
  onProgress?: (progress: SynthesisProgress) => void
): Promise<SoulSynthesisResult> => {
  onProgress?.({
    stage: 'synthesis',
    progress: 0,
    message: 'جاري تحليل أسلوب الكلام والشخصية وبناء الذكريات… الحالة تقديرية لحد ما التحليل يكتمل.',
  });

  try {
    const result = await callServer<SoulSynthesisResult>(
      'synthesizeSoulFromChat',
      [fileContent, targetNameHint],
      'analysis',
    );

    onProgress?.({ stage: 'done', progress: 100, message: 'الرفيق جاهز! 🎉' });

    return result;
  } catch (error) {
    onProgress?.({
      stage: 'error',
      progress: 0,
      message: getCloneRequestErrorMessage(error, 'analysis'),
    });
    throw error;
  }
};
