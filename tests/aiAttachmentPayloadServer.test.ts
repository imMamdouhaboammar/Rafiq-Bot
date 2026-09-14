import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  AiAttachmentValidationError,
  ATTACHMENT_TEXT_TRUNCATION_MARKER,
  buildAttachmentMemoryIndexText,
  buildBoundedAttachmentText,
  MAX_SERVER_AI_ATTACHMENTS,
  MAX_SERVER_AI_ATTACHMENT_BYTES,
  normalizeServerAiAttachments,
} from '../services/aiAttachmentPayload.server.js';

const base64 = (value: string | Uint8Array): string => Buffer.from(value).toString('base64');
const attachment = (mimeType: string, value: string | Uint8Array, fileName?: string) => ({
  mimeType,
  data: base64(value),
  fileName,
});

const normalized = normalizeServerAiAttachments([
  { ...attachment(' IMAGE/PNG ', Uint8Array.from([137, 80, 78, 71]), ' pixel.png '), fileSize: 999 },
  attachment('application/pdf', '%PDF', 'brief.pdf'),
  { ...attachment('text/markdown', '# Hello', 'notes.md'), category: 'code' },
]);
assert.deepEqual(normalized.map(item => item.mimeType), ['image/png', 'application/pdf', 'text/markdown']);
assert.equal(normalized[0].fileName, 'pixel.png');
assert.equal(normalized[0].fileSize, 4, 'decoded bytes must override untrusted client metadata');

for (const invalid of [
  { mimeType: 'image/png', data: '' },
  { mimeType: 'image/png', data: 'YQ' },
  { mimeType: 'image/png', data: 'Y Q==' },
  { mimeType: 'image/png', data: 'data:image/png;base64,YQ==' },
  { mimeType: 'application/x-executable', data: 'YQ==' },
  { mimeType: 'application/octet-stream', data: 'YQ==' },
  { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: 'YQ==' },
  { mimeType: 'image/png', data: 'YQ==', fileName: 'bad\nname.png' },
  { mimeType: 'image/png', data: 'YQ==', fileName: 'x'.repeat(513) },
  { mimeType: `text/${'x'.repeat(251)}`, data: 'YQ==' },
  { mimeType: 'image/png', data: 'YQ==', category: 'not-a-category' },
  { mimeType: 'image/png', data: 'YQ==', fileSize: -1 },
]) {
  assert.throws(
    () => normalizeServerAiAttachments([invalid]),
    AiAttachmentValidationError,
  );
}
assert.throws(
  () => normalizeServerAiAttachments(Array.from(
    { length: MAX_SERVER_AI_ATTACHMENTS + 1 },
    () => attachment('image/png', Uint8Array.from([1])),
  )),
  /maximum of 5/i,
);
const oversizedData = Buffer.alloc(MAX_SERVER_AI_ATTACHMENT_BYTES + 4, 120);
assert.throws(
  () => normalizeServerAiAttachments([
    { mimeType: 'image/png', data: oversizedData.toString('base64') },
  ]),
  /exceed/i,
);

const rawText = '0123456789SECRET';
const boundedText = buildBoundedAttachmentText(
  normalizeServerAiAttachments([attachment('text/plain', rawText, 'notes.txt')]),
  10,
);
assert.match(boundedText || '', /0123456789/);
assert.doesNotMatch(boundedText || '', /SECRET/);
assert.ok(boundedText?.includes(ATTACHMENT_TEXT_TRUNCATION_MARKER));
assert.doesNotMatch(
  buildBoundedAttachmentText(
    normalizeServerAiAttachments([attachment('text/plain', 'exactly-ten', 'exact.txt')]),
    11,
  ) || '',
  /ATTACHMENT_TEXT_TRUNCATED/,
  'an exact character-budget fit must not be labeled as truncated',
);

assert.equal(buildAttachmentMemoryIndexText('summarize this', 1), 'summarize this');
assert.equal(buildAttachmentMemoryIndexText('', 1), '[attachment]');
assert.equal(buildAttachmentMemoryIndexText('', 0), '');

const geminiSource = await readFile(new URL('../services/geminiService.server.ts', import.meta.url), 'utf8');
assert.equal(
  geminiSource.match(/attachments = normalizeServerAiAttachments\(attachments\);/g)?.length,
  2,
  'streaming and non-streaming entry points must share server attachment validation',
);
assert.doesNotMatch(
  geminiSource,
  /role: 'user', text: finalUserText/,
  'decoded attachment text must never be written to semantic memory',
);

console.log('Server AI attachment payload tests passed.');
