import assert from 'node:assert/strict';
import {
  DEFAULT_PRESET_DOCK_STATE,
  movePresetDockByKeyboard,
  normalizePresetDockState,
  parsePresetDockState,
  serializePresetDockState,
  snapPresetDockToEdge,
} from '../services/presetDockState.js';

const viewport = {
  width: 390,
  height: 844,
  headerHeight: 64,
  composerHeight: 96,
  dockHeight: 180,
  edgePadding: 12,
};

assert.deepEqual(normalizePresetDockState({
  visible: true,
  collapsed: false,
  anchor: 'right',
  offsetY: -100,
}, viewport), {
  visible: true,
  collapsed: false,
  anchor: 'right',
  offsetY: 76,
});

const bottom = normalizePresetDockState({
  visible: true,
  collapsed: false,
  anchor: 'right',
  offsetY: 9999,
}, viewport);
assert.equal(bottom.offsetY, 556, 'dock must stay above the composer');

const snappedLeft = snapPresetDockToEdge({
  pointerX: 20,
  pointerY: 300,
  viewport,
  current: DEFAULT_PRESET_DOCK_STATE,
});
assert.equal(snappedLeft.anchor, 'left');
assert.equal(snappedLeft.offsetY, 210);

const snappedRight = snapPresetDockToEdge({
  pointerX: 370,
  pointerY: 800,
  viewport,
  current: DEFAULT_PRESET_DOCK_STATE,
});
assert.equal(snappedRight.anchor, 'right');
assert.equal(snappedRight.offsetY, 556);

assert.equal(
  movePresetDockByKeyboard(snappedLeft, 'ArrowRight', viewport).anchor,
  'right',
);
assert.equal(
  movePresetDockByKeyboard(snappedLeft, 'ArrowUp', viewport).offsetY,
  194,
);

const serialized = serializePresetDockState({
  visible: false,
  collapsed: true,
  anchor: 'left',
  offsetY: 123.7,
});
assert.deepEqual(parsePresetDockState(serialized), {
  visible: false,
  collapsed: true,
  anchor: 'left',
  offsetY: 124,
});
assert.deepEqual(parsePresetDockState('{invalid'), DEFAULT_PRESET_DOCK_STATE);
assert.deepEqual(parsePresetDockState(null), DEFAULT_PRESET_DOCK_STATE);

console.log('Preset dock state tests passed.');
