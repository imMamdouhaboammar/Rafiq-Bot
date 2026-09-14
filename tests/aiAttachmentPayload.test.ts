import assert from 'node:assert/strict';
import type { Attachment } from '../types.js';
import {
  describeSkippedAiAttachments,
  MAX_AI_ATTACHMENTS,
  MAX_AI_INLINE_RAW_BYTES,
  prepareAttachmentsForAi,
} from '../services/aiAttachmentPayload.js';

const encode = async (blob: Blob): Promise<string> => (
  Buffer.from(await blob.arrayBuffer()).toString('base64')
);
const blobs = new Map<string, Blob>();
const reads: Array<{ id: string; chatId: string }> = [];
const repository = {
  getBlob: async (id: string, chatId: string): Promise<Blob> => {
    reads.push({ id, chatId });
    const blob = blobs.get(id);
    if (!blob) throw new Error('Attachment bytes are not available on this device.');
    return blob;
  },
};
const localAttachment = (id: string, input: Partial<Attachment> & Pick<Attachment, 'mimeType'>): Attachment => ({
  previewUrl: `opfs://${id}`,
  fileName: id,
  ...input,
});

blobs.set('pixel.png', new Blob([Uint8Array.from([137, 80, 78, 71])], { type: 'image/png' }));
blobs.set('brief.pdf', new Blob([Uint8Array.from([37, 80, 68, 70])], { type: 'application/pdf' }));
blobs.set('notes.md', new Blob(['# Hello'], { type: 'text/markdown' }));

const originals = [
  localAttachment('pixel.png', { mimeType: 'image/png', category: 'image' }),
  localAttachment('brief.pdf', { mimeType: 'application/pdf', category: 'document' }),
  localAttachment('notes.md', { mimeType: 'text/markdown', category: 'code' }),
];
const snapshot = structuredClone(originals);
const prepared = await prepareAttachmentsForAi(originals, { chatId: 'chat-a', repository, blobToBase64: encode });
assert.equal(prepared.skipped.length, 0);
assert.deepEqual(prepared.attachments.map(item => item.mimeType), ['image/png', 'application/pdf', 'text/markdown']);
assert.deepEqual(prepared.attachments.map(item => Buffer.from(item.data, 'base64').toString('utf8')), ['�PNG', '%PDF', '# Hello']);
assert.deepEqual(originals, snapshot, 'transient preparation must not mutate persistent attachment metadata');
assert.equal(originals.some(item => Boolean(item.base64)), false);
assert.deepEqual(reads.slice(0, 3), [
  { id: 'pixel.png', chatId: 'chat-a' },
  { id: 'brief.pdf', chatId: 'chat-a' },
  { id: 'notes.md', chatId: 'chat-a' },
]);

const legacy: Attachment = {
  previewUrl: '',
  mimeType: 'image/png',
  fileName: 'legacy.png',
  category: 'image',
  base64: Buffer.from('legacy-image').toString('base64'),
};
const legacyPrepared = await prepareAttachmentsForAi([legacy], {
  chatId: 'chat-a',
  repository: { getBlob: async () => { throw new Error('must not read OPFS for legacy data'); } },
  blobToBase64: encode,
});
assert.equal(Buffer.from(legacyPrepared.attachments[0].data, 'base64').toString(), 'legacy-image');

const unsupported = await prepareAttachmentsForAi([
  localAttachment('report.docx', {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    category: 'document',
  }),
], { chatId: 'chat-a', repository, blobToBase64: encode });
assert.equal(unsupported.attachments.length, 0);
assert.equal(unsupported.skipped[0].reason, 'unsupported_type');
assert.match(describeSkippedAiAttachments(unsupported.skipped), /report\.docx/);

const missing = await prepareAttachmentsForAi([
  localAttachment('missing.png', { mimeType: 'image/png', category: 'image' }),
], { chatId: 'chat-a', repository, blobToBase64: encode });
assert.equal(missing.skipped[0].reason, 'missing_local_bytes');

