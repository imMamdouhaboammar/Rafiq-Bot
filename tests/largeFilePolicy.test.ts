import assert from 'node:assert/strict';
import {
  MAX_LOCAL_ATTACHMENT_BYTES,
  assertFileFitsStorageHeadroom,
  calculateStorageHeadroom,
  validateLocalAttachmentCount,
  validateLocalAttachmentFile,
} from '../services/largeFilePolicy.js';

assert.doesNotThrow(() => validateLocalAttachmentFile({
  name: 'video-500mb.mp4',
  size: 500 * 1024 * 1024,
  type: 'video/mp4',
}));
assert.doesNotThrow(() => validateLocalAttachmentFile({
  name: 'near-limit.bin',
  size: MAX_LOCAL_ATTACHMENT_BYTES,
  type: 'application/octet-stream',
}));
assert.throws(() => validateLocalAttachmentFile({
  name: 'too-large.bin',
  size: MAX_LOCAL_ATTACHMENT_BYTES + 1,
  type: 'application/octet-stream',
}), /2GB/);
assert.throws(() => validateLocalAttachmentFile({ name: '', size: 1, type: '' }), /اسم الملف/);
assert.throws(() => validateLocalAttachmentFile({ name: 'empty.txt', size: 0, type: 'text/plain' }), /فارغ/);

assert.doesNotThrow(() => validateLocalAttachmentCount(9, 1));
assert.throws(() => validateLocalAttachmentCount(9, 2), /10 ملفات/);
assert.throws(() => validateLocalAttachmentCount(-1, 1), /غير صالح/);

assert.deepEqual(calculateStorageHeadroom({}), {
  known: false,
  softLimitBytes: undefined,
  availableBeforeSoftLimit: undefined,
});
const headroom = calculateStorageHeadroom({ usage: 200, quota: 1000 });
assert.equal(headroom.known, true);
assert.equal(headroom.softLimitBytes, 700);
assert.equal(headroom.availableBeforeSoftLimit, 500);
assert.doesNotThrow(() => assertFileFitsStorageHeadroom(500, { usage: 200, quota: 1000 }));
assert.throws(
  () => assertFileFitsStorageHeadroom(501, { usage: 200, quota: 1000 }),
  /حد الأمان 70%/,
);

console.log('Large file policy tests passed.');
