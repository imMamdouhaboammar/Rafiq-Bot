import assert from 'node:assert/strict';
import type { CapabilityHealth } from '../contracts/rafiqV6.js';
import {
  CapabilityHealthRepository,
  type CapabilityHealthStore,
} from '../services/capabilityHealthRepository.js';

const values = new Map<CapabilityHealth['capability'], CapabilityHealth>();
const store: CapabilityHealthStore = {
  get: async capability => values.get(capability),
  put: async record => { values.set(record.capability, structuredClone(record)); },
  list: async () => Array.from(values.values()).map(record => structuredClone(record)),
};
let now = new Date('2026-07-13T12:00:00.000Z');
const repository = new CapabilityHealthRepository(store, () => new Date(now));

const missing = await repository.evaluateConfiguration('web_search', [
  { name: 'RAFIQ_WEB_SEARCH_PROVIDER', present: false },
  { name: 'RAFIQ_WEB_SEARCH_API_KEY', present: false },
]);
assert.equal(missing.status, 'misconfigured');
assert.equal(missing.testKind, 'configuration');
assert.deepEqual(missing.missingRequirements, [
  'RAFIQ_WEB_SEARCH_PROVIDER',
  'RAFIQ_WEB_SEARCH_API_KEY',
]);

const healthy = await repository.runProbe({
  capability: 'gemini',
  requirements: () => [{ name: 'Gemini credentials', present: true }],
  run: async () => ({
    ok: true,
    kind: 'real_provider',
    reason: 'Provider returned a valid smoke response.',
  }),
});
assert.equal(healthy.status, 'healthy');
assert.equal(healthy.lastSuccessAt?.toISOString(), '2026-07-13T12:00:00.000Z');

now = new Date('2026-07-13T13:00:00.000Z');
const degraded = await repository.runProbe({
  capability: 'gemini',
  requirements: () => [{ name: 'Gemini credentials', present: true }],
  run: async () => ({
    ok: false,
    kind: 'real_provider',
    reason: 'Provider timed out.',
  }),
});
assert.equal(degraded.status, 'degraded', 'a prior success followed by failure should degrade');
assert.equal(degraded.lastSuccessAt?.toISOString(), '2026-07-13T12:00:00.000Z');
assert.equal(degraded.checkedAt.toISOString(), '2026-07-13T13:00:00.000Z');

now = new Date('2026-07-13T14:00:00.000Z');
const unavailable = await repository.runProbe({
  capability: 'attachments',
  requirements: () => [{ name: 'OPFS', present: true }],
  run: async () => { throw new Error('OPFS write test failed.'); },
});
assert.equal(unavailable.status, 'unavailable');
assert.equal(unavailable.reason, 'OPFS write test failed.');

const list = await repository.list();
assert.deepEqual(list.map(record => record.capability), ['attachments', 'gemini', 'web_search']);

console.log('Capability health repository tests passed.');
