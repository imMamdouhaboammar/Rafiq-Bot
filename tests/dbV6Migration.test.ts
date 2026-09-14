import assert from 'node:assert/strict';
import {
  buildDefaultSocialAgencyRecord,
  migrateLegacyMemoryEntry,
  normalizeLegacyChatForV6,
} from '../services/dbV6Migration.js';
import { BotMood, MessageRole, type ChatSession, type MemoryEntry } from '../types.js';

const createdAt = new Date('2026-07-01T12:00:00.000Z');
const legacyMemory: MemoryEntry = {
  id: 'memory-1',
  chatId: 'chat-a',
  sourceMessageId: 'message-1',
  sourceRole: MessageRole.USER,
  text: 'المستخدم يفضل الاجتماعات الصباحية',
  summary: 'يفضل الاجتماعات الصباحية',
  normalizedText: 'المستخدم يفضل الاجتماعات الصباحية',
  keywords: ['اجتماعات', 'صباح'],
  category: 'preference',
  salience: 8,
  createdAt,
  updatedAt: createdAt,
};

const migrated = migrateLegacyMemoryEntry(legacyMemory)!;
assert.equal(migrated.scope, 'chat');
assert.equal(migrated.scopeId, 'chat-a');
assert.equal(migrated.provenance.kind, 'user_message');
assert.equal(migrated.confidence, 0.75);
assert.equal(migrated.salience, 0.8);
assert.equal(migrated.retention, 'general_30d');
assert.equal(migrated.expiresAt?.toISOString(), '2026-07-31T12:00:00.000Z');

assert.equal(migrateLegacyMemoryEntry({
  ...legacyMemory,
  id: 'leaked',
  chatId: 'global_shared_pool',
}), null, 'legacy global shared records must not migrate');

const chat: ChatSession = {
  id: 'chat-a',
  settings: {
    botName: 'رفيق',
    botGender: 'male',
    chattiness: 'balanced',
    fragmentedMessages: true,
    soulId: 'amira_default',
  },
  psychology: {
    mood: BotMood.HANGRY,
    energyLevel: 7,
    socialMeter: 5,
    emotionalLedger: 0,
    currentScenario: 'Standard Routine',
    intimacyLevel: 10,
    secretUnlocked: false,
    hungerLevel: 90,
  },
};
const normalized = normalizeLegacyChatForV6(chat);
assert.equal(normalized.psychology?.mood, BotMood.NEUTRAL);
assert.equal(normalized.psychology?.hungerLevel, 90, 'migration remains non-destructive');
assert.equal(chat.psychology?.mood, BotMood.HANGRY, 'migration must not mutate the source object');

const agency = buildDefaultSocialAgencyRecord('chat-a', createdAt);
assert.equal(agency.botId, 'chat-a');
assert.equal(agency.boldness, 50);
assert.equal(agency.proactivity, 50);
assert.equal(agency.cooldownHours, 12);
assert.equal(agency.unsolicitedDailyLimit, 1);

console.log('Dexie v6 migration helper tests passed.');
