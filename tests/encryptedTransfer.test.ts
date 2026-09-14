import assert from 'node:assert/strict';
import {
  decryptTextualTransfer,
  encryptTextualTransfer,
  parseEncryptedTransfer,
  serializeEncryptedTransfer,
} from '../services/encryptedTransfer.js';

const plaintext = JSON.stringify({
  privateStory: 'تفصيل خاص لا يجب ظهوره كنص واضح',
  memories: ['memory-a', 'memory-b'],
});
const passphrase = 'correct horse battery staple';
const envelope = await encryptTextualTransfer(plaintext, passphrase, {
  iterations: 100_000,
  createdAt: new Date('2026-07-13T12:00:00.000Z'),
  salt: new Uint8Array(Array.from({ length: 16 }, (_, index) => index + 1)),
  iv: new Uint8Array(Array.from({ length: 12 }, (_, index) => index + 20)),
});

assert.equal(envelope.format, 'rafiq-encrypted-transfer');
assert.equal(envelope.algorithm, 'AES-GCM');
assert.equal(envelope.keyDerivation, 'PBKDF2-SHA-256');
assert.equal(envelope.iterations, 100_000);
assert.equal(envelope.createdAt, '2026-07-13T12:00:00.000Z');
const serialized = serializeEncryptedTransfer(envelope);
assert.doesNotMatch(serialized, /تفصيل خاص/);
assert.doesNotMatch(serialized, /memory-a/);
assert.equal(await decryptTextualTransfer(parseEncryptedTransfer(serialized), passphrase), plaintext);

await assert.rejects(
  decryptTextualTransfer(envelope, 'incorrect passphrase value'),
  /Unable to decrypt/,
);

const tampered = { ...envelope, ciphertext: `${envelope.ciphertext.slice(0, -2)}AA` };
await assert.rejects(
  decryptTextualTransfer(tampered, passphrase),
  /Unable to decrypt/,
);

await assert.rejects(
  encryptTextualTransfer('payload', 'too-short'),
  /at least 12 characters/,
);
await assert.rejects(
  encryptTextualTransfer('payload', passphrase, { iterations: 99_999 }),
  /between 100000 and 2000000/,
);
assert.throws(() => parseEncryptedTransfer('{invalid'), /not valid JSON/);
assert.throws(() => parseEncryptedTransfer('{}'), /invalid structure/);

console.log('Encrypted transfer tests passed.');
