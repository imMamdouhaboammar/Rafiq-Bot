import assert from 'node:assert/strict';
import { IncrementalSha256, sha256Hex } from '../services/incrementalSha256.js';

assert.equal(
  sha256Hex(''),
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
);
assert.equal(
  sha256Hex('abc'),
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
);
assert.equal(
  sha256Hex('The quick brown fox jumps over the lazy dog'),
  'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592',
);

const streaming = new IncrementalSha256();
streaming.update('The quick ');
streaming.update(new TextEncoder().encode('brown fox '));
streaming.update('jumps over the lazy dog');
assert.equal(
  streaming.hexDigest(),
  'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592',
);
assert.equal(streaming.hexDigest(), streaming.hexDigest(), 'digest should be stable after finalization');
assert.throws(() => streaming.update('late data'), /already been finalized/);

const millionAs = new IncrementalSha256();
const chunk = new TextEncoder().encode('a'.repeat(1000));
for (let index = 0; index < 1000; index++) millionAs.update(chunk);
assert.equal(
  millionAs.hexDigest(),
  'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
);

console.log('Incremental SHA-256 tests passed.');
