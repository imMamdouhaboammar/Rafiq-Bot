import assert from 'node:assert/strict';
import {
  MAX_RENDERED_MESSAGES,
  createInitialMessageWindow,
  followLatestMessages,
  getWindowedMessages,
  loadOlderMessagePage,
} from '../services/messageWindow.js';

const messages = Array.from({ length: 10_000 }, (_, index) => ({ id: `message-${index}` }));
let window = createInitialMessageWindow(messages.length);
assert.equal(window.startIndex, 9_920);
assert.equal(window.endIndex, 10_000);
assert.equal(getWindowedMessages(messages, window).length, 80);
assert.equal(window.hasOlder, true);

window = loadOlderMessagePage(window, messages.length);
assert.equal(getWindowedMessages(messages, window).length, 160);
window = loadOlderMessagePage(window, messages.length);
assert.equal(getWindowedMessages(messages, window).length, MAX_RENDERED_MESSAGES);
window = loadOlderMessagePage(window, messages.length);
assert.equal(getWindowedMessages(messages, window).length, MAX_RENDERED_MESSAGES);
assert.equal(window.startIndex, 9_680, 'rendered records must remain bounded while paging older');
assert.equal(window.hasOlder, true);
assert.equal(window.hasNewer, true);

const followed = followLatestMessages(window, 10_000, 10_001);
assert.equal(followed.endIndex, 9_920);
assert.equal(followed.endIndex - followed.startIndex, MAX_RENDERED_MESSAGES);
assert.equal(followed.hasNewer, true);

const pausedWindow = {
  startIndex: 100,
  endIndex: 200,
  hasOlder: true,
  hasNewer: true,
};
const pausedAfterNewMessage = followLatestMessages(pausedWindow, 10_000, 10_001);
assert.equal(pausedAfterNewMessage.endIndex, 200);
assert.equal(pausedAfterNewMessage.hasNewer, true);

assert.deepEqual(createInitialMessageWindow(0), {
  startIndex: 0,
  endIndex: 0,
  hasOlder: false,
  hasNewer: false,
});

console.log('Message window tests passed.');
