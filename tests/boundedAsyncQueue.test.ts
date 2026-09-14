import assert from 'node:assert/strict';
import { BoundedAsyncQueue } from '../services/boundedAsyncQueue.js';

const completed: string[] = [];
let releaseFirst: (() => void) | undefined;
const firstGate = new Promise<void>(resolve => { releaseFirst = resolve; });
const errors: string[] = [];
const queue = new BoundedAsyncQueue({
  maxPending: 2,
  onError: (_error, key) => errors.push(key),
});

assert.equal(queue.enqueue('first', async () => {
  await firstGate;
  completed.push('first');
}), true);
assert.equal(queue.enqueue('second', async () => { completed.push('second'); }), true);
assert.equal(queue.enqueue('second', async () => { completed.push('duplicate'); }), false);
assert.equal(queue.enqueue('third', async () => { completed.push('third'); }), true);
assert.equal(queue.enqueue('overflow', async () => { completed.push('overflow'); }), false);
assert.equal(queue.pendingCount, 2);
assert.equal(queue.cancel('second'), true);
assert.equal(queue.pendingCount, 1);

releaseFirst?.();
await new Promise(resolve => setTimeout(resolve, 0));
await new Promise(resolve => setTimeout(resolve, 0));
assert.deepEqual(completed, ['first', 'third']);
assert.deepEqual(errors, []);

const failingQueue = new BoundedAsyncQueue({
  maxPending: 1,
  onError: (_error, key) => errors.push(key),
});
failingQueue.enqueue('failure', async () => { throw new Error('expected'); });
await new Promise(resolve => setTimeout(resolve, 0));
assert.deepEqual(errors, ['failure']);

assert.throws(() => new BoundedAsyncQueue({ maxPending: 0 }), /positive integer/);
console.log('Bounded async queue tests passed.');
