import test from 'node:test';
import assert from 'node:assert/strict';
import { compileDynamicsPrompt } from '../src/dynamicsPromptCompiler.ts';

test('compiles a compact behavioral instruction without exposing internal JSON/state names', () => {
  const prompt = compileDynamicsPrompt({
    move: 'callback',
    shape: { bubbleCount: 1, verbosity: 'short', askQuestion: true, allowTopicShift: false, relationshipSignal: 'warm' },
    callback: { candidateId: 'thread-1', kind: 'health', summary: 'check whether the earlier condition improved', score: 0.9 },
    safetyReasons: [],
  });
  assert.match(prompt, /follow up/i);
  assert.match(prompt, /do not assume/i);
  assert.equal(prompt.includes('candidateId'), false);
  assert.equal(prompt.includes('continuityState'), false);
  assert.equal(prompt.includes('{"'), false);
});

test('does not tell the model to force a callback when none is selected', () => {
  const prompt = compileDynamicsPrompt({
    move: 'acknowledge',
    shape: { bubbleCount: 1, verbosity: 'micro', askQuestion: false, allowTopicShift: true, relationshipSignal: 'none' },
    safetyReasons: [],
  });
  assert.equal(prompt.toLowerCase().includes('follow up on:'), false);
});
