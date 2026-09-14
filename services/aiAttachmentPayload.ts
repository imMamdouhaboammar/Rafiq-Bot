import type { Attachment, AttachmentCategory } from '../types.js';
import { attachmentRepository } from './attachmentRepository.js';
import { getLocalAttachmentId } from './localAttachmentReference.js';
import {
  extractVideoScenes,
  optimizeImageForAi,
  type ExtractedVideoScene,
} from './mediaOptimizer.js';

export const MAX_AI_ATTACHMENTS = 5;
export const MAX_AI_INLINE_RAW_BYTES = 15 * 1024 * 1024;

export interface AiAttachmentPayloadItem {
  mimeType: string;
  data: string;
  fileName?: string;
  fileSize?: number;
  category?: AttachmentCategory;
}

export type SkippedAiAttachmentReason =
  | 'attachment_count_limit'
  | 'unsupported_type'
  | 'missing_local_reference'
  | 'missing_local_bytes'
  | 'invalid_base64'
  | 'empty_attachment'
  | 'inline_budget_exceeded'
  | 'encoding_failed';

export interface SkippedAiAttachment {
  index: number;
  fileName: string;
  mimeType: string;
  reason: SkippedAiAttachmentReason;
  detail: string;
}

export interface PrepareAttachmentsForAiOptions {
  chatId: string;
  repository?: {
    getBlob(id: string, chatId: string): Promise<Blob>;
  };
  blobToBase64?: (blob: Blob, signal?: AbortSignal) => Promise<string>;
  signal?: AbortSignal;
  /** Tests and stricter callers may lower, but never raise, the production cap. */
  maxAttachments?: number;
  /** Tests and stricter callers may lower, but never raise, the production cap. */
  maxTotalRawBytes?: number;
  optimizeMedia?: boolean;
}

export interface PreparedAiAttachments {
  attachments: AiAttachmentPayloadItem[];
  skipped: SkippedAiAttachment[];
}

const textExtensions = new Set([
  'c', 'cpp', 'cs', 'css', 'go', 'h', 'hpp', 'htm', 'html', 'java', 'js', 'jsx', 'json',
  'kt', 'lua', 'md', 'markdown', 'php', 'py', 'rb', 'rs', 'sh', 'sql', 'swift', 'toml',
  'ts', 'tsx', 'txt', 'vue', 'xml', 'yaml', 'yml', 'csv', 'tsv',
]);
const officeExtensions = new Set([
  'doc', 'docx', 'dot', 'dotx', 'hwp', 'hwpx', 'odt', 'rtf', 'xls', 'xlsx', 'ods',
  'ppt', 'pptx',
]);
const archiveExtensions = new Set(['7z', 'bz2', 'gz', 'rar', 'tar', 'tgz', 'zip']);
const supportedImageMimeTypes = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
  'image/avif',
  'image/bmp',
  'image/svg+xml',
  'image/tiff',
]);

const supportedVideoMimeTypes = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/mpeg',
  'video/3gpp',
  'video/x-msvideo',
  'video/ogg',
]);

const supportedAudioMimeTypes = new Set([
  'audio/mp3',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/m4a',
  'audio/aac',
  'audio/flac',
  'audio/mp4',
]);

const videoExtensions = new Set(['mp4', 'webm', 'mov', 'mpeg', 'mpg', '3gp', 'avi', 'ogg', 'mkv']);
const audioExtensions = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus']);

const extensionOf = (fileName?: string): string => (
  fileName?.toLowerCase().match(/\.([^.]+)$/)?.[1] || ''
);

const isTextLike = (attachment: Attachment): boolean => {
  const mimeType = attachment.mimeType.toLowerCase();
  const extension = extensionOf(attachment.fileName);
  if (officeExtensions.has(extension) || archiveExtensions.has(extension)) return false;
  if (attachment.category === 'archive' || attachment.category === 'other') return false;
  if (mimeType.startsWith('text/')) return true;
  if (/^application\/(json|ld\+json|xml|javascript|x-javascript|csv|x-ndjson)$/.test(mimeType)) return true;
  return textExtensions.has(extension);
};

