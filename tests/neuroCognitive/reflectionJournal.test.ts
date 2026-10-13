import assert from 'node:assert/strict';
import {
  createReflectionEntry,
  compileReflectionContext,
  REFLECTION_RETENTION_DAYS,
} from '../../services/reflectionJournal.js';

const now = new Date('2026-10-09T08:00:00Z');

// 1. Create reflection entry with retention policy
const entry = createReflectionEntry(
  'amira-1',
  {
    topic: 'ضغط الشغل',
    hypothesis: 'المستخدم مضغوط اليومين دول بسبب تسليم المشروع',
    openQuestion: 'هل محتاج مساحة ولا محتاج فضفضة؟',
    confidence: 0.8,
  },
  now,
);

assert.equal(entry.topic, 'ضغط الشغل');
assert.equal(entry.status, 'active');
assert.equal(entry.ownerId, 'main_user');

// Verify 30-day retention
const expectedExpiry = new Date(now.getTime() + REFLECTION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
assert.equal(entry.expiresAt.toISOString(), expectedExpiry.toISOString());

// 2. Compile context
const context = compileReflectionContext([entry]);
assert.ok(context);
assert.ok(context.includes('ضغط الشغل'));
assert.ok(context.includes('سؤال مفتوح في بالك'));

// 3. Expired reflection is ignored
const expiredEntry = {
  ...entry,
  id: 'refl-expired',
  expiresAt: new Date(Date.now() - 1000), // in the past
};
const contextWithExpired = compileReflectionContext([expiredEntry]);
assert.equal(contextWithExpired, undefined, 'Expired reflections must not be compiled into context');

console.log('✓ Private reflection journal tests passed successfully.');
