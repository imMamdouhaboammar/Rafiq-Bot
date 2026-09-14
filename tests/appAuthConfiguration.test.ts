import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  AppAuthConfigurationError,
  createAppSessionCookie,
  getAppAuthConfiguration,
  hasValidAppSession,
  verifyAppPassword,
} from '../services/appAuth.server.js';

const previousHash = process.env.RAFIQ_APP_PASSWORD_HASH;
const previousSecret = process.env.RAFIQ_APP_SESSION_SECRET;
const previousNodeEnv = process.env.NODE_ENV;

try {
  delete process.env.RAFIQ_APP_PASSWORD_HASH;
  delete process.env.RAFIQ_APP_SESSION_SECRET;
  assert.throws(() => getAppAuthConfiguration(), AppAuthConfigurationError);

  const password = 'local-test-password';
  process.env.RAFIQ_APP_PASSWORD_HASH = crypto.createHash('sha256').update(password).digest('hex');
  process.env.RAFIQ_APP_SESSION_SECRET = 'test-only-session-secret-with-more-than-32-characters';
  process.env.NODE_ENV = 'test';

  assert.deepEqual(getAppAuthConfiguration(), { configured: true });
  assert.equal(verifyAppPassword(password), true);
  assert.equal(verifyAppPassword('wrong-password'), false);

  const cookie = createAppSessionCookie();
  assert.match(cookie, /^rafiq_app_session=/);
  assert.equal(hasValidAppSession(cookie), true);
  assert.equal(hasValidAppSession('rafiq_app_session=invalid'), false);
} finally {
  if (previousHash === undefined) delete process.env.RAFIQ_APP_PASSWORD_HASH;
  else process.env.RAFIQ_APP_PASSWORD_HASH = previousHash;

  if (previousSecret === undefined) delete process.env.RAFIQ_APP_SESSION_SECRET;
  else process.env.RAFIQ_APP_SESSION_SECRET = previousSecret;

  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
}

console.log('App auth configuration tests passed.');