const resolveAiMimeType = (attachment: Attachment): string | undefined => {
  const mimeType = attachment.mimeType.toLowerCase();
  const extension = extensionOf(attachment.fileName);
  if (officeExtensions.has(extension) || archiveExtensions.has(extension)) return undefined;
  if (attachment.category === 'archive' || attachment.category === 'other') return undefined;

  if (supportedImageMimeTypes.has(mimeType)) return mimeType;
  if (mimeType.startsWith('image/')) return mimeType; // Fallback for image types

  if (supportedVideoMimeTypes.has(mimeType)) return mimeType;
  if (mimeType.startsWith('video/')) return mimeType;
  if (videoExtensions.has(extension)) return `video/${extension === 'mov' ? 'quicktime' : extension}`;

  if (supportedAudioMimeTypes.has(mimeType)) return mimeType;
  if (mimeType.startsWith('audio/')) return mimeType;
  if (audioExtensions.has(extension)) return `audio/${extension}`;

  if (mimeType === 'application/pdf') return mimeType;
  if (extension === 'pdf' && (!mimeType || mimeType === 'application/octet-stream' || mimeType === 'binary/octet-stream')) {
    return 'application/pdf';
  }
  if (!isTextLike(attachment)) return undefined;
  return !mimeType || mimeType === 'application/octet-stream' || mimeType === 'binary/octet-stream'
    ? 'text/plain'
    : mimeType;
};

const normalizeBase64 = (value: string): { data: string; rawBytes: number } | undefined => {
  const dataUriMatch = value.match(/^data:[^;,]+;base64,([\s\S]*)$/i);
  const compact = (dataUriMatch?.[1] ?? value).replace(/\s+/g, '');
  if (!compact || !/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) return undefined;

  const firstPadding = compact.indexOf('=');
  if (firstPadding >= 0 && firstPadding < compact.length - (compact.endsWith('==') ? 2 : 1)) return undefined;
  const core = compact.replace(/=+$/, '');
  if (!core || core.length % 4 === 1) return undefined;
  const data = `${core}${'='.repeat((4 - (core.length % 4)) % 4)}`;
  const rawBytes = Math.floor((core.length * 6) / 8);
  return rawBytes > 0 ? { data, rawBytes } : undefined;
};

export const browserBlobToBase64 = async (blob: Blob, signal?: AbortSignal): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  const cleanup = () => signal?.removeEventListener('abort', handleSignalAbort);
  const handleSignalAbort = () => reader.abort();
  if (signal?.aborted) {
    reject(new DOMException('Attachment encoding cancelled.', 'AbortError'));
    return;
  }
  reader.onload = () => {
    cleanup();
    if (typeof reader.result !== 'string') {
      reject(new Error('Attachment encoder returned a non-string result.'));
      return;
    }
    resolve(reader.result.split(',')[1] || '');
  };
  reader.onerror = () => {
    cleanup();
    reject(reader.error || new Error('Failed to read attachment bytes.'));
  };
  reader.onabort = () => {
    cleanup();
    reject(new DOMException('Attachment encoding cancelled.', 'AbortError'));
  };
  signal?.addEventListener('abort', handleSignalAbort, { once: true });
  reader.readAsDataURL(blob);
});

const boundedOption = (value: number | undefined, hardLimit: number): number => {
  if (value === undefined || !Number.isFinite(value)) return hardLimit;
  return Math.max(0, Math.min(hardLimit, Math.floor(value)));
};

const createSkipped = (
  attachment: Attachment,
  index: number,
  reason: SkippedAiAttachmentReason,
  detail: string,
): SkippedAiAttachment => ({
  index,
  fileName: attachment.fileName || `attachment-${index + 1}`,
  mimeType: attachment.mimeType || 'application/octet-stream',
  reason,
  detail,
});

