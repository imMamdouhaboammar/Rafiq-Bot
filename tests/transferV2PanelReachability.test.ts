import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const toolsSource = await readFile(new URL('../components/PwaToolsTab.tsx', import.meta.url), 'utf8');
const panelSource = await readFile(new URL('../components/TransferV2Panel.tsx', import.meta.url), 'utf8');

assert.match(toolsSource, /import TransferV2Panel from ['"]\.\/TransferV2Panel\.js['"]/);
assert.match(toolsSource, /<TransferV2Panel\s*\/>/);
assert.doesNotMatch(toolsSource, /exportLocalBackup|importLocalBackup|version:\s*5/);

for (const operation of [
  'serializeStandardTransferV2',
  'exportEncryptedFullTextBackup',
  'detectTransferFileKind',
  'importRuntimeTransfer',
]) {
  assert.ok(panelSource.includes(operation), `${operation} must remain reachable from the active transfer panel`);
}
assert.match(panelSource, /new AbortController\(\)/);
assert.match(panelSource, /onProgress/);
assert.match(panelSource, /12/);

console.log('Transfer v2 panel reachability tests passed.');
