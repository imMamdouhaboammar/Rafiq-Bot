import assert from 'node:assert/strict';
import {
  canClaimCapabilityWorks,
  deriveCapabilityHealth,
} from '../services/capabilityHealth.js';

const now = new Date('2026-07-13T12:00:00.000Z');

const misconfigured = deriveCapabilityHealth({
  capability: 'web_search',
  requirements: [
    { name: 'RAFIQ_WEB_SEARCH_PROVIDER', present: false },
    { name: 'RAFIQ_WEB_SEARCH_API_KEY', present: false },
  ],
});
assert.equal(misconfigured.status, 'misconfigured');
assert.deepEqual(misconfigured.missingRequirements, [
  'RAFIQ_WEB_SEARCH_PROVIDER',
  'RAFIQ_WEB_SEARCH_API_KEY',
]);
assert.equal(canClaimCapabilityWorks(misconfigured), false);

const unverified = deriveCapabilityHealth({
  capability: 'attachments',
  requirements: [{ name: 'OPFS', present: true }],
});
assert.equal(unverified.status, 'degraded');
assert.equal(canClaimCapabilityWorks(unverified), false);

const unitOnly = deriveCapabilityHealth({
  capability: 'groups',
  requirements: [],
  testResult: { ok: true, checkedAt: now, kind: 'unit', reason: 'Unit test passed.' },
});
assert.equal(unitOnly.status, 'healthy');
assert.equal(canClaimCapabilityWorks(unitOnly), false, 'unit mocks cannot prove a real capability works');

const realProvider = deriveCapabilityHealth({
  capability: 'gemini',
  requirements: [{ name: 'Gemini credentials', present: true }],
  testResult: { ok: true, checkedAt: now, kind: 'real_provider', reason: 'Provider smoke test passed.' },
});
assert.equal(realProvider.status, 'healthy');
assert.equal(canClaimCapabilityWorks(realProvider), true);

console.log('Capability health tests passed.');
