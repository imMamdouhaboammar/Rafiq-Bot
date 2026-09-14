import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const controllerSource = await readFile(new URL('../hooks/useChatController.ts', import.meta.url), 'utf8');
const bubbleSource = await readFile(new URL('../components/ChatBubble.tsx', import.meta.url), 'utf8');

for (const operation of [
  'stageComposerAttachment',
  'finalizeComposerAttachments',
  'releaseComposerAttachments',
  'prepareAttachmentsForAi',
]) {
  assert.ok(controllerSource.includes(operation), `${operation} must be used by the active composer`);
}

assert.doesNotMatch(
  controllerSource,
  /fileToGenAIInlineData\(file\)/,
  'the active composer must not persist selected files as Base64',
);
assert.match(controllerSource, /StagedComposerAttachment\[\]/);
assert.match(controllerSource, /persistentAttachments/);
assert.doesNotMatch(
  controllerSource,
  /combinedPrompt,\s*\[\],\s*true/,
  'the active chat stream must not replace selected attachments with an empty provider payload',
);
assert.match(
  controllerSource,
  /combinedPrompt,\s*preparedAttachments\.attachments,\s*true/,
  'the active chat stream must pass the transiently prepared attachments to the provider',
);
assert.match(
  controllerSource,
  /describeSkippedAiAttachments\(preparedAttachments\.skipped\)/,
  'only skipped attachments should produce a truthful metadata notice',
);
assert.match(
  controllerSource,
  /prepareAttachmentsForAi\(burstAttachments,\s*\{\s*chatId: currentChat\.id,\s*signal: lease\.signal/,
  'AI attachment reads must be scoped to the active chat and cancelled with the response lease',
);
assert.match(
  controllerSource,
  /const unsentAttachments = stagedAttachmentsRef\.current;[\s\S]*?stagedAttachmentsRef\.current = \[\];[\s\S]*?releaseComposerAttachments\(unsentAttachments\);[\s\S]*?attachmentRepository\.remove\(attachment\.attachmentId\)/,
  'chat changes and unmounts must revoke and remove completed unsent attachments',
);
assert.match(
  controllerSource,
  /stagedAttachmentsRef\.current = \[\];\s*releaseComposerAttachments\(stagedAttachments\);/,
  'sent attachments must leave the staged cleanup refs before their previews are released',
);
assert.match(bubbleSource, /ResolvedAttachmentImage/);
assert.match(bubbleSource, /ResolvedAttachmentAudio/);

console.log('Active OPFS attachment reachability tests passed.');
