import assert from 'node:assert/strict';
import {
  getNextStoryPosition,
  getPreviousStoryPosition,
} from '../services/storyNavigation.js';

const statuses = [
  { stories: ['a1', 'a2'] },
  { stories: ['b1', 'b2', 'b3'] },
];

assert.deepEqual(
  getNextStoryPosition(statuses, { statusIndex: 0, storyIndex: 0 }),
  { position: { statusIndex: 0, storyIndex: 1 }, reachedEnd: false },
);
assert.deepEqual(
  getNextStoryPosition(statuses, { statusIndex: 0, storyIndex: 1 }),
  { position: { statusIndex: 1, storyIndex: 0 }, reachedEnd: false },
);
assert.deepEqual(
  getNextStoryPosition(statuses, { statusIndex: 1, storyIndex: 2 }),
  { position: { statusIndex: 1, storyIndex: 2 }, reachedEnd: true },
);

assert.deepEqual(
  getPreviousStoryPosition(statuses, { statusIndex: 1, storyIndex: 2 }),
  { statusIndex: 1, storyIndex: 1 },
  'previous navigation must decrement the story index',
);
assert.deepEqual(
  getPreviousStoryPosition(statuses, { statusIndex: 1, storyIndex: 0 }),
  { statusIndex: 0, storyIndex: 1 },
  'moving to a previous status should open its final story',
);
assert.deepEqual(
  getPreviousStoryPosition(statuses, { statusIndex: 0, storyIndex: 0 }),
  { statusIndex: 0, storyIndex: 0 },
);

console.log('Story navigation tests passed.');
