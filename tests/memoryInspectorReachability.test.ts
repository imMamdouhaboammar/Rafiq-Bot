import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const toolsSource = await readFile(new URL('../components/PwaToolsTab.tsx', import.meta.url), 'utf8');
const inspectorSource = await readFile(new URL('../components/MemoryInspector.tsx', import.meta.url), 'utf8');

assert.match(toolsSource, /import MemoryInspector from ['"]\.\/MemoryInspector\.js['"]/);
assert.match(toolsSource, /<MemoryInspector\s*\/>/);

for (const requiredOperation of [
  'memoryRepository.list',
  'memoryRepository.forgetEverywhere',
]) {
  assert.ok(
    inspectorSource.includes(requiredOperation),
    `${requiredOperation} must remain reachable from the shipped Memory Inspector`,
  );
}

assert.match(inspectorSource, /status: 'active'/);
assert.match(inspectorSource, /text: search\.trim\(\)/);

console.log('Memory Inspector reachability tests passed.');
