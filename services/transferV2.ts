import {
  RafiqTransferV2Schema,
  type AttachmentRecord,
  type BotStoryEvent,
  type LifeStoryEvent,
  type MemoryRecord,
  type RafiqTransferV2,
} from '../contracts/rafiqV6.js';
import { sha256Hex } from './incrementalSha256.js';

export class TransferValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransferValidationError';
  }
}

export interface TransferV2Source {
  appVersion: string;
  chats: unknown[];
  messages: unknown[];
  lifeStoryEvents: LifeStoryEvent[];
  botStoryEvents: BotStoryEvent[];
  memories: MemoryRecord[];
  attachments: AttachmentRecord[];
}

export interface TransferV2Options {
  includePrivateStory?: boolean;
  includeSensitiveMemory?: boolean;
  encrypted?: boolean;
  createdAt?: Date;
}

const canonicalize = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
};

export const canonicalJson = (value: unknown): string => (
  JSON.stringify(canonicalize(value))
);

export const checksumTransferSection = (value: unknown): string => (
  sha256Hex(canonicalJson(value))
);

const stripBinaryAttachmentFields = (attachment: unknown): unknown => {
  if (!attachment || typeof attachment !== 'object') return attachment;
  const source = attachment as Record<string, unknown>;
  const {
    file: _file,
    base64: _base64,
    previewUrl: _previewUrl,
    data: _data,
    bytes: _bytes,
    blob: _blob,
    extractedText: _extractedText,
    derivedText: _derivedText,
    ...metadata
  } = source;
  return {
    ...metadata,
    previewUrl: '',
    availability: source.availability === 'missing' ? 'missing' : 'local-only',
  };
};

const sanitizeMessage = (message: unknown): unknown => {
  if (!message || typeof message !== 'object') return message;
  const source = message as Record<string, unknown>;
  return {
    ...source,
    attachments: Array.isArray(source.attachments)
      ? source.attachments.map(stripBinaryAttachmentFields)
      : source.attachments,
  };
};

const exportAttachmentMetadata = (record: AttachmentRecord) => {
  const { opfsKey: _opfsKey, derivedText: _derivedText, ...metadata } = record;
  return {
    ...metadata,
    availability: record.availability === 'missing' ? 'missing' as const : 'local-only' as const,
    processingProgress: 0,
  };
};

const createChecksums = (sections: Omit<RafiqTransferV2, 'manifest'>) => ({
  chats: checksumTransferSection(sections.chats),
  messages: checksumTransferSection(sections.messages),
  lifeStoryEvents: checksumTransferSection(sections.lifeStoryEvents),
  botStoryEvents: checksumTransferSection(sections.botStoryEvents),
  memories: checksumTransferSection(sections.memories),
  attachments: checksumTransferSection(sections.attachments),
});

export const buildRafiqTransferV2 = (
  source: TransferV2Source,
  options: TransferV2Options = {},
): RafiqTransferV2 => {
  const lifeStoryEvents = source.lifeStoryEvents.filter(event => (
    options.includePrivateStory || event.acl.visibility !== 'private'
  ));
  const memories = source.memories.filter(memory => (
    options.includeSensitiveMemory ||
    (memory.sensitivity !== 'sensitive' && memory.sensitivity !== 'private')
  ));
  const sections: Omit<RafiqTransferV2, 'manifest'> = {
    chats: source.chats.map(chat => structuredClone(chat)),
    messages: source.messages.map(sanitizeMessage),
    lifeStoryEvents,
    botStoryEvents: source.botStoryEvents,
    memories,
    attachments: source.attachments.map(exportAttachmentMetadata),
  };
  const checksums = createChecksums(sections);

  return RafiqTransferV2Schema.parse({
    manifest: {
      format: 'rafiq-transfer',
      version: 2,
      createdAt: options.createdAt || new Date(),
      appVersion: source.appVersion,
      encrypted: options.encrypted || false,
      includesPrivateStory: options.includePrivateStory || false,
      includesSensitiveMemory: options.includeSensitiveMemory || false,
      includesBinaryMedia: false,
      checksums,
      counts: {
        chats: sections.chats.length,
        messages: sections.messages.length,
        lifeStoryEvents: sections.lifeStoryEvents.length,
        botStoryEvents: sections.botStoryEvents.length,
        memories: sections.memories.length,
        attachments: sections.attachments.length,
      },
    },
    ...sections,
  });
};

export const validateRafiqTransferV2 = (value: unknown): RafiqTransferV2 => {
  const parsed = RafiqTransferV2Schema.safeParse(value);
  if (!parsed.success) {
    throw new TransferValidationError(
      `Transfer v2 schema validation failed: ${parsed.error.issues[0]?.message || 'unknown error'}`,
    );
  }

  const transfer = parsed.data;
  const sections: Omit<RafiqTransferV2, 'manifest'> = {
    chats: transfer.chats,
    messages: transfer.messages,
    lifeStoryEvents: transfer.lifeStoryEvents,
    botStoryEvents: transfer.botStoryEvents,
    memories: transfer.memories,
    attachments: transfer.attachments,
  };
  const expectedCounts = {
    chats: sections.chats.length,
    messages: sections.messages.length,
    lifeStoryEvents: sections.lifeStoryEvents.length,
    botStoryEvents: sections.botStoryEvents.length,
    memories: sections.memories.length,
    attachments: sections.attachments.length,
  };
  for (const [key, expected] of Object.entries(expectedCounts)) {
    const actual = transfer.manifest.counts[key as keyof typeof expectedCounts];
    if (actual !== expected) {
      throw new TransferValidationError(
        `Transfer count mismatch for ${key}. Expected ${expected}, manifest reports ${actual}.`,
      );
    }
  }

  const expectedChecksums = createChecksums(sections);
  for (const [section, expected] of Object.entries(expectedChecksums)) {
    const actual = transfer.manifest.checksums[section];
    if (actual !== expected) {
      throw new TransferValidationError(`Checksum mismatch for transfer section ${section}.`);
    }
  }

  return transfer;
};

export const serializeRafiqTransferV2 = (transfer: RafiqTransferV2): string => (
  canonicalJson(validateRafiqTransferV2(transfer))
);

export const parseRafiqTransferV2 = (text: string): RafiqTransferV2 => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new TransferValidationError('Transfer file is not valid JSON.');
  }
  return validateRafiqTransferV2(parsed);
};
