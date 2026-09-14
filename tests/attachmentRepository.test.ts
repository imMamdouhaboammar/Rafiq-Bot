import assert from 'node:assert/strict';
import type { AttachmentRecord } from '../contracts/rafiqV6.js';
import {
  AttachmentRepository,
  type AttachmentMetadataStore,
  type LocalAttachmentFile,
} from '../services/attachmentRepository.js';
import type {
  OpfsAttachmentStore,
  SavedAttachmentObject,
} from '../services/opfsAttachmentStore.js';

const metadata = new Map<string, AttachmentRecord>();
const metadataStore: AttachmentMetadataStore = {
  get: async id => metadata.get(id),
  put: async record => { metadata.set(record.id, structuredClone(record)); },
  delete: async id => { metadata.delete(id); },
  list: async () => Array.from(metadata.values()).map(record => structuredClone(record)),
};

const removedKeys: string[] = [];
const objectUrls = new Map<string, string>();
const blobReads: string[] = [];
let saveMode: 'success' | 'cancel' | 'failure' = 'success';
const byteStore: Pick<OpfsAttachmentStore, 'save' | 'getBlob' | 'createObjectUrl' | 'remove'> = {
  save: async options => {
    options.onProgress?.({ writtenBytes: 50, totalBytes: 100, ratio: 0.5 });
    if (saveMode === 'cancel') {
      throw new DOMException('cancelled', 'AbortError');
    }
    if (saveMode === 'failure') {
      throw new Error('disk write failed');
    }
    options.onProgress?.({ writtenBytes: 100, totalBytes: 100, ratio: 1 });
    return {
      key: options.key,
      sizeBytes: options.blob.size,
      sha256: 'a'.repeat(64),
      resumedFromBytes: options.resume ? 50 : 0,
      persistentStorageGranted: true,
    } satisfies SavedAttachmentObject;
  },
  getBlob: async key => {
    blobReads.push(key);
    return new Blob([new Uint8Array([1, 2, 3])], { type: 'application/octet-stream' });
  },
  createObjectUrl: async key => {
    const url = `blob:${key}`;
    objectUrls.set(key, url);
    let revoked = false;
    return {
      url,
      revoke: () => {
        if (revoked) return;
        revoked = true;
        objectUrls.delete(key);
      },
    };
  },
  remove: async key => {
    removedKeys.push(key);
    objectUrls.delete(key);
  },
};

let now = new Date('2026-07-13T12:00:00.000Z');
let idCounter = 0;
const repository = new AttachmentRepository(
  metadataStore,
  byteStore,
  () => new Date(now),
  () => `attachment-${++idCounter}`,
);

const makeFile = (name = 'video.mp4', type = 'video/mp4'): LocalAttachmentFile => {
  const blob = new Blob([new Uint8Array(100)], { type }) as LocalAttachmentFile;
  Object.defineProperty(blob, 'name', { value: name, enumerable: true });
  return blob;
};

const progress: number[] = [];
const saved = await repository.saveLocalFile({
  chatId: 'chat-a',
  file: makeFile(),
  onProgress: ratio => progress.push(ratio),
});
assert.equal(saved.id, 'attachment-1');
assert.equal(saved.availability, 'available');
assert.equal(saved.processingProgress, 1);
assert.equal(saved.sha256, 'a'.repeat(64));
assert.equal(saved.opfsKey, 'attachment-1.bin');
assert.deepEqual(progress, [0.5, 1]);
assert.equal((await repository.listForChat('chat-a')).length, 1);

const storedBlob = await repository.getBlob(saved.id, 'chat-a');
assert.deepEqual(new Uint8Array(await storedBlob.arrayBuffer()), new Uint8Array([1, 2, 3]));
assert.deepEqual(blobReads, ['attachment-1.bin']);
await assert.rejects(
  repository.getBlob('attachment-unknown', 'chat-a'),
  /record not found/,
);
await assert.rejects(
  repository.getBlob(saved.id, 'chat-b'),
  /does not belong to the expected chat/,
);
assert.deepEqual(blobReads, ['attachment-1.bin'], 'cross-chat reads must fail before OPFS access');

now = new Date('2026-07-13T13:00:00.000Z');
const attached = await repository.attachToMessage(saved.id, 'message-1');
assert.equal(attached.messageId, 'message-1');
assert.equal(attached.updatedAt.toISOString(), now.toISOString());

const objectUrl = await repository.createObjectUrl(saved.id);
assert.equal(objectUrl.url, 'blob:attachment-1.bin');
assert.equal(objectUrls.has('attachment-1.bin'), true);
objectUrl.revoke();
assert.equal(objectUrls.has('attachment-1.bin'), false);

const derived = await repository.updateDerivedData(saved.id, {
  derivedText: 'نص مشتق محدود',
  thumbnailOpfsKey: 'thumbnail-1.bin',
  codecError: undefined,
});
assert.equal(derived.derivedText, 'نص مشتق محدود');
assert.equal(derived.thumbnailOpfsKey, 'thumbnail-1.bin');

saveMode = 'cancel';
await assert.rejects(
  repository.saveLocalFile({
    chatId: 'chat-a',
    attachmentId: 'attachment-cancel',
    file: makeFile('large.bin', 'application/octet-stream'),
    resume: true,
  }),
  error => error instanceof DOMException && error.name === 'AbortError',
);
assert.equal(metadata.get('attachment-cancel')?.availability, 'processing');
assert.equal(metadata.get('attachment-cancel')?.codecError, undefined);

saveMode = 'failure';
await assert.rejects(
  repository.saveLocalFile({
    chatId: 'chat-a',
    attachmentId: 'attachment-failed',
    file: makeFile('broken.mov', 'video/quicktime'),
  }),
  /disk write failed/,
);
assert.equal(metadata.get('attachment-failed')?.availability, 'failed');
assert.equal(metadata.get('attachment-failed')?.codecError, 'disk write failed');

const imported = await repository.markImportedWithoutBinary({
  id: 'attachment-imported',
  chatId: 'chat-b',
  messageId: 'message-imported',
  fileName: 'local-only.mp4',
  mimeType: 'video/mp4',
  sizeBytes: 500_000_000,
  sha256: 'b'.repeat(64),
  processingProgress: 0,
  createdAt: now,
  updatedAt: now,
});
assert.equal(imported.availability, 'missing');
assert.equal(imported.opfsKey, 'missing-attachment-imported');
await assert.rejects(
  repository.createObjectUrl(imported.id),
  /not available on this device/,
);
await assert.rejects(
  repository.getBlob(imported.id, 'chat-b'),
  /not available on this device/,
);
assert.deepEqual(blobReads, ['attachment-1.bin']);

await repository.remove(saved.id);
assert.equal(metadata.has(saved.id), false);
assert.deepEqual(removedKeys, ['attachment-1.bin', 'thumbnail-1.bin']);

console.log('Attachment repository tests passed.');
