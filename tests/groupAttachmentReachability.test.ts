import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const groupControllerSource = await readFile(new URL('../hooks/useGroupController.ts', import.meta.url), 'utf8');
const chatInterfaceSource = await readFile(new URL('../components/ChatInterface.tsx', import.meta.url), 'utf8');
const dbSource = await readFile(new URL('../services/db.ts', import.meta.url), 'utf8');

for (const required of [
  'stageComposerAttachment',
  'finalizeComposerAttachments',
  'cancelAttachmentUpload',
  'removeComposerAttachment',
  'handleFileDrop',
  'attachmentIds: sentAttachments.map',
]) {
  assert.ok(groupControllerSource.includes(required), `${required} must remain in the group attachment flow`);
}

assert.match(
  groupControllerSource,
  /attachments: persistentAttachments/,
  'A group message must persist its finalized attachments',
);
assert.match(
  chatInterfaceSource,
  /uploads=\{isGroup \? groupCtrl\.attachmentUploads : chatCtrl\.attachmentUploads\}/,
  'The composer tray must render group upload progress',
);
assert.match(
  chatInterfaceSource,
  /isGroup \? groupCtrl\.handleFile\(event\) : chatCtrl\.handleFile\(event\)/,
  'Each attachment picker must route group files to the group controller',
);
assert.match(
  chatInterfaceSource,
  /isGroup \? groupCtrl\.attachments\.length : chatCtrl\.attachments\.length/,
  'A group message with only files must expose the send action',
);
assert.match(
  dbSource,
  /message\.text \|\| attachmentPreview/,
  'A file-only group message must show a meaningful chat preview',
);

console.log('Group attachment reachability tests passed.');
