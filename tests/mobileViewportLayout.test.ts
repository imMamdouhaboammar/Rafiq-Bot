import assert from 'node:assert/strict';
import {
  calculateMobileViewportLayout,
  shouldUseSinglePaneChatLayout,
} from '../services/mobileViewportLayout.js';

assert.deepEqual(calculateMobileViewportLayout({
  layoutHeight: 844,
  viewportHeight: 844,
  viewportOffsetTop: 0,
  safeAreaBottom: 34,
}), {
  visibleHeight: 844,
  keyboardInset: 0,
  composerBottom: 34,
  contentHeight: 810,
});

assert.deepEqual(calculateMobileViewportLayout({
  layoutHeight: 844,
  viewportHeight: 500,
  viewportOffsetTop: 0,
  safeAreaBottom: 34,
}), {
  visibleHeight: 500,
  keyboardInset: 310,
  composerBottom: 344,
  contentHeight: 466,
});

assert.deepEqual(calculateMobileViewportLayout({
  layoutHeight: 844,
  viewportHeight: 500,
  viewportOffsetTop: 44,
  safeAreaBottom: 34,
}), {
  visibleHeight: 500,
  keyboardInset: 266,
  composerBottom: 300,
  contentHeight: 466,
});

assert.equal(shouldUseSinglePaneChatLayout(320), true);
assert.equal(shouldUseSinglePaneChatLayout(430), true);
assert.equal(shouldUseSinglePaneChatLayout(767), true);
assert.equal(shouldUseSinglePaneChatLayout(768), false);
assert.equal(shouldUseSinglePaneChatLayout(1200), false);

console.log('Mobile viewport layout tests passed.');
