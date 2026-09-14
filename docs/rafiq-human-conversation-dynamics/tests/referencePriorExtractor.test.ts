import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveHumanConversationPrior } from '../src/referencePriorExtractor.ts';

const events = [
  { speakerId: 'a', timestampMs: 0, contentKind: 'text', textLength: 4, hasQuoteReply: false, hasCodeSwitch: false },
  { speakerId: 'a', timestampMs: 5_000, contentKind: 'text', textLength: 8, hasQuoteReply: true, hasCodeSwitch: true },
  { speakerId: 'b', timestampMs: 10_000, contentKind: 'sticker', textLength: 0, hasQuoteReply: false, hasCodeSwitch: false },
  { speakerId: 'a', timestampMs: 20_000, contentKind: 'voice', textLength: 0, hasQuoteReply: false, hasCodeSwitch: false },
] as const;

test('derives aggregate rhythm without returning raw transcript content', () => {
  const prior = deriveHumanConversationPrior(events);

  assert.equal(prior.totalEvents, 4);
  assert.equal(prior.shortTextRatio, 1);
  assert.equal(prior.quoteReplyRatio, 0.25);
  assert.equal(prior.codeSwitchRatio, 0.25);
  assert.equal(prior.burstMedian, 1);
  assert.ok(prior.contentKindRatios.text > 0);
  assert.equal('rawMessages' in prior, false);
  assert.equal(JSON.stringify(prior).includes('private text'), false);
});

test('returns a conservative empty prior for no events', () => {
  const prior = deriveHumanConversationPrior([]);
  assert.equal(prior.totalEvents, 0);
  assert.equal(prior.shortTextRatio, 0);
  assert.equal(prior.burstMedian, 1);
});
