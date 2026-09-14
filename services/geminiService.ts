import { ImageGenConfig, BotSettings, UserProfile, PsychologicalState, VisualSeed, SoulTraits, StudioConfig } from "../types.js";
import { consumeSseResponse, type SseStreamResult } from "./sseStreamParser.js";

const rpc = async (action: string, ...args: any[]) => {
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, args })
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.result;
};

export const fileToGenAIInlineData = async (file: File): Promise<{ mimeType: string; data: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve({ mimeType: file.type, data: (reader.result as string).split(',')[1] });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const sendMessageToGemini = (...args: any[]) => rpc('sendMessageToGemini', ...args);

export interface GeminiStreamRequestOptions {
  __streamRequestOptions: true;
  signal?: AbortSignal;
}

export const createGeminiStreamRequestOptions = (
  signal?: AbortSignal,
): GeminiStreamRequestOptions => ({
  __streamRequestOptions: true,
  signal,
});

const isStreamRequestOptions = (value: unknown): value is GeminiStreamRequestOptions => (
  Boolean(value)
  && typeof value === 'object'
  && (value as { __streamRequestOptions?: unknown }).__streamRequestOptions === true
);

export const sendMessageToGeminiStream = async (
  onChunk: (text: string) => void,
  ...input: any[]
): Promise<SseStreamResult> => {
  const possibleOptions = input[input.length - 1];
  const options = isStreamRequestOptions(possibleOptions) ? possibleOptions : undefined;
  const args = options ? input.slice(0, -1) : input;

  const response = await fetch('/api/gemini-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ args }),
    signal: options?.signal,
  });

  return consumeSseResponse(response, {
    onText: onChunk,
    onMalformedData: (data, error) => {
      console.warn('Failed to parse SSE chunk:', data, error);
    },
  });
};

export const generateGroupResponse = (...args: any[]) => rpc('generateGroupResponse', ...args);
export const analyzeChatExport = (...args: any[]) => rpc('analyzeChatExport', ...args);
export const generateInitiativeMessage = (...args: any[]) => rpc('generateInitiativeMessage', ...args);
export const generateBioFromTraits = (...args: any[]) => rpc('generateBioFromTraits', ...args);
export const generateImage = (...args: any[]) => rpc('generateImage', ...args);
export const generateSelfie = (...args: any[]) => rpc('generateSelfie', ...args);
export const buildAvatarImagePrompt = (...args: any[]) => rpc('buildAvatarImagePrompt', ...args);
export const generateStudioImage = (...args: any[]) => rpc('generateStudioImage', ...args);
export const generateProfileAvatar = (...args: any[]) => rpc('generateProfileAvatar', ...args);
export const generateUserAvatar = (...args: any[]) => rpc('generateUserAvatar', ...args);
export const analyzePersonalitySignals = (...args: any[]) => rpc('analyzePersonalitySignals', ...args);
export const runReflectionConsolidation = (...args: any[]) => rpc('runReflectionConsolidation', ...args);
export const generateVideo = (...args: any[]) => rpc('generateVideo', ...args);
export const processFileUpload = (...args: any[]) => rpc('processFileUpload', ...args);