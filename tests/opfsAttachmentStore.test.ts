import assert from 'node:assert/strict';
import {
  AttachmentQuotaError,
  ATTACHMENT_WRITE_CHUNK_BYTES,
  OpfsAttachmentStore,
  assertAttachmentQuota,
  type AttachmentStorageBackend,
  type AttachmentWriter,
} from '../services/opfsAttachmentStore.js';
import { sha256Hex } from '../services/incrementalSha256.js';

class MemoryAttachmentBackend implements AttachmentStorageBackend {
  readonly files = new Map<string, Uint8Array>();
  estimateValue = { usage: 0, quota: 10_000_000 };
  persistenceGranted = true;

  async getSize(key: string): Promise<number> {
    return this.files.get(key)?.byteLength || 0;
  }

  async openWriter(
    key: string,
    options: { keepExistingData: boolean; start: number },
  ): Promise<AttachmentWriter> {
    const original = this.files.get(key)?.slice() || new Uint8Array();
    let working = options.keepExistingData ? original.slice() : new Uint8Array();
    let position = options.start;
    let finished = false;

    return {
      write: async chunk => {
        if (finished) throw new Error('writer closed');
        const required = position + chunk.byteLength;
        if (working.byteLength < required) {
          const expanded = new Uint8Array(required);
          expanded.set(working);
          working = expanded;
        }
        working.set(chunk, position);
        position += chunk.byteLength;
      },
      close: async () => {
        if (finished) return;
        finished = true;
        this.files.set(key, working.slice(0, position));
      },
      abort: async () => {
        if (finished) return;
        finished = true;
        if (original.byteLength > 0) this.files.set(key, original);
        else this.files.delete(key);
      },
    };
  }

  async read(key: string): Promise<ReadableStream<Uint8Array>> {
    return new Blob([this.files.get(key) || new Uint8Array()]).stream();
  }

  async getBlob(key: string): Promise<Blob> {
    return new Blob([this.files.get(key) || new Uint8Array()]);
  }

  async remove(key: string): Promise<void> {
    this.files.delete(key);
  }

  async estimate() {
    return this.estimateValue;
  }

  async requestPersistence(): Promise<boolean> {
    return this.persistenceGranted;
  }
}

assert.doesNotThrow(() => assertAttachmentQuota({ usage: 100, quota: 1000 }, 500));
assert.throws(
  () => assertAttachmentQuota({ usage: 650, quota: 1000 }, 100),
  AttachmentQuotaError,
);
assert.doesNotThrow(() => assertAttachmentQuota({}, 500_000_000));

const backend = new MemoryAttachmentBackend();
const store = new OpfsAttachmentStore(backend);
const bytes = new Uint8Array(256_000);
for (let index = 0; index < bytes.length; index++) bytes[index] = index % 251;
const blob = new Blob([bytes], { type: 'application/octet-stream' });
const progress: number[] = [];

const saved = await store.save({
  key: 'attachment-1.bin',
  blob,
  onProgress: update => progress.push(update.ratio),
});
assert.equal(saved.sizeBytes, bytes.length);
assert.equal(saved.sha256, sha256Hex(bytes));
assert.equal(saved.resumedFromBytes, 0);
assert.equal(saved.persistentStorageGranted, true);
assert.equal(progress.at(-1), 1);

const storedBlob = await store.getBlob('attachment-1.bin');
assert.equal(storedBlob.size, bytes.length);
assert.deepEqual(new Uint8Array(await storedBlob.arrayBuffer()), bytes);
await assert.rejects(
  store.getBlob('../escape'),
  /unsupported characters/,
);

const controller = new AbortController();
let abortedAt = 0;
const abortProgress: number[] = [];
await assert.rejects(
  store.save({
    key: 'attachment-resume.bin',
    blob,
    signal: controller.signal,
    onProgress: update => {
      abortProgress.push(update.writtenBytes);
      if (update.ratio >= 0.25 && !controller.signal.aborted) {
        abortedAt = update.writtenBytes;
        controller.abort();
      }
    },
  }),
  error => error instanceof DOMException && error.name === 'AbortError',
);
const partialSize = await backend.getSize('attachment-resume.bin');
assert.equal(partialSize, abortedAt);
assert.equal(partialSize, ATTACHMENT_WRITE_CHUNK_BYTES);
assert.ok(partialSize > 0 && partialSize < bytes.length);
assert.equal(
  abortProgress.every((written, index) => (
    written - (abortProgress[index - 1] || 0) <= ATTACHMENT_WRITE_CHUNK_BYTES
  )),
  true,
);

const resumed = await store.save({
  key: 'attachment-resume.bin',
  blob,
  resume: true,
});
assert.equal(resumed.resumedFromBytes, partialSize);
assert.equal(resumed.sizeBytes, bytes.length);
assert.equal(resumed.sha256, sha256Hex(bytes));
assert.deepEqual(backend.files.get('attachment-resume.bin'), bytes);

const preAbortedController = new AbortController();
preAbortedController.abort();
await assert.rejects(
  store.save({ key: 'pre-aborted.bin', blob, signal: preAbortedController.signal }),
  error => error instanceof DOMException && error.name === 'AbortError',
);
assert.equal(await backend.getSize('pre-aborted.bin'), 0);

backend.estimateValue = { usage: 690, quota: 1000 };
await assert.rejects(
  store.save({ key: 'quota.bin', blob: new Blob([new Uint8Array(20)]) }),
  AttachmentQuotaError,
);

await store.remove('attachment-1.bin');
assert.equal(await backend.getSize('attachment-1.bin'), 0);
await assert.rejects(
  store.save({ key: '../escape', blob }),
  /unsupported characters/,
);

console.log('OPFS attachment store tests passed.');
