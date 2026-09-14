import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');
const shellSource = await readFile(new URL('../components/ResponsiveWhatsAppShell.tsx', import.meta.url), 'utf8');

assert.match(appSource, /import ResponsiveWhatsAppShell from ['"]\.\/components\/ResponsiveWhatsAppShell\.js['"]/);
assert.match(appSource, /<ResponsiveWhatsAppShell/);
assert.doesNotMatch(appSource, /if\s*\(isMobile\)/, 'App must not maintain separate mobile and desktop render trees');
assert.doesNotMatch(appSource, /useState\(false\).*isMobile|const \[isMobile, setIsMobile\]/s);
assert.equal((appSource.match(/<ToastHost\s*\/>/g) || []).length, 1, 'global toast host must be mounted once');
assert.equal((appSource.match(/<AppDialog/g) || []).length, 1, 'global dialog must be mounted once');
assert.match(shellSource, /data-layout=/);
assert.match(shellSource, /useVisualViewportLayout/);

console.log('Responsive shell reachability tests passed.');
