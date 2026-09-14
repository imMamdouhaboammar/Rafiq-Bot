import assert from 'node:assert/strict';
import {
  BotStoryEventSchema,
  RafiqTransferV2ManifestSchema,
  SocialAgencySchema,
  StoryAclSchema,
} from '../contracts/rafiqV6.js';

const allBotsAcl = StoryAclSchema.parse({ visibility: 'all_bots', botIds: [] });
assert.equal(allBotsAcl.visibility, 'all_bots');

assert.equal(
  StoryAclSchema.safeParse({ visibility: 'selected_bots', botIds: [] }).success,
  false,
  'selected bot visibility must identify at least one bot',
);

assert.equal(
  StoryAclSchema.safeParse({ visibility: 'private', botIds: ['bot-a'] }).success,
  false,
  'private events must not carry a bot allowlist',
);

assert.equal(
  BotStoryEventSchema.safeParse({
    id: 'event-1',
    botId: 'bot-a',
    title: 'Observed event',
    summary: 'A real event observed in chat.',
    kind: 'observed',
    sourceMessageIds: [],
    confidence: 0.8,
    acl: { visibility: 'all_bots', botIds: [] },
    createdAt: new Date(),
    updatedAt: new Date(),
  }).success,
  false,
  'observed bot story events require provenance',
);

const agency = SocialAgencySchema.parse({
  quietHours: { enabled: true, startHour: 23, endHour: 8, timezone: 'Africa/Cairo' },
});
assert.equal(agency.boldness, 50);
assert.equal(agency.proactivity, 50);
assert.equal(agency.unsolicitedDailyLimit, 1);
assert.equal(agency.cooldownHours, 12);

assert.equal(
  RafiqTransferV2ManifestSchema.safeParse({
    format: 'rafiq-transfer',
    version: 2,
    createdAt: new Date(),
    appVersion: '0.0.0',
    encrypted: false,
    includesPrivateStory: false,
    includesSensitiveMemory: false,
    includesBinaryMedia: true,
    checksums: {},
    counts: {
      chats: 0,
      messages: 0,
      lifeStoryEvents: 0,
      botStoryEvents: 0,
      memories: 0,
      attachments: 0,
    },
  }).success,
  false,
  'v2 transfers must never include binary media',
);

console.log('Rafiq v6 contract tests passed.');
