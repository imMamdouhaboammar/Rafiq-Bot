import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('App.tsx', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

assert.match(app, /shellDirection/, 'App shell must resolve direction dynamically');
assert.match(app, /document\.documentElement\.lang = shellLocale/, 'App must publish active locale to the document');
assert.match(app, /document\.documentElement\.dir = shellDirection/, 'App must publish active direction to the document');
assert.doesNotMatch(app, /h-\[100dvh\][^\n]+dir=\"rtl\"/, 'Top-level app shell must not force RTL');
assert.match(html, /<html lang=\"en\" dir=\"ltr\">/, 'Static shell must start from a neutral LTR default before runtime hydration');

console.log('Localization UI contract passed.');
