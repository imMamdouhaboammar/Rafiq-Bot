import assert from 'node:assert/strict';
import {
  calculateSceneTimestamps,
  extractVideoScenes,
  formatDuration,
  optimizeImageForAi,
} from '../services/mediaOptimizer.js';

// 1. Duration Formatting Tests
assert.equal(formatDuration(0), '00:00');
assert.equal(formatDuration(5), '00:05');
assert.equal(formatDuration(65), '01:05');
assert.equal(formatDuration(3600), '60:00');
assert.equal(formatDuration(-1), '00:00');

// 2. Video Scene Timestamps Calculation Tests
const shortVideoScenes = calculateSceneTimestamps(15, 5);
assert.equal(shortVideoScenes.length, 1);
assert.ok(shortVideoScenes[0] > 0 && shortVideoScenes[0] <= 15);

const mediumVideoScenes = calculateSceneTimestamps(120, 5);
assert.equal(mediumVideoScenes.length, 5);
assert.ok(mediumVideoScenes[0] < mediumVideoScenes[1]);
assert.ok(mediumVideoScenes[4] <= 120);

const longVideoScenes = calculateSceneTimestamps(3600, 6);
assert.equal(longVideoScenes.length, 6);
assert.ok(longVideoScenes[0] > 0);
assert.ok(longVideoScenes[longVideoScenes.length - 1] < 3600);

// 3. Fallback Image Optimization in Node Environment
const sampleBlob = new Blob([Buffer.from('fake-image-bytes')], { type: 'image/jpeg' });
const optResult = await optimizeImageForAi(sampleBlob);
assert.equal(optResult.mimeType, 'image/jpeg');
assert.ok(optResult.data.length > 0);
assert.equal(optResult.rawBytes, Buffer.from('fake-image-bytes').length);

// 4. Fallback Video Scene Extraction in Node Environment
const videoBlob = new Blob([Buffer.from('fake-video-bytes')], { type: 'video/mp4' });
const sceneResult = await extractVideoScenes(videoBlob);
assert.equal(sceneResult.totalScenes, 0);
assert.match(sceneResult.summaryContext, /VIDEO_SCENES_UNAVAILABLE/);

console.log('Media Optimizer tests passed successfully!');
