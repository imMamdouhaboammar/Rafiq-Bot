import assert from 'node:assert/strict';
import { normalizeLifeStoryDraft } from '../services/lifeStoryForm.js';

const selected = normalizeLifeStoryDraft({
  title: '  بدأت شغلي الجديد  ',
  summary: '  انتقلت لفريق جديد وبدأت مسؤوليات مختلفة  ',
  happenedAt: '2026-07-01',
  visibility: 'selected_bots',
  selectedBotIds: ['bot-1', 'bot-1', '', 'bot-2'],
  sensitivity: 'sensitive',
});

assert.equal(selected.title, 'بدأت شغلي الجديد');
assert.equal(selected.summary, 'انتقلت لفريق جديد وبدأت مسؤوليات مختلفة');
assert.equal(selected.happenedAt.toISOString(), '2026-07-01T12:00:00.000Z');
assert.deepEqual(selected.acl, {
  visibility: 'selected_bots',
  botIds: ['bot-1', 'bot-2'],
});
assert.equal(selected.sensitivity, 'sensitive');

const privateEvent = normalizeLifeStoryDraft({
  title: 'حدث خاص',
  summary: 'تفاصيل لا يجب إرسالها إلى أي بوت',
  happenedAt: '2026-07-02',
  visibility: 'private',
  selectedBotIds: ['bot-1'],
  sensitivity: 'private',
});
assert.deepEqual(privateEvent.acl, { visibility: 'private', botIds: [] });

assert.throws(() => normalizeLifeStoryDraft({
  title: ' ',
  summary: 'ملخص',
  happenedAt: '2026-07-01',
  visibility: 'all_bots',
  selectedBotIds: [],
  sensitivity: 'normal',
}), /عنوان/);

assert.throws(() => normalizeLifeStoryDraft({
  title: 'عنوان',
  summary: 'ملخص',
  happenedAt: '2026-07-01',
  visibility: 'selected_bots',
  selectedBotIds: [],
  sensitivity: 'normal',
}), /بوت واحد/);

console.log('Life story form tests passed.');
