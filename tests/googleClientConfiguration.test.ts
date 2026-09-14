import assert from 'node:assert/strict';
import {
  GoogleAiConfigurationError,
  resolveGoogleAiConfiguration,
} from '../services/googleClient.server.js';

assert.throws(
  () => resolveGoogleAiConfiguration({}),
  GoogleAiConfigurationError,
  'Google AI must not silently use a hardcoded project',
);

assert.deepEqual(
  resolveGoogleAiConfiguration({ GEMINI_API_KEY: 'test-key' }),
  { mode: 'api_key', apiKey: 'test-key' },
);

const serviceAccount = JSON.stringify({
  type: 'service_account',
  project_id: 'rafiq-test-project',
  private_key_id: 'placeholder',
});

assert.deepEqual(
  resolveGoogleAiConfiguration({
    GOOGLE_SERVICE_ACCOUNT_JSON: serviceAccount,
    GOOGLE_CLOUD_LOCATION: 'europe-west1',
  }),
  {
    mode: 'vertex',
    project: 'rafiq-test-project',
    location: 'europe-west1',
  },
);

assert.throws(
  () => resolveGoogleAiConfiguration({ GOOGLE_APPLICATION_CREDENTIALS: '/tmp/test.json' }),
  /GOOGLE_CLOUD_PROJECT is required/,
);

assert.throws(
  () => resolveGoogleAiConfiguration({ GOOGLE_SERVICE_ACCOUNT_JSON: '{invalid' }),
  /malformed/,
);

console.log('Google AI configuration tests passed.');
