import assert from 'node:assert/strict';
import type { AttachmentRepository, LocalAttachmentFile } from '../services/attachmentRepository.js';
import {
  finalizeComposerAttachments,
  releaseComposerAttachments,
  stageComposerAttachment,
} from '../services/attachmentComposer.js';

const attached: Array<{ id: string; messageId: string }> = [];
const revoked: string[] = [];
const repository: Pick<AttachmentRepository, 'saveLocalFile' | 'createObjectUrl' | 'attachToMessage'> = {
  saveLocalFile: async input => ({
    id: 'attachment-1',
    chatId: input.chatId,
    fileName: input.file.name,
    mimeType: input.file.type,
    sizeBytes: input.file.size,
    sha256: 'a'.repeat(64),
    opfsKey: 'attachment-1.bin',
    availability: 'available',
    processingProgress: 1,
    createdAt: new Date('2026-07-13T12:00:00.000Z'),
    updatedAt: new Date('2026-07-13T12:00:00.000Z'),
  }),
  createObjectUrl: async id => ({
    url: `blob:${id}`,
    revoke: () => revoked.push(id),
  }),
  attachToMessage: async (id, messageId) => {
    attached.push({ id, messageId });
    return {
      id,
      chatId: 'chat-a',
      messageId,
      fileName: 'video.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 500 * 1024 * 1024,
      opfsKey: `${id}.bin`,
      availability: 'available',
      processingProgress: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },
};

const blob = new Blob([new Uint8Array(500)], { type: 'video/mp4' }) as LocalAttachmentFile;
Object.defineProperty(blob, 'name', { value: 'video.mp4', enumerable: true });
const staged = await stageComposerAttachment({
  chatId: 'chat-a',
  file: blob,
  currentCount: 0,
  repository,
});

assert.equal(staged.attachmentId, 'attachment-1');
assert.equal(staged.draft.previewUrl, 'blob:attachment-1');
assert.equal(staged.persistent.previewUrl, 'opfs://attachment-1');
assert.equal(staged.persistent.base64, undefined);
assert.equal(staged.persistent.file, undefined);
assert.equal(staged.persistent.mimeType, 'video/mp4');

const persistent = await finalizeComposerAttachments({
  staged: [staged],
  messageId: 'message-1',
  repository,
});
assert.deepEqual(attached, [{ id: 'attachment-1', messageId: 'message-1' }]);
assert.equal(persistent[0].previewUrl, 'opfs://attachment-1');
assert.equal(persistent[0].base64, undefined);

releaseComposerAttachments([staged]);
assert.deepEqual(revoked, ['attachment-1']);

await assert.rejects(
  stageComposerAttachment({
    chatId: 'chat-a',
    file: blob,
    currentCount: 10,
    repository,
  }),
  /10 ملفات/,
);

console.log('Attachment composer tests passed.');
