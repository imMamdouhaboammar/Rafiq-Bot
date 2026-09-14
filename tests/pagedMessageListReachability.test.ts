import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const chatSource = await readFile(new URL('../components/ChatInterface.tsx', import.meta.url), 'utf8');
const listSource = await readFile(new URL('../components/PagedMessageList.tsx', import.meta.url), 'utf8');

assert.match(chatSource, /import PagedMessageList from ['"]\.\/PagedMessageList\.js['"]/);
assert.match(chatSource, /<PagedMessageList/);
assert.doesNotMatch(
  chatSource,
  /messages\.filter\([\s\S]*?\.map\(msg\s*=>/,
  'the active chat must not mount every message directly',
);
assert.match(chatSource, /footer=/);
assert.match(listSource, /footer\?: React\.ReactNode/);
assert.match(listSource, /\{footer\}/);
assert.match(listSource, /loadOlderMessagePage/);
assert.match(listSource, /IntersectionObserver/);

console.log('Paged message list reachability tests passed.');
