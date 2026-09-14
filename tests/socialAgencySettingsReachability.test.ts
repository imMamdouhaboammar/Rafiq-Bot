import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const toolsSource = await readFile(new URL('../components/PwaToolsTab.tsx', import.meta.url), 'utf8');
const panelSource = await readFile(new URL('../components/SocialAgencyControlsPanel.tsx', import.meta.url), 'utf8');
const settingsSource = await readFile(new URL('../components/SocialAgencySettings.tsx', import.meta.url), 'utf8');

assert.match(toolsSource, /import SocialAgencyControlsPanel from ['"]\.\/SocialAgencyControlsPanel\.js['"]/);
assert.match(toolsSource, /<SocialAgencyControlsPanel\s*\/>/);
assert.match(panelSource, /<SocialAgencySettings key=\{selectedBotId\} botId=\{selectedBotId\}\s*\/>/);

for (const requiredSetting of [
  'boldness',
  'proactivity',
  'unsolicitedDailyLimit',
  'cooldownHours',
  'quietHours',
]) {
  assert.ok(settingsSource.includes(requiredSetting), `${requiredSetting} must remain editable in the shipped controls`);
}

assert.ok(settingsSource.includes('socialAgencyRepository.save'));

console.log('Social agency settings reachability tests passed.');
