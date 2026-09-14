import assert from 'node:assert/strict';
import {
  AsyncGenerationGuard,
  StaleGenerationError,
  isAbortLikeError,
} from '../services/asyncGenerationGuard.js';

const guard = new AsyncGenerationGuard();
const first = guard.begin();
assert.equal(first.generation, 0);
assert.equal(first.isCurrent(), true);
assert.equal(first.signal.aborted, false);

assert.equal(guard.advance('chat_changed'), 1);
assert.equal(first.isCurrent(), false);
assert.equal(first.signal.aborted, true);
assert.throws(() => first.throwIfStale(), StaleGenerationError);

const second = guard.begin();
assert.equal(second.generation, 1);
assert.equal(second.isCurrent(), true);
second.throwIfStale();

guard.cancel('component_unmounted');
assert.equal(second.isCurrent(), false);
assert.equal(second.signal.aborted, true);
assert.equal(isAbortLikeError(new StaleGenerationError()), true);
assert.equal(isAbortLikeError(new DOMException('Aborted', 'AbortError')), true);
assert.equal(isAbortLikeError(new Error('ordinary failure')), false);

console.log('Async generation guard tests passed.');
