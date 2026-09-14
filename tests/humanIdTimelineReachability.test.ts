import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const profileSource = await readFile(new URL('../components/UserProfileModal.tsx', import.meta.url), 'utf8');
const timelineSource = await readFile(new URL('../components/HumanIdTimeline.tsx', import.meta.url), 'utf8');

assert.match(profileSource, /import HumanIdTimeline from ['"]\.\/HumanIdTimeline\.js['"]/);
assert.match(profileSource, /activeTab === 'timeline'/);
assert.match(profileSource, /<HumanIdTimeline\s*\/>/);

for (const requiredAction of [
  'storyRepository.listLifeEvents()',
  'storyRepository.createLifeEvent',
  'storyRepository.updateLifeEvent',
  'storyRepository.deleteLifeEvent',
]) {
  assert.ok(timelineSource.includes(requiredAction), `${requiredAction} must remain reachable from the shipped Human ID timeline`);
}

console.log('Human ID timeline reachability tests passed.');
