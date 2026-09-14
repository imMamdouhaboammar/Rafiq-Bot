import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const toolsSource = await readFile(new URL('../components/PwaToolsTab.tsx', import.meta.url), 'utf8');
const panelSource = await readFile(new URL('../components/BotStoryPanel.tsx', import.meta.url), 'utf8');

assert.match(toolsSource, /import BotStoryPanel from ['"]\.\/BotStoryPanel\.js['"]/);
assert.match(toolsSource, /<BotStoryPanel\s*\/>/);

for (const requiredOperation of [
  'storyRepository.listBotEvents',
  'storyRepository.correctBotEvent',
  'storyRepository.deleteBotEvent',
  'setActiveChatId',
  'scrollIntoView',
]) {
  assert.ok(
    panelSource.includes(requiredOperation),
    `${requiredOperation} must remain reachable from the shipped bot story controls`,
  );
}

console.log('Bot story panel reachability tests passed.');
