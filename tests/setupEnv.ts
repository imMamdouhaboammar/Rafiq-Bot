import crypto from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = 'test-only-gemini-key';
process.env.RAFIQ_APP_PASSWORD_HASH = crypto
  .createHash('sha256')
  .update('test-only-password')
  .digest('hex');
process.env.RAFIQ_APP_SESSION_SECRET = 'test-only-session-secret-with-more-than-32-characters';
process.env.RAFIQ_VECTOR_MEMORY_ENABLED = 'true';

delete process.env.REDIS_URL;
delete process.env.AGENT_MEMORY_API_KEY;
delete process.env.REDIS_AGENT_MEMORY_API_KEY;
delete process.env.AGENT_MEMORY_SERVER_URL;
delete process.env.REDIS_AGENT_MEMORY_SERVER_URL;
delete process.env.AGENT_MEMORY_STORE_ID;
delete process.env.REDIS_AGENT_MEMORY_STORE_ID;
