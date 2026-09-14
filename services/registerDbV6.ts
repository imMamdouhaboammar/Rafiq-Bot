import type Dexie from 'dexie';
import type { ChatSession, MemoryEntry } from '../types.js';
import type { MemoryRecord } from '../contracts/rafiqV6.js';
import { db } from './db.js';
import {
  buildDefaultSocialAgencyRecord,
  migrateLegacyMemoryEntry,
  normalizeLegacyChatForV6,
} from './dbV6Migration.js';

const registeredDatabases = new WeakSet<object>();

export const registerRafiqDatabaseV6 = (database: Dexie = db): void => {
  if (registeredDatabases.has(database)) return;
  registeredDatabases.add(database);

  database.version(6).stores({
    chats: 'id, lastMessageTimestamp',
    messages: 'id, chatId, timestamp',
    userProfile: 'id',
    groupMessages: 'id, chatId, timestamp',
    memoryEntries: 'id, chatId, sourceMessageId, createdAt, updatedAt, salience, category, *keywords',
    randomPrompts: 'id, userId, enabled, createdAt',
    lifeStoryEvents: 'id, userId, happenedAt, updatedAt, acl.visibility, *acl.botIds, sensitivity',
    storySignals: 'id, eventId, createdAt, expiresAt, salience, acl.visibility, *acl.botIds',
    botStoryEvents: 'id, botId, [botId+status], kind, status, updatedAt, *sourceMessageIds',
    memoryRecords: 'id, [scope+scopeId], scope, scopeId, category, retention, expiresAt, status, updatedAt, salience',
    socialAgency: 'botId, updatedAt',
    attachmentRecords: 'id, chatId, messageId, availability, updatedAt, sha256',
    groupTurnJobs: 'id, groupId, [groupId+status], status, runAfter, idempotencyKey, updatedAt',
    capabilityHealth: 'capability, status, checkedAt',
    transferStaging: 'id, status, createdAt',
  }).upgrade(async transaction => {
    const chatsTable = transaction.table<ChatSession, string>('chats');
    const legacyMemoryTable = transaction.table<MemoryEntry, string>('memoryEntries');
    const memoryRecordsTable = transaction.table<MemoryRecord, string>('memoryRecords');
    const socialAgencyTable = transaction.table('socialAgency');

    const chats = await chatsTable.toArray();
    if (chats.length > 0) {
      await chatsTable.bulkPut(chats.map(normalizeLegacyChatForV6));
    }

    const legacyMemories = await legacyMemoryTable.toArray();
    const migratedMemories = legacyMemories
      .map(migrateLegacyMemoryEntry)
      .filter((record): record is MemoryRecord => Boolean(record));
    if (migratedMemories.length > 0) {
      await memoryRecordsTable.bulkPut(migratedMemories);
    }

    const existingAgencyBotIds = new Set(
      (await socialAgencyTable.toArray()).map((record: any) => String(record.botId)),
    );
    const defaultAgencyRecords = chats
      .filter(chat => !chat.isGroup && !existingAgencyBotIds.has(chat.id))
      .map(chat => buildDefaultSocialAgencyRecord(chat.id));
    if (defaultAgencyRecords.length > 0) {
      await socialAgencyTable.bulkPut(defaultAgencyRecords);
    }
  });

  database.version(7).stores({
    installedSkills: 'skillId, isEnabled, pinnedInChat, activationCount, installedAt',
    skillStates: '[skillId+chatId], skillId, chatId, updatedAt',
  });
};

registerRafiqDatabaseV6();
