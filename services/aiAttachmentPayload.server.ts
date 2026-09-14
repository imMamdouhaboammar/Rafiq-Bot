import type { AttachmentCategory } from '../types.js';
import { MAX_DERIVED_TEXT_CHARS } from './largeFilePolicy.js';

export const MAX_SERVER_AI_ATTACHMENTS = 5;
export const MAX_SERVER_AI_ATTACHMENT_BYTES = 15 * 1024 * 1024;
export const MAX_SERVER_ATTACHMENT_FILE_NAME_CHARS = 512;
export const MAX_SERVER_ATTACHMENT_MIME_CHARS = 255;
export const ATTACHMENT_TEXT_TRUNCATION_MARKER = '[ATTACHMENT_TEXT_TRUNCATED]';

const IMAGE_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/bmp',
  'image/svg+xml',
  'image/tiff',
]);

const VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/mpeg',
  'video/3gpp',
  'video/x-msvideo',
  'video/ogg',
]);

const AUDIO_MIME_TYPES = new Set([
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

const APPLICATION_TEXT_MIME_TYPES = new Set([
  'application/csv',
  'application/javascript',
  'application/json',
  'application/ld+json',
  'application/x-javascript',
  'application/x-ndjson',
  'application/xml',
]);
const ATTACHMENT_CATEGORIES = new Set<AttachmentCategory>([
  'image',
  'audio',
  'video',
  'document',
  'code',
  'spreadsheet',
  'archive',
  'other',
]);
const CANONICAL_BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;
const MIME_TYPE_PATTERN = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

export interface ServerAiAttachment {
  mimeType: string;
  data: string;
  fileName?: string;
  fileSize: number;
  category?: AttachmentCategory;
}

export class AiAttachmentValidationError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'AiAttachmentValidationError';
  }
}

export const isServerTextAttachment = (
  attachment: Pick<ServerAiAttachment, 'mimeType'>,
): boolean => attachment.mimeType.startsWith('text/')
  || APPLICATION_TEXT_MIME_TYPES.has(attachment.mimeType);

export const isServerInlineBinaryAttachment = (
  attachment: Pick<ServerAiAttachment, 'mimeType'>,
): boolean => IMAGE_MIME_TYPES.has(attachment.mimeType)
  || attachment.mimeType.startsWith('image/')
  || VIDEO_MIME_TYPES.has(attachment.mimeType)
  || attachment.mimeType.startsWith('video/')
  || AUDIO_MIME_TYPES.has(attachment.mimeType)
  || attachment.mimeType.startsWith('audio/')
  || attachment.mimeType === 'application/pdf';

const normalizeMimeType = (value: unknown, index: number): string => {
  if (typeof value !== 'string') {
    throw new AiAttachmentValidationError(`Attachment ${index + 1} requires a MIME type.`);
  }
  const mimeType = value.trim().toLowerCase();
  if (
    mimeType.length === 0
    || mimeType.length > MAX_SERVER_ATTACHMENT_MIME_CHARS
    || !MIME_TYPE_PATTERN.test(mimeType)
  ) {
    throw new AiAttachmentValidationError(`Attachment ${index + 1} has an invalid MIME type.`);
  }
  if (
    !IMAGE_MIME_TYPES.has(mimeType)
    && !mimeType.startsWith('image/')
    && !VIDEO_MIME_TYPES.has(mimeType)
    && !mimeType.startsWith('video/')
    && !AUDIO_MIME_TYPES.has(mimeType)
    && !mimeType.startsWith('audio/')
    && mimeType !== 'application/pdf'
    && !mimeType.startsWith('text/')
    && !APPLICATION_TEXT_MIME_TYPES.has(mimeType)
  ) {
    throw new AiAttachmentValidationError(`Attachment ${index + 1} MIME type is not supported.`);
  }
  return mimeType;
};

const normalizeFileName = (value: unknown, index: number): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new AiAttachmentValidationError(`Attachment ${index + 1} file name must be a string.`);
  }
  const fileName = value.trim();
  if (
    fileName.length === 0
    || fileName.length > MAX_SERVER_ATTACHMENT_FILE_NAME_CHARS
    || CONTROL_CHARACTER_PATTERN.test(fileName)
  ) {
    throw new AiAttachmentValidationError(`Attachment ${index + 1} has an invalid file name.`);
  }
  return fileName;
};

