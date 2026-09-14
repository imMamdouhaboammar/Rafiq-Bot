import type { RafiqTransferV2 } from '../contracts/rafiqV6.js';
import { db } from './db.js';
import { v6Tables } from './v6Tables.js';
import {
  buildRafiqTransferV2,
  parseRafiqTransferV2,
  serializeRafiqTransferV2,
} from './transferV2.js';
import {
  decryptTextualTransfer,
  encryptTextualTransfer,
  parseEncryptedTransfer,
  serializeEncryptedTransfer,
} from './encryptedTransfer.js';
import { parseLegacyRafiqV1Text } from './legacyTransferAdapter.js';
import {
  TransactionalTransferImporter,
  type TransferImportProgress,
  type TransactionalTransferImportResult,
} from './transactionalTransferImport.js';
import { dexieTransactionalTransferStore } from './dexieTransferStore.js';

export type TransferFileKind = 'v2' | 'encrypted' | 'legacy-v1' | 'unknown';

export interface RuntimeTransferOptions {
  appVersion?: string;
  createdAt?: Date;
}

export const detectTransferFileKind = (value: unknown): TransferFileKind => {
  if (!value || typeof value !== 'object') return 'unknown';
  const record = value as Record<string, unknown>;
  const manifest = record.manifest && typeof record.manifest === 'object'
    ? record.manifest as Record<string, unknown>
    : undefined;
  if (manifest?.format === 'rafiq-transfer' && manifest.version === 2) return 'v2';
  if (record.format === 'rafiq-encrypted-transfer' && record.version === 1) return 'encrypted';
  if (record.format === 'rafiq-chat-export' && record.version === 1) return 'legacy-v1';
  return 'unknown';
};

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('الملف ليس JSON صالحًا');
  }
};

export const collectTransferSource = async (
  appVersion = '0.0.0',
) => {
  const [
    chats,
    directMessages,
    groupMessages,
    lifeStoryEvents,
    botStoryEvents,
    memories,
    attachments,
  ] = await Promise.all([
    db.chats.toArray(),
    db.messages.toArray(),
    db.groupMessages.toArray(),
    v6Tables.lifeStoryEvents().toArray(),
    v6Tables.botStoryEvents().toArray(),
    v6Tables.memoryRecords().toArray(),
    v6Tables.attachmentRecords().toArray(),
  ]);
  return {
    appVersion,
    chats,
    messages: [...directMessages, ...groupMessages],
    lifeStoryEvents,
    botStoryEvents,
    memories,
    attachments,
  };
};

export const exportStandardTransferV2 = async (
  options: RuntimeTransferOptions = {},
): Promise<RafiqTransferV2> => buildRafiqTransferV2(
  await collectTransferSource(options.appVersion),
  {
    createdAt: options.createdAt,
    includePrivateStory: false,
    includeSensitiveMemory: false,
    encrypted: false,
  },
);

export const exportEncryptedFullTextBackup = async (
  passphrase: string,
  options: RuntimeTransferOptions = {},
): Promise<string> => {
  const transfer = buildRafiqTransferV2(
    await collectTransferSource(options.appVersion),
    {
      createdAt: options.createdAt,
      includePrivateStory: true,
      includeSensitiveMemory: true,
      encrypted: true,
    },
  );
  const plaintext = serializeRafiqTransferV2(transfer);
  const envelope = await encryptTextualTransfer(plaintext, passphrase, {
    createdAt: options.createdAt,
  });
  return serializeEncryptedTransfer(envelope);
};

export const serializeStandardTransferV2 = async (
  options: RuntimeTransferOptions = {},
): Promise<string> => serializeRafiqTransferV2(
  await exportStandardTransferV2(options),
);

export const decodeRuntimeTransfer = async (
  text: string,
  options: {
    passphrase?: string;
    appVersion?: string;
    createdAt?: Date;
  } = {},
): Promise<RafiqTransferV2> => {
  const value = parseJson(text);
  const kind = detectTransferFileKind(value);

  if (kind === 'v2') return parseRafiqTransferV2(text);
  if (kind === 'legacy-v1') {
    return parseLegacyRafiqV1Text(text, {
      appVersion: options.appVersion || '0.0.0',
      createdAt: options.createdAt,
    });
  }
  if (kind === 'encrypted') {
    if (!options.passphrase) throw new Error('النسخة المشفرة تحتاج كلمة مرور');
    const plaintext = await decryptTextualTransfer(parseEncryptedTransfer(text), options.passphrase);
    return parseRafiqTransferV2(plaintext);
  }

  throw new Error('صيغة الملف غير مدعومة');
};

export const importRuntimeTransfer = async (
  text: string,
  options: {
    passphrase?: string;
    appVersion?: string;
    signal?: AbortSignal;
    onProgress?: (progress: TransferImportProgress) => void;
  } = {},
): Promise<TransactionalTransferImportResult> => {
  const transfer = await decodeRuntimeTransfer(text, options);
  const importer = new TransactionalTransferImporter(dexieTransactionalTransferStore);
  return importer.import(transfer, {
    signal: options.signal,
    onProgress: options.onProgress,
  });
};