export const prepareAttachmentsForAi = async (
  sourceAttachments: readonly Attachment[],
  options: PrepareAttachmentsForAiOptions,
): Promise<PreparedAiAttachments> => {
  const repository = options.repository || attachmentRepository;
  const blobToBase64 = options.blobToBase64 || browserBlobToBase64;
  const chatId = options.chatId.trim();
  if (!chatId) throw new Error('Chat ID is required to prepare AI attachments.');
  const maxAttachments = boundedOption(options.maxAttachments, MAX_AI_ATTACHMENTS);
  const rawByteBudget = boundedOption(options.maxTotalRawBytes, MAX_AI_INLINE_RAW_BYTES);
  const attachments: AiAttachmentPayloadItem[] = [];
  const skipped: SkippedAiAttachment[] = [];
  let consumedRawBytes = 0;

  for (let index = 0; index < sourceAttachments.length; index += 1) {
    const attachment = sourceAttachments[index];
    if (index >= maxAttachments) {
      skipped.push(createSkipped(attachment, index, 'attachment_count_limit', `Only ${maxAttachments} attachments can be sent to the AI.`));
      continue;
    }
    const resolvedMimeType = resolveAiMimeType(attachment);
    if (!resolvedMimeType) {
      skipped.push(createSkipped(attachment, index, 'unsupported_type', 'This file type is not supported for AI attachment analysis.'));
      continue;
    }

    let normalized: { data: string; rawBytes: number } | undefined;
    let actualSize: number | undefined;
    if (attachment.base64 !== undefined) {
      normalized = normalizeBase64(attachment.base64);
      if (!normalized) {
        skipped.push(createSkipped(attachment, index, 'invalid_base64', 'The legacy attachment data is not valid Base64.'));
        continue;
      }
      actualSize = normalized.rawBytes;
    } else {
      const attachmentId = getLocalAttachmentId(attachment.previewUrl);
      if (!attachmentId) {
        skipped.push(createSkipped(attachment, index, 'missing_local_reference', 'The attachment has no readable local storage reference.'));
        continue;
      }

      let blob: Blob;
      try {
        blob = await repository.getBlob(attachmentId, chatId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        skipped.push(createSkipped(attachment, index, 'missing_local_bytes', message || 'The local attachment bytes are unavailable.'));
        continue;
      }
      if (blob.size === 0) {
        skipped.push(createSkipped(attachment, index, 'empty_attachment', 'The attachment is empty.'));
        continue;
      }

      // Video scene extraction pipeline (extract keyframe scenes to bypass size limits)
      if (resolvedMimeType.startsWith('video/') && options.optimizeMedia !== false && typeof window !== 'undefined') {
        try {
          const sceneResult = await extractVideoScenes(blob, { signal: options.signal });
          if (sceneResult.scenes.length > 0) {
            let addedScenes = 0;
            for (const scene of sceneResult.scenes) {
              if (consumedRawBytes + scene.rawBytes > rawByteBudget || attachments.length >= maxAttachments) {
                break;
              }
              consumedRawBytes += scene.rawBytes;
              attachments.push({
                mimeType: scene.mimeType,
                data: scene.data,
                fileName: `${attachment.fileName || 'video'}_${scene.label}.jpg`,
                fileSize: scene.rawBytes,
                category: 'image',
              });
              addedScenes += 1;
            }
            if (addedScenes > 0) {
              continue;
            }
          }
        } catch (sceneError) {
          if (sceneError instanceof DOMException && sceneError.name === 'AbortError') throw sceneError;
          // Fall through to standard encoding
        }
      }

      if (consumedRawBytes + blob.size > rawByteBudget) {
        // For large images, attempt canvas compression before declaring budget exceeded
        if (resolvedMimeType.startsWith('image/') && options.optimizeMedia !== false && typeof window !== 'undefined') {
          try {
            const optResult = await optimizeImageForAi(blob);
            if (optResult.wasCompressed && consumedRawBytes + optResult.rawBytes <= rawByteBudget) {
              normalized = { data: optResult.data, rawBytes: optResult.rawBytes };
              actualSize = optResult.rawBytes;
            }
          } catch {
            // Ignore optimization error and check budget below
          }
        }

        if (!normalized) {
          skipped.push(createSkipped(attachment, index, 'inline_budget_exceeded', `The ${rawByteBudget}-byte inline attachment budget would be exceeded.`));
          continue;
        }
      }

      if (!normalized) {
        try {
          normalized = normalizeBase64(await blobToBase64(blob, options.signal));
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') throw error;
          const message = error instanceof Error ? error.message : String(error);
          skipped.push(createSkipped(attachment, index, 'encoding_failed', message || 'The attachment could not be encoded.'));
          continue;
        }
        if (!normalized || normalized.rawBytes !== blob.size) {
          skipped.push(createSkipped(attachment, index, 'encoding_failed', 'The encoded attachment size does not match its local bytes.'));
          continue;
        }
        actualSize = blob.size;
      }
    }

    if (consumedRawBytes + normalized.rawBytes > rawByteBudget) {
      skipped.push(createSkipped(attachment, index, 'inline_budget_exceeded', `The ${rawByteBudget}-byte inline attachment budget would be exceeded.`));
      continue;
    }
    consumedRawBytes += normalized.rawBytes;
    attachments.push({
      mimeType: resolvedMimeType,
      data: normalized.data,
      fileName: attachment.fileName,
      fileSize: actualSize,
      category: attachment.category,
    });
  }

  return { attachments, skipped };
};

export const describeSkippedAiAttachments = (skipped: readonly SkippedAiAttachment[]): string => {
  if (skipped.length === 0) return '';
  const rows = skipped.map(item => (
    `${item.index + 1}. ${item.fileName} (${item.mimeType}) — ${item.reason}: ${item.detail}`
  ));
  return [
    '[SKIPPED_AI_ATTACHMENTS]',
    'The following files were not sent to the AI. Do not claim to have read their contents.',
    ...rows,
    '[/SKIPPED_AI_ATTACHMENTS]',
  ].join('\n');
};