const countInput = Array.from({ length: MAX_AI_ATTACHMENTS + 1 }, (_, index) => ({
  ...legacy,
  fileName: `legacy-${index}.png`,
}));
const countPrepared = await prepareAttachmentsForAi(countInput, { chatId: 'chat-a', repository, blobToBase64: encode });
assert.equal(countPrepared.attachments.length, MAX_AI_ATTACHMENTS);
assert.equal(countPrepared.skipped[0].reason, 'attachment_count_limit');

const budgetPrepared = await prepareAttachmentsForAi([
  { ...legacy, fileName: 'first.png', base64: Buffer.from('1234').toString('base64') },
  { ...legacy, fileName: 'second.png', base64: Buffer.from('56').toString('base64') },
], { chatId: 'chat-a', repository, blobToBase64: encode, maxTotalRawBytes: 5 });
assert.equal(budgetPrepared.attachments.length, 1);
assert.equal(budgetPrepared.skipped[0].reason, 'inline_budget_exceeded');

blobs.set('generic.pdf', new Blob([Uint8Array.from([37, 80, 68, 70])], { type: 'application/octet-stream' }));
blobs.set('empty-mime.pdf', new Blob([Uint8Array.from([37, 80, 68, 70])], { type: '' }));
blobs.set('generic-notes.md', new Blob(['generic markdown'], { type: 'application/octet-stream' }));
const genericPdf = await prepareAttachmentsForAi([
  localAttachment('generic.pdf', { mimeType: 'application/octet-stream', category: 'document' }),
  localAttachment('empty-mime.pdf', { mimeType: '', category: 'document' }),
  localAttachment('generic-notes.md', { mimeType: 'application/octet-stream', category: 'code' }),
], { chatId: 'chat-pdf', repository, blobToBase64: encode });
assert.equal(genericPdf.attachments[0].mimeType, 'application/pdf');
assert.equal(genericPdf.attachments[1].mimeType, 'application/pdf');
assert.equal(genericPdf.attachments[2].mimeType, 'text/plain');
assert.deepEqual(reads.at(-1), { id: 'generic-notes.md', chatId: 'chat-pdf' });

const rejectedImages = await prepareAttachmentsForAi([
  { ...legacy, fileName: 'vector.svg', mimeType: 'image/svg+xml' },
  { ...legacy, fileName: 'animation.gif', mimeType: 'image/gif' },
], { chatId: 'chat-a', repository, blobToBase64: encode });
assert.deepEqual(rejectedImages.skipped.map(item => item.reason), ['unsupported_type', 'unsupported_type']);

const paddingOnly = await prepareAttachmentsForAi([
  { ...legacy, fileName: 'empty.png', base64: '==' },
  { ...legacy, fileName: 'zero-byte.png', base64: '' },
], { chatId: 'chat-a', repository, blobToBase64: encode });
assert.equal(paddingOnly.attachments.length, 0);
assert.deepEqual(paddingOnly.skipped.map(item => item.reason), ['invalid_base64', 'invalid_base64']);

const nanCount = await prepareAttachmentsForAi(countInput, {
  chatId: 'chat-a',
  repository,
  blobToBase64: encode,
  maxAttachments: Number.NaN,
});
assert.equal(nanCount.attachments.length, MAX_AI_ATTACHMENTS);
assert.equal(nanCount.skipped[0].reason, 'attachment_count_limit');

blobs.set('over-budget.png', new Blob([new Uint8Array(MAX_AI_INLINE_RAW_BYTES + 1)], { type: 'image/png' }));
const nanBudget = await prepareAttachmentsForAi([
  localAttachment('over-budget.png', { mimeType: 'image/png', category: 'image' }),
], {
  chatId: 'chat-a',
  repository,
  blobToBase64: async () => { throw new Error('budget must be checked before encoding'); },
  maxTotalRawBytes: Number.NaN,
});
assert.equal(nanBudget.attachments.length, 0);
assert.equal(nanBudget.skipped[0].reason, 'inline_budget_exceeded');

console.log('AI attachment payload tests passed.');
