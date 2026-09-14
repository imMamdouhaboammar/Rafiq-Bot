import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const triggerSource = await readFile(new URL('../components/FloatingTriggerButton.tsx', import.meta.url), 'utf8');
const dockSource = await readFile(new URL('../components/PresetRepliesDock.tsx', import.meta.url), 'utf8');

assert.match(triggerSource, /import PresetRepliesDock from ['"]\.\/PresetRepliesDock\.js['"]/);
assert.match(triggerSource, /<PresetRepliesDock/);
assert.match(triggerSource, /prompts\.filter\(prompt => prompt\.enabled\)/);
assert.match(triggerSource, /onTrigger\(activeChatId, text\)/);

console.log('Preset replies dock reachability tests passed.');

