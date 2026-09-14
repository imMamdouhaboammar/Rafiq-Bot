import assert from 'node:assert/strict';
import { BoundedLru } from '../services/boundedLru.js';

const cache = new BoundedLru<string, number>({ maxEntries: 2 });

cache.set('a', 1);
cache.set('b', 2);
assert.equal(cache.size, 2);

assert.equal(cache.get('a'), 1, 'reading an entry should refresh its recency');
cache.set('c', 3);

assert.equal(cache.has('a'), true, 'recently read entry should remain');
assert.equal(cache.has('b'), false, 'least recently used entry should be evicted');
assert.equal(cache.get('c'), 3);
assert.equal(cache.size, 2);

assert.throws(
  () => new BoundedLru({ maxEntries: 0 }),
  /positive integer/,
  'invalid limits must fail fast',
);

console.log('Bounded LRU tests passed.');