const normalizeCategory = (value: unknown, index: number): AttachmentCategory | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !ATTACHMENT_CATEGORIES.has(value as AttachmentCategory)) {
    throw new AiAttachmentValidationError(`Attachment ${index + 1} has an invalid category.`);
  }
  return value as AttachmentCategory;
};

const decodeCanonicalBase64 = (value: unknown, index: number): { data: string; decoded: Buffer } => {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length % 4 !== 0
    || !CANONICAL_BASE64_PATTERN.test(value)
  ) {
    throw new AiAttachmentValidationError(`Attachment ${index + 1} data must be canonical non-empty Base64.`);
  }
  const decoded = Buffer.from(value, 'base64');
  if (decoded.length === 0 || decoded.toString('base64') !== value) {
    throw new AiAttachmentValidationError(`Attachment ${index + 1} data must be canonical non-empty Base64.`);
  }
  return { data: value, decoded };
};

export const normalizeServerAiAttachments = (input: unknown): ServerAiAttachment[] => {
  if (!Array.isArray(input)) {
    throw new AiAttachmentValidationError('Attachments must be an array.');
  }
  if (input.length > MAX_SERVER_AI_ATTACHMENTS) {
    throw new AiAttachmentValidationError(`A maximum of ${MAX_SERVER_AI_ATTACHMENTS} AI attachments is allowed.`);
  }

  let totalDecodedBytes = 0;
  return input.map((value, index) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new AiAttachmentValidationError(`Attachment ${index + 1} must be an object.`);
    }
    const source = value as Record<string, unknown>;
    const mimeType = normalizeMimeType(source.mimeType, index);
    const fileName = normalizeFileName(source.fileName, index);
    const category = normalizeCategory(source.category, index);
    if (
      source.fileSize !== undefined
      && (!Number.isSafeInteger(source.fileSize) || Number(source.fileSize) < 0)
    ) {
      throw new AiAttachmentValidationError(`Attachment ${index + 1} has an invalid file size.`);
    }
    const { data, decoded } = decodeCanonicalBase64(source.data, index);
    totalDecodedBytes += decoded.length;
    if (totalDecodedBytes > MAX_SERVER_AI_ATTACHMENT_BYTES) {
      throw new AiAttachmentValidationError(`AI attachments exceed the ${MAX_SERVER_AI_ATTACHMENT_BYTES}-byte limit.`);
    }
    return {
      mimeType,
      data,
      fileName,
      fileSize: decoded.length,
      category,
    };
  });
};

export const buildBoundedAttachmentText = (
  attachments: ReadonlyArray<Pick<ServerAiAttachment, 'mimeType' | 'data' | 'fileName'>>,
  maxCharacters = MAX_DERIVED_TEXT_CHARS,
): string | undefined => {
  const textAttachments = attachments.filter(isServerTextAttachment);
  if (textAttachments.length === 0) return undefined;

  let remainingCharacters = Math.max(0, Math.min(MAX_DERIVED_TEXT_CHARS, Math.floor(maxCharacters)));
  const sections: string[] = [];
  for (let index = 0; index < textAttachments.length; index += 1) {
    const attachment = textAttachments[index];
    const decoded = Buffer.from(attachment.data, 'base64').toString('utf8');
    const included = decoded.slice(0, remainingCharacters);
    remainingCharacters -= included.length;
    sections.push(`\n[ATTACHED_FILE_CONTENT: ${attachment.fileName || 'unnamed'}]\n${included}`);
    const contentWasTruncated = included.length < decoded.length;
    const laterTextWasOmitted = remainingCharacters === 0 && index < textAttachments.length - 1;
    if (contentWasTruncated || laterTextWasOmitted) {
      sections.push(ATTACHMENT_TEXT_TRUNCATION_MARKER);
      break;
    }
  }
  return sections.join('\n');
};

export const buildAttachmentMemoryIndexText = (
  newMessage: string,
  attachmentCount: number,
): string => newMessage || (attachmentCount > 0 ? '[attachment]' : '');
