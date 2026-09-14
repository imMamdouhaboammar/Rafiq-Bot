import assert from 'node:assert/strict';
import type { SocialAgencyRecord } from '../services/dbV6Migration.js';
import {
  SocialAgencyRepository,
  type SocialAgencyStore,
} from '../services/socialAgencyRepository.js';

const values = new Map<string, SocialAgencyRecord>();
const store: SocialAgencyStore = {
  get: async botId => values.get(botId),
  put: async record => { values.set(record.botId, structuredClone(record)); },
};
let now = new Date('2026-07-13T12:00:00.000Z');
const repository = new SocialAgencyRepository(store, () => new Date(now));

const defaults = await repository.get('bot-a');
assert.equal(defaults.boldness, 50);
assert.equal(defaults.proactivity, 50);
assert.equal(defaults.unsolicitedDailyLimit, 1);
assert.equal(defaults.cooldownHours, 12);
assert.equal(defaults.quietHours.timezone, 'Africa/Cairo');
assert.equal(values.size, 1);

now = new Date('2026-07-13T13:00:00.000Z');
const saved = await repository.save('bot-a', {
  boldness: 80,
  proactivity: 20,
  unsolicitedDailyLimit: 1,
  cooldownHours: 24,
  quietHours: {
    enabled: true,
    startHour: 22,
    endHour: 9,
    timezone: 'Africa/Cairo',
  },
});
assert.equal(saved.boldness, 80);
assert.equal(saved.proactivity, 20);
assert.equal(saved.updatedAt.toISOString(), now.toISOString());

now = new Date('2026-07-13T14:00:00.000Z');
const patched = await repository.patch('bot-a', {
  boldness: 65,
  quietHours: {
    ...saved.quietHours,
    enabled: false,
  },
});
assert.equal(patched.boldness, 65);
assert.equal(patched.proactivity, 20);
assert.equal(patched.quietHours.enabled, false);
assert.equal(patched.quietHours.startHour, 22);

await assert.rejects(repository.get('   '), /Bot ID is required/);
await assert.rejects(repository.patch('bot-a', { cooldownHours: 2 }), /greater than or equal to 12/);

console.log('Social agency repository tests passed.');
