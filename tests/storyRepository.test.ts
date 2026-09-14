import assert from 'node:assert/strict';
import type {
  BotStoryEvent,
  LifeStoryEvent,
  StorySignal,
} from '../contracts/rafiqV6.js';
import {
  StoryRepository,
  type StoryRepositoryDependencies,
  type StoryStore,
} from '../services/storyRepository.js';

const createMemoryStore = <T extends { id?: string }>(): StoryStore<T> => {
  const values = new Map<string, T>();
  return {
    get: async id => values.get(id),
    put: async value => {
      if (!value.id) throw new Error('Stored story records require an ID.');
      values.set(value.id, structuredClone(value));
    },
    delete: async id => { values.delete(id); },
    list: async () => Array.from(values.values()).map(value => structuredClone(value)),
    deleteWhere: async predicate => {
      for (const [id, value] of values) {
        if (predicate(value)) values.delete(id);
      }
    },
  };
};

const lifeEvents = createMemoryStore<LifeStoryEvent>();
const signals = createMemoryStore<StorySignal>();
const botEvents = createMemoryStore<BotStoryEvent>();
let idCounter = 0;
let now = new Date('2026-07-13T12:00:00.000Z');
const dependencies: StoryRepositoryDependencies = {
  lifeEvents,
  signals,
  botEvents,
  now: () => new Date(now),
  createId: () => `id-${++idCounter}`,
};
const repository = new StoryRepository(dependencies);

const event = await repository.createLifeEvent({
  title: 'بدأ مشروعًا جديدًا',
  summary: 'بدأ المستخدم مشروعًا جديدًا في يوليو.',
  happenedAt: '2026-07-01T10:00:00.000Z',
  acl: { visibility: 'selected_bots', botIds: ['bot-a'] },
});
assert.equal(event.userId, 'main_user');
assert.equal(event.acl.visibility, 'selected_bots');

const createdSignals = await repository.replaceSignals(event.id, [
  { text: 'بدأ مشروعًا جديدًا هذا الشهر', salience: 0.9 },
  { text: 'يركز حاليًا على مرحلة الإطلاق', salience: 0.8 },
]);
assert.equal(createdSignals.length, 2);
assert.deepEqual(createdSignals[0].acl.botIds, ['bot-a']);

now = new Date('2026-07-13T13:00:00.000Z');
const updated = await repository.updateLifeEvent(event.id, {
  acl: { visibility: 'private', botIds: [] },
  sensitivity: 'private',
});
assert.equal(updated.acl.visibility, 'private');
const updatedSignals = await signals.list();
assert.equal(updatedSignals.every(signal => signal.acl.visibility === 'private'), true);
assert.equal(updatedSignals.every(signal => signal.sensitivity === 'private'), true);

await repository.deleteLifeEvent(event.id);
assert.equal((await lifeEvents.list()).length, 0);
assert.equal((await signals.list()).length, 0, 'deleting an event must remove derived signals');

const imaginary = await repository.createBotEvent({
  botId: 'bot-a',
  title: 'رحلة خيالية',
  summary: 'حدث داخل قصة مشتركة فقط.',
  kind: 'imaginary',
  confidence: 1,
  acl: { visibility: 'all_bots', botIds: [] },
});
assert.equal(imaginary.kind, 'imaginary');
assert.equal((await repository.listBotEvents('bot-a', false)).length, 0);

now = new Date('2026-07-13T12:30:00.000Z');
const correctedImaginary = await repository.correctBotEvent(imaginary.id, {
  title: 'رحلة خيالية مصححة',
  summary: 'تصحيح لحدث داخل القصة المشتركة.',
  sourceMessageIds: [],
  confidence: 1,
  acl: { visibility: 'all_bots', botIds: [] },
});
assert.equal(correctedImaginary.kind, 'imaginary');
assert.deepEqual(correctedImaginary.sourceMessageIds, []);
assert.equal(correctedImaginary.supersedesId, imaginary.id);

await assert.rejects(
  repository.createBotEvent({
    botId: 'bot-a',
    title: 'حدث مرصود بلا مصدر',
    summary: 'لا يجب حفظه.',
    kind: 'observed',
    sourceMessageIds: [],
    confidence: 0.8,
    acl: { visibility: 'all_bots', botIds: [] },
  }),
  /source message IDs/,
);

const observed = await repository.createBotEvent({
  botId: 'bot-a',
  title: 'قرار واضح',
  summary: 'اتخذ البوت قرارًا بعد مناقشة المجموعة.',
  kind: 'observed',
  sourceMessageIds: ['message-1'],
  sourceGroupId: 'group-a',
  confidence: 0.8,
  acl: { visibility: 'selected_bots', botIds: ['bot-a'] },
});
now = new Date('2026-07-13T14:00:00.000Z');
const correction = await repository.correctBotEvent(observed.id, {
  title: 'قرار مصحح',
  summary: 'صحح المستخدم معنى القرار.',
  sourceMessageIds: ['message-correction'],
  confidence: 1,
  acl: { visibility: 'selected_bots', botIds: ['bot-a'] },
});
assert.equal(correction.supersedesId, observed.id);
assert.equal((await botEvents.get(observed.id))?.status, 'superseded');
assert.equal(correction.kind, 'observed');

await repository.deleteBotEvent(correction.id);
assert.equal((await botEvents.get(correction.id))?.status, 'deleted');

console.log('Story repository tests passed.');
