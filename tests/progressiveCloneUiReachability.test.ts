import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');
const modalSource = await readFile(new URL('../components/NewChatModal.tsx', import.meta.url), 'utf8');
const chatSource = await readFile(new URL('../components/ChatInterface.tsx', import.meta.url), 'utf8');
const statusSource = await readFile(new URL('../components/CloneAnalysisStatus.tsx', import.meta.url), 'utf8');
const editorSource = await readFile(new URL('../components/CloneAnalysisEditor.tsx', import.meta.url), 'utf8');

assert.match(appSource, /startProgressiveCloneJob/);
assert.match(appSource, /continueProgressiveCloneJob/);
assert.match(appSource, /watchProgressiveClone\(handle\)/);
assert.match(modalSource, /onStartProgressiveClone\(importFileContent, importTargetName\)/);
assert.doesNotMatch(chatSource, /CloneAnalysisStatus/, 'analysis status must not occupy the message timeline');
assert.match(modalSource, /تحليل الاستنساخ/);
assert.match(modalSource, /cloneProfileDraft\?\.analysis\?\.status === 'ready'/);
assert.match(modalSource, /<CloneAnalysisEditor profile=\{cloneProfileDraft\} onChange=\{handleCloneProfileChange\}/);
assert.match(modalSource, /cloneProfile: savedCloneProfile/);
assert.match(modalSource, /botBio: savedCloneProfile\?\.analysis\?\.status === 'ready'/);
assert.match(modalSource, /memorySeeds: editableProfile\.memorySeeds/);
assert.match(modalSource, /التعديل هيتاح أول ما التحليل يكتمل/);

for (const requiredUiSignal of [
  'role="progressbar"',
  'aria-valuenow={completed}',
  'السيرة الملتقطة حتى الآن',
  'الخط الزمني والأماكن',
  'التون وطريقة الكلام',
  'مقاطع حقيقية من كلامه',
  '<blockquote',
  '<time',
]) {
  assert.ok(statusSource.includes(requiredUiSignal), `${requiredUiSignal} must remain visible in progressive clone status UI`);
}

for (const requiredEditorSignal of [
  'السيرة بصوت الشخصية',
  'التون وطريقة الكلام',
  'الذكريات المزروعة',
  'الخط الزمني والأماكن',
  'مقاطع وجمل كاملة من كلامه',
  'إضافة ذكرى',
  'إضافة حدث',
  'إضافة رسالة كاملة',
  'aria-label={`حذف الذكرى ${index + 1}`}',
  'aria-label={`حذف الحدث ${index + 1}`}',
  'aria-label={`حذف المقطع ${index + 1}`}',
  'min-h-11',
  'focus-visible:ring-2',
]) {
  assert.ok(editorSource.includes(requiredEditorSignal), `${requiredEditorSignal} must remain reachable in the clone analysis editor`);
}

console.log('Progressive clone UI reachability tests passed.');
