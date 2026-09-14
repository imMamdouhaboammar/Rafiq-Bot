import assert from 'node:assert/strict';
import {
  buildLocalAttachmentMetadata,
  createAttachmentDerivativePlan,
  sanitizeDerivedText,
} from '../services/attachmentDerivatives.js';
import {
  MAX_AUDIO_CHUNKS,
  MAX_DERIVED_TEXT_CHARS,
  MAX_VIDEO_KEYFRAMES,
} from '../services/largeFilePolicy.js';

const documentPlan = createAttachmentDerivativePlan({ category: 'document' });
assert.equal(documentPlan.extractText, true);
assert.equal(documentPlan.maxTextCharacters, MAX_DERIVED_TEXT_CHARS);
assert.deepEqual(documentPlan.videoKeyframeTimes, []);
assert.deepEqual(documentPlan.audioChunks, []);

const videoPlan = createAttachmentDerivativePlan({
  category: 'video',
  durationSeconds: 60 * 60,
});
assert.equal(videoPlan.extractText, false);
assert.equal(videoPlan.captureMetadata, true);
assert.equal(videoPlan.videoKeyframeTimes.length, MAX_VIDEO_KEYFRAMES);
assert.equal(videoPlan.videoKeyframeTimes.every(time => time > 0 && time < 3600), true);

const audioPlan = createAttachmentDerivativePlan({
  category: 'audio',
  durationSeconds: 60 * 60,
});
assert.equal(audioPlan.audioChunks.length, MAX_AUDIO_CHUNKS);
assert.equal(audioPlan.audioChunks[0].startSeconds, 0);
assert.equal(audioPlan.audioChunks[0].durationSeconds, 30);
assert.equal(audioPlan.audioChunks.at(-1)?.startSeconds, (MAX_AUDIO_CHUNKS - 1) * 30);

assert.equal(sanitizeDerivedText('a\u0000b\r\nc', 4), 'ab\nc');
assert.equal(sanitizeDerivedText('x'.repeat(MAX_DERIVED_TEXT_CHARS + 10)).length, MAX_DERIVED_TEXT_CHARS);

const metadata = buildLocalAttachmentMetadata({
  name: 'n'.repeat(600),
  type: 'video/mp4',
  size: 500_000_000.9,
  lastModified: 12345,
  category: 'video',
});
assert.equal(metadata.name.length, 512);
assert.equal(metadata.type, 'video/mp4');
assert.equal(metadata.sizeBytes, 500_000_000);
assert.equal(metadata.lastModified, 12345);

console.log('Attachment derivative tests passed.');
