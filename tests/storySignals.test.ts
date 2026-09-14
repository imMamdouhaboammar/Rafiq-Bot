import assert from 'node:assert/strict';
import type { StorySignal } from '../contracts/rafiqV6.js';
import {
  MAX_STORY_SIGNAL_PROMPT_CHARS,
  MAX_STORY_SIGNALS_PER_PROMPT,
  selectStorySignals,
} from '../services/storySignals.js';

const now = new Date('2026-07-13T12:00:00.000Z');
const makeSignal = (overrides: Partial<StorySignal>): StorySignal => ({
  id: overrides.id ?? crypto.randomUUID(),
  eventId: overrides.eventId ?? 'event-1',
  text: overrides.text ?? 'إشارة مختصرة',
  salience: overrides.salience ?? 0.5,
  sensitivity: overrides.sensitivity ?? 'normal',
  acl: overrides.acl ?? { visibility: 'all_bots', botIds: [] },
  createdAt: overrides.createdAt ?? now,
  expiresAt: overrides.expiresAt,
});

const result = selectStorySignals([
  makeSignal({ id: 'all', text: 'يحب التحضير المبكر قبل الاجتماعات', salience: 0.9 }),
  makeSignal({ id: 'selected', text: 'يفضل الأسئلة المباشرة', salience: 0.8, acl: { visibility: 'selected_bots', botIds: ['bot-a'] } }),
  makeSignal({ id: 'other', text: 'لا يجب أن يراها هذا البوت', salience: 1, acl: { visibility: 'selected_bots', botIds: ['bot-b'] } }),
  makeSignal({ id: 'private', text: 'تفصيل خاص', salience: 1, acl: { visibility: 'private', botIds: [] }, sensitivity: 'private' }),
  makeSignal({ id: 'third', text: 'يقدر الردود المختصرة', salience: 0.7 }),
  makeSignal({ id: 'fourth', text: 'إشارة رابعة لا تدخل', salience: 0.6 }),
], 'bot-a', { now });

assert.equal(result.signals.length, MAX_STORY_SIGNALS_PER_PROMPT);
assert.deepEqual(result.signals.map(signal => signal.id), ['all', 'selected', 'third']);
assert.ok(result.characterCount <= MAX_STORY_SIGNAL_PROMPT_CHARS);
assert.match(result.promptText ?? '', /لا تقتبس المصدر/);
assert.doesNotMatch(result.promptText ?? '', /تفصيل خاص/);
assert.doesNotMatch(result.promptText ?? '', /event-1/);

const longResult = selectStorySignals([
  makeSignal({ id: 'long', text: 'أ'.repeat(1000), salience: 1 }),
], 'bot-a');
assert.ok(longResult.characterCount <= MAX_STORY_SIGNAL_PROMPT_CHARS);
assert.equal(longResult.signals[0].text.endsWith('…'), true);

console.log('Story signal tests passed.');
