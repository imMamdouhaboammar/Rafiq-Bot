import assert from 'node:assert/strict';
import { SocialAgencySchema } from '../contracts/rafiqV6.js';
import {
  buildSocialAgencyPrompt,
  canSendUnsolicitedMessage,
  isQuietHour,
} from '../services/socialAgencyPolicy.js';

const agency = SocialAgencySchema.parse({
  boldness: 80,
  proactivity: 70,
  quietHours: {
    enabled: true,
    startHour: 23,
    endHour: 8,
    timezone: 'Africa/Cairo',
  },
});

assert.equal(isQuietHour(23, 23, 8), true);
assert.equal(isQuietHour(7, 23, 8), true);
assert.equal(isQuietHour(12, 23, 8), false);

assert.deepEqual(
  canSendUnsolicitedMessage({
    agency,
    now: new Date('2026-07-13T00:30:00.000Z'),
    sentToday: 0,
    topicKey: 'follow-up',
    recentTopicKeys: [],
  }),
  { allowed: false, reason: 'quiet_hours' },
);

assert.deepEqual(
  canSendUnsolicitedMessage({
    agency,
    now: new Date('2026-07-13T12:00:00.000Z'),
    sentToday: 1,
    topicKey: 'follow-up',
    recentTopicKeys: [],
  }),
  { allowed: false, reason: 'daily_limit' },
);

assert.deepEqual(
  canSendUnsolicitedMessage({
    agency,
    now: new Date('2026-07-13T12:00:00.000Z'),
    sentToday: 0,
    lastSentAt: new Date('2026-07-13T04:00:00.000Z'),
    topicKey: 'follow-up',
    recentTopicKeys: [],
  }),
  { allowed: false, reason: 'cooldown' },
);

assert.deepEqual(
  canSendUnsolicitedMessage({
    agency,
    now: new Date('2026-07-13T12:00:00.000Z'),
    sentToday: 0,
    lastSentAt: new Date('2026-07-12T20:00:00.000Z'),
    topicKey: 'Follow-Up',
    recentTopicKeys: ['follow-up'],
  }),
  { allowed: false, reason: 'duplicate_topic' },
);

assert.deepEqual(
  canSendUnsolicitedMessage({
    agency,
    now: new Date('2026-07-13T12:00:00.000Z'),
    sentToday: 0,
    lastSentAt: new Date('2026-07-12T20:00:00.000Z'),
    topicKey: 'new-topic',
    recentTopicKeys: [],
  }),
  { allowed: true, reason: 'allowed' },
);

const prompt = buildSocialAgencyPrompt(agency);
assert.match(prompt, /الجرأة لا تعني إطالة الرد/);
assert.match(prompt, /ممنوع التملك أو الإلحاح/);

console.log('Social agency policy tests passed.');
