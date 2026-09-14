import test from 'node:test';
import assert from 'node:assert/strict';
import { planReplyShape } from '../src/replyShapePlanner.ts';

test('keeps minimal presence micro and single-bubble', () => {
  const shape = planReplyShape('minimal_presence', { recentSameSpeakerBurst: 1, recentAssistantVerbosity: 'short', allowTopicShift: true, sensitivity: 'low' });
  assert.deepEqual(shape, { bubbleCount: 1, verbosity: 'micro', askQuestion: false, allowTopicShift: true, relationshipSignal: 'warm' });
});

test('allows practical help enough space without exceeding three bubbles', () => {
  const shape = planReplyShape('practical_help', { recentSameSpeakerBurst: 3, recentAssistantVerbosity: 'long', allowTopicShift: false, sensitivity: 'medium' });
  assert.equal(shape.verbosity, 'normal');
  assert.ok(shape.bubbleCount <= 3);
  assert.equal(shape.allowTopicShift, false);
});

test('teasing stays short and playful', () => {
  const shape = planReplyShape('tease', { recentSameSpeakerBurst: 2, recentAssistantVerbosity: 'short', allowTopicShift: true, sensitivity: 'low' });
  assert.equal(shape.verbosity, 'short');
  assert.equal(shape.relationshipSignal, 'playful');
});
