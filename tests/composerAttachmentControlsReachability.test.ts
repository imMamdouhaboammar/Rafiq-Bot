import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const controllerSource = await readFile(new URL('../hooks/useChatController.ts', import.meta.url), 'utf8');
const composerSource = await readFile(new URL('../services/attachmentComposer.ts', import.meta.url), 'utf8');
const traySource = await readFile(new URL('../components/ComposerAttachmentTray.tsx', import.meta.url), 'utf8');
const chatSource = await readFile(new URL('../components/ChatInterface.tsx', import.meta.url), 'utf8');
const overlaySource = await readFile(new URL('../components/ComposerAttachmentOverlayHost.tsx', import.meta.url), 'utf8');
const toastSource = await readFile(new URL('../components/ToastHost.tsx', import.meta.url), 'utf8');

for (const required of [
  'attachmentUploadControllersRef',
  'attachmentUploads',
  'cancelAttachmentUpload',
  'removeComposerAttachment',
  'onProgress',
  'attachmentRepository.remove',
]) {
  assert.ok(controllerSource.includes(required), `${required} must remain in the active composer controller`);
}

const addAttachmentBody = controllerSource.match(/const addAttachment = async[\s\S]*?\n  };\n\n  const addAttachments/)?.[0] || '';
const replaceUploadsBody = controllerSource.match(/const replaceAttachmentUploads =[\s\S]*?\n  };/)?.[0] || '';
assert.match(
  replaceUploadsBody,
  /const next = updater\(attachmentUploadsRef\.current\);[\s\S]*attachmentUploadsRef\.current = next;[\s\S]*setAttachmentUploads\(next\);/,
  'upload bookkeeping must update the ref synchronously before React state can defer rendering',
);
assert.doesNotMatch(
  replaceUploadsBody,
  /setAttachmentUploads\(current =>/,
  'upload bookkeeping must not depend on a deferred React state updater to refresh its ref',
);
assert.doesNotMatch(
  addAttachmentBody,
  /generationGuardRef\.current\.begin\(\)/,
  'file uploads must not cancel or supersede bot generation',
);
assert.match(composerSource, /attachmentId\?: string/);
assert.match(composerSource, /attachmentId,/);
assert.match(toastSource, /import ComposerAttachmentOverlayHost from ['"]\.\/ComposerAttachmentOverlayHost\.js['"]/);
assert.match(toastSource, /<ComposerAttachmentOverlayHost\s*\/>/);
assert.match(overlaySource, /<ComposerAttachmentTray/);
assert.match(traySource, /aria-label="إلغاء رفع الملف"/);
assert.match(traySource, /aria-label="إزالة المرفق"/);
assert.match(traySource, /progress/);
assert.doesNotMatch(
  chatSource,
  /\.docx|\.xlsx|application\/msword|wordprocessingml|spreadsheetml/,
  'the AI document chooser must not advertise unsupported Office binaries',
);
assert.match(chatSource, /image\/png,image\/jpeg,image\/webp,image\/heic,image\/heif/);

console.log('Composer attachment controls reachability tests passed.');
