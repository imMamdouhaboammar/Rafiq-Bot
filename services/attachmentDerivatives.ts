import type { AttachmentCategory } from '../types.js';
import {
  MAX_AUDIO_CHUNKS,
  MAX_DERIVED_TEXT_CHARS,
  MAX_VIDEO_KEYFRAMES,
} from './largeFilePolicy.js';

export interface AttachmentDerivativePlan {
  extractText: boolean;
  maxTextCharacters: number;
  captureMetadata: boolean;
  videoKeyframeTimes: number[];
  audioChunks: Array<{ startSeconds: number; durationSeconds: number }>;
}

export const createAttachmentDerivativePlan = ({
  category,
  durationSeconds,
}: {
  category: AttachmentCategory;
  durationSeconds?: number;
}): AttachmentDerivativePlan => {
  const duration = Number.isFinite(durationSeconds) && durationSeconds! > 0
    ? durationSeconds!
    : 0;
  const videoKeyframeCount = category === 'video' && duration > 0
    ? Math.min(MAX_VIDEO_KEYFRAMES, Math.max(1, Math.ceil(duration / 30)))
    : 0;
  const videoKeyframeTimes = category === 'video' && duration > 0
    ? Array.from({ length: videoKeyframeCount }, (_, index) => (
        Math.min(duration, ((index + 1) / (videoKeyframeCount + 1)) * duration)
      ))
    : [];
  const audioChunkCount = category === 'audio' && duration > 0
    ? Math.min(MAX_AUDIO_CHUNKS, Math.max(1, Math.ceil(duration / 30)))
    : 0;
  const audioChunks = Array.from({ length: audioChunkCount }, (_, index) => ({
    startSeconds: index * 30,
    durationSeconds: Math.min(30, Math.max(0, duration - index * 30)),
  })).filter(chunk => chunk.durationSeconds > 0);

  return {
    extractText: category === 'document' || category === 'code' || category === 'spreadsheet',
    maxTextCharacters: MAX_DERIVED_TEXT_CHARS,
    captureMetadata: true,
    videoKeyframeTimes,
    audioChunks,
  };
};

export const sanitizeDerivedText = (
  text: string,
  maxCharacters = MAX_DERIVED_TEXT_CHARS,
): string => text
  .replace(/\u0000/g, '')
  .replace(/\r\n/g, '\n')
  .slice(0, Math.max(0, maxCharacters));

export interface LocalAttachmentMetadata {
  name: string;
  type: string;
  sizeBytes: number;
  lastModified?: number;
  category: AttachmentCategory;
}

export const buildLocalAttachmentMetadata = ({
  name,
  type,
  size,
  lastModified,
  category,
}: {
  name: string;
  type: string;
  size: number;
  lastModified?: number;
  category: AttachmentCategory;
}): LocalAttachmentMetadata => ({
  name: name.slice(0, 512),
  type: (type || 'application/octet-stream').slice(0, 255),
  sizeBytes: Math.max(0, Math.floor(size)),
  lastModified: Number.isFinite(lastModified) ? lastModified : undefined,
  category,
});
