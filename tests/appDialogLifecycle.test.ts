import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../components/AppDialog.tsx', import.meta.url), 'utf8');

assert.match(source, /const \[locallyDismissed, setLocallyDismissed\] = useState\(false\)/);
assert.match(source, /setLocallyDismissed\(true\);\s*onConfirm\(\)/s);
assert.match(source, /setLocallyDismissed\(true\);\s*onCancel\(\)/s);
assert.match(source, /setLocallyDismissed\(false\)/);
assert.match(source, /open=\{open && !locallyDismissed\}/);

console.log('App dialog lifecycle contract passed.');
