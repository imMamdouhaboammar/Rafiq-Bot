import assert from 'node:assert/strict';
import {
  isPublicIpAddress,
  resolvePinnedPublicTarget,
  validatePublicUrl,
  validateRedirectTarget,
} from '../services/webReader/urlSafety.server.js';

assert.equal(isPublicIpAddress('8.8.8.8'), true);
assert.equal(isPublicIpAddress('1.1.1.1'), true);
assert.equal(isPublicIpAddress('2606:4700:4700::1111'), true);

for (const address of [
  '0.0.0.0',
  '10.0.0.1',
  '100.64.0.1',
  '127.0.0.1',
  '169.254.1.1',
  '172.16.0.1',
  '192.168.1.1',
  '192.0.2.1',
  '198.51.100.1',
  '203.0.113.1',
  '224.0.0.1',
  '::',
  '::1',
  'fc00::1',
  'fe80::1',
  '2001:db8::1',
  '::ffff:127.0.0.1',
]) {
  assert.equal(isPublicIpAddress(address), false, `${address} must be blocked`);
}

const publicUrl = validatePublicUrl('https://example.com/article?q=1#section');
assert.equal(publicUrl.toString(), 'https://example.com/article?q=1');

for (const url of [
  'file:///etc/passwd',
  'http://user:password@example.com/',
  'http://localhost/',
  'http://app.local/',
  'http://internal.service.internal/',
  'http://127.0.0.1/',
  'http://10.0.0.1/',
  'http://[::1]/',
  'https://example.com:8443/',
]) {
  assert.throws(() => validatePublicUrl(url), undefined, `${url} must be rejected`);
}

const publicResolver = async () => [
  { address: '93.184.216.34', family: 4 },
  { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
];
const pinned = await resolvePinnedPublicTarget('https://example.com/path', publicResolver);
assert.equal(pinned.hostname, 'example.com');
assert.equal(pinned.address, '93.184.216.34');
assert.deepEqual(pinned.resolvedAddresses, [
  '93.184.216.34',
  '2606:2800:220:1:248:1893:25c8:1946',
]);

await assert.rejects(
  resolvePinnedPublicTarget('https://mixed.example/path', async () => [
    { address: '93.184.216.34', family: 4 },
    { address: '127.0.0.1', family: 4 },
  ]),
  /resolves to a private/,
  'a mixed public/private DNS response must be rejected to prevent rebinding',
);

await assert.rejects(
  validateRedirectTarget(
    'https://example.com/start',
    'http://127.0.0.1/admin',
    publicResolver,
  ),
  /blocked/,
  'every redirect target must be validated again',
);

console.log('URL safety tests passed.');
