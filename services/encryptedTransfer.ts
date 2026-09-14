import { z } from 'zod';

const EncryptedTransferEnvelopeSchema = z.object({
  format: z.literal('rafiq-encrypted-transfer'),
  version: z.literal(1),
  algorithm: z.literal('AES-GCM'),
  keyDerivation: z.literal('PBKDF2-SHA-256'),
  iterations: z.number().int().min(100_000).max(2_000_000),
  salt: z.string().min(1),
  iv: z.string().min(1),
  ciphertext: z.string().min(1),
  createdAt: z.string().datetime(),
});

export type EncryptedTransferEnvelope = z.infer<typeof EncryptedTransferEnvelopeSchema>;

export class EncryptedTransferError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptedTransferError';
  }
}

const DEFAULT_ITERATIONS = 310_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    throw new EncryptedTransferError('Encrypted transfer contains invalid base64 data.');
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const getCrypto = (): Crypto => {
  if (!globalThis.crypto?.subtle) {
    throw new EncryptedTransferError('Web Crypto is unavailable in this environment.');
  }
  return globalThis.crypto;
};

const validatePassphrase = (passphrase: string): string => {
  const normalized = passphrase.normalize('NFKC');
  if (normalized.length < 12) {
    throw new EncryptedTransferError('Backup passphrase must contain at least 12 characters.');
  }
  return normalized;
};

const deriveKey = async (
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> => {
  const crypto = getCrypto();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(validatePassphrase(passphrase)),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations,
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
};

export const encryptTextualTransfer = async (
  plaintext: string,
  passphrase: string,
  options: {
    iterations?: number;
    createdAt?: Date;
    salt?: Uint8Array;
    iv?: Uint8Array;
  } = {},
): Promise<EncryptedTransferEnvelope> => {
  const crypto = getCrypto();
  const iterations = options.iterations || DEFAULT_ITERATIONS;
  if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 2_000_000) {
    throw new EncryptedTransferError('PBKDF2 iterations must be between 100000 and 2000000.');
  }
  const salt = options.salt || crypto.getRandomValues(new Uint8Array(16));
  const iv = options.iv || crypto.getRandomValues(new Uint8Array(12));
  if (salt.byteLength < 16) throw new EncryptedTransferError('Encryption salt must contain at least 16 bytes.');
  if (iv.byteLength !== 12) throw new EncryptedTransferError('AES-GCM IV must contain exactly 12 bytes.');

  const key = await deriveKey(passphrase, salt, iterations);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext),
  );

  return EncryptedTransferEnvelopeSchema.parse({
    format: 'rafiq-encrypted-transfer',
    version: 1,
    algorithm: 'AES-GCM',
    keyDerivation: 'PBKDF2-SHA-256',
    iterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    createdAt: (options.createdAt || new Date()).toISOString(),
  });
};

export const decryptTextualTransfer = async (
  envelopeInput: unknown,
  passphrase: string,
): Promise<string> => {
  const parsed = EncryptedTransferEnvelopeSchema.safeParse(envelopeInput);
  if (!parsed.success) {
    throw new EncryptedTransferError(
      `Encrypted transfer validation failed: ${parsed.error.issues[0]?.message || 'unknown error'}`,
    );
  }
  const envelope = parsed.data;
  const salt = base64ToBytes(envelope.salt);
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  if (iv.byteLength !== 12) throw new EncryptedTransferError('Encrypted transfer IV has an invalid length.');

  try {
    const key = await deriveKey(passphrase, salt, envelope.iterations);
    const plaintext = await getCrypto().subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    );
    return decoder.decode(plaintext);
  } catch (error) {
    if (error instanceof EncryptedTransferError) throw error;
    throw new EncryptedTransferError('Unable to decrypt the backup. The passphrase or file may be incorrect.');
  }
};

export const serializeEncryptedTransfer = (envelope: EncryptedTransferEnvelope): string => (
  JSON.stringify(EncryptedTransferEnvelopeSchema.parse(envelope))
);

export const parseEncryptedTransfer = (text: string): EncryptedTransferEnvelope => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new EncryptedTransferError('Encrypted transfer file is not valid JSON.');
  }
  const parsed = EncryptedTransferEnvelopeSchema.safeParse(value);
  if (!parsed.success) throw new EncryptedTransferError('Encrypted transfer file has an invalid structure.');
  return parsed.data;
};
