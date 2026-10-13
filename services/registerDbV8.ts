import type Dexie from 'dexie';
import { db } from './db.js';
import './registerDbV6.js';

const registeredDatabasesV8 = new WeakSet<object>();

export const registerRafiqDatabaseV8 = (database: Dexie = db): void => {
  if (registeredDatabasesV8.has(database)) return;
  registeredDatabasesV8.add(database);

  database.version(8).stores({
    memoryFacts: 'id, ownerId, companionId, [ownerId+companionId], [subjectId+predicate], status, observedAt, validFrom, updatedAt',
    memoryRelations: 'id, ownerId, companionId, [ownerId+companionId], fromEntityId, toEntityId, relationType, status, updatedAt',
    memoryEvents: 'id, ownerId, companionId, [ownerId+companionId], eventType, eventTime, idempotencyKey',
    memoryJobs: 'id, companionId, [companionId+status], status, jobType, leaseUntil, retryAfter, idempotencyKey, updatedAt',
    reflectionEntries: 'id, ownerId, companionId, [ownerId+companionId], expiresAt, sensitivity, status, createdAt',
    memoryGrants: 'grantId, ownerId, sourceCompanionId, targetCompanionId, [ownerId+sourceCompanionId], revokedAt',
    affectSnapshots: 'companionId, updatedAt',
  });
};

registerRafiqDatabaseV8();
