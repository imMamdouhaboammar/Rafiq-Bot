import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { AttachmentRecord } from '../contracts/rafiqV6.js';
import {
  AttachmentRepository,
  type AttachmentMetadataStore,
} from '../services/attachmentRepository.js';
import type { OpfsAttachmentStore } from '../services/opfsAttachmentStore.js';

const metadata = new Map<string, AttachmentRecord>();
const metadataStore: AttachmentMetadataStore = {
  get: async id => metadata.get(id),
  put: async record => { metadata.set(record.id, structuredClone(record)); },
  delete: async id => { metadata.delete(id); },
  list: async () => Array.from(metadata.values()).map(record => structuredClone(record)),
};
const removedKeys: string[] = [];
const byteStore: Pick<OpfsAttachmentStore, 'save' | 'getBlob' | 'createObjectUrl' | 'remove'> = {
  save: async () => { throw new Error('not used'); },
  getBlob: async () => { throw new Error('not used'); },
  createObjectUrl: async () => { throw new Error('not used'); },
  remove: async key => { removedKeys.push(key); },
};
const repository = new AttachmentRepository(metadataStore, byteStore);
const now = new Date('2026-07-13T19:00:00.000Z');

for (const record of [
  {
    id: 'attachment-a',
    chatId: 'chat-a',
    messageId: 'message-a',
    fileName: 'photo.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 100,
    opfsKey: 'attachment-a.bin',
    availability: 'available',
    processingProgress: 1,
    thumbnailOpfsKey: 'attachment-a-thumb.bin',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'attachment-b',
    chatId: 'chat-a',
    messageId: 'message-a',
    fileName: 'voice.webm',
    mimeType: 'audio/webm',
    sizeBytes: 200,
    opfsKey: 'attachment-b.bin',
    availability: 'available',
    processingProgress: 1,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'attachment-c',
    chatId: 'chat-a',
    messageId: 'message-b',
    fileName: 'keep.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 300,
    opfsKey: 'attachment-c.bin',
    availability: 'available',
    processingProgress: 1,
    createdAt: now,
    updatedAt: now,
  },
] satisfies AttachmentRecord[]) {
  await metadataStore.put(record);
}

const removedCount = await repository.removeForMessage('message-a');
assert.equal(removedCount, 2);
assert.deepEqual(Array.from(metadata.keys()), ['attachment-c']);
assert.deepEqual(removedKeys.sort(), [
  'attachment-a-thumb.bin',
  'attachment-a.bin',
  'attachment-b.bin',
].sort());

const storeSource = await readFile(new URL('../stores/useRafiqStore.ts', import.meta.url), 'utf8');
assert.match(storeSource, /attachmentRepository\.removeForMessage\(messageId\)/);

console.log('Message attachment lifecycle tests passed.');
