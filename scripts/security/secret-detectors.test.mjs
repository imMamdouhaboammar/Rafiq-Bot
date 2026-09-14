import assert from 'node:assert/strict';
import { findSecretMatches } from './secret-detectors.mjs';

const knownFixtureValues = new Set([
  'test-only-session-secret-with-more-than-32-characters',
  'dummy_api_key_value_for_tests',
]);
const safeFixtureSource = [
  `process.env.APP_SESSION_SECRET = "test-only-session-secret-with-more-than-32-characters";`,
  `const apiKey = "dummy_api_key_value_for_tests";`,
].join('\n');
assert.deepEqual(findSecretMatches('safe fixtures', safeFixtureSource, knownFixtureValues), []);

assert.deepEqual(findSecretMatches('not allowlisted', safeFixtureSource), [
  { source: 'not allowlisted', line: 1, detector: 'assigned long secret' },
  { source: 'not allowlisted', line: 2, detector: 'assigned long secret' },
]);

const unknownTestPrefixedValue = ['test', 'unknown', 'x'.repeat(32)].join('-');
const unknownTestPrefixedSource = `const authToken = "${unknownTestPrefixedValue}";`;
assert.deepEqual(findSecretMatches('unknown test prefix', unknownTestPrefixedSource, knownFixtureValues), [
  { source: 'unknown test prefix', line: 1, detector: 'assigned long secret' },
]);

const suspiciousAssignedValue = ['production', 'secret', 'x'.repeat(32)].join('-');
const suspiciousAssignedSource = `const clientSecret = "${suspiciousAssignedValue}";`;
assert.deepEqual(findSecretMatches('assigned fixture', suspiciousAssignedSource), [
  { source: 'assigned fixture', line: 1, detector: 'assigned long secret' },
]);

const googleLookingValue = `AI${'za'}${'A'.repeat(35)}`;
assert.deepEqual(findSecretMatches('provider fixture', googleLookingValue), [
  { source: 'provider fixture', line: 1, detector: 'Google API key' },
]);

console.log('Secret detector tests passed.');
