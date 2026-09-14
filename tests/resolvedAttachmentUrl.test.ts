import assert from 'node:assert/strict';
import {
  createLocalAttachmentReference,
  getLocalAttachmentId,
} from '../hooks/useResolvedAttachmentUrl.js';

assert.equal(createLocalAttachmentReference('attachment-1'), 'opfs://attachment-1');
assert.equal(getLocalAttachmentId('opfs://attachment-1'), 'attachment-1');
assert.equal(getLocalAttachmentId('https://example.com/image.png'), undefined);
assert.equal(getLocalAttachmentId('blob:local-preview'), undefined);
assert.equal(getLocalAttachmentId('opfs://'), undefined);
assert.throws(() => createLocalAttachmentReference('   '), /Attachment ID is required/);

console.log('Resolved attachment URL tests passed.');
