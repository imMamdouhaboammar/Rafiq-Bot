import type { Table } from 'dexie';
import './registerDbV8.js';
import { db } from './db.js';
import type {
  MemoryFact,
  MemoryRelation,
  MemoryEvent,
  MemoryJob,
  ReflectionEntry,
  AffectState,
  MemoryGrant,
  FactStatus,
} from '../contracts/neuroCognitive.js';

const isIndexedDbAvailable = (): boolean => (
  typeof indexedDB !== 'undefined'
);

const table = <T, TKey = string>(name: string): Table<T, TKey> => (
  db.table<T, TKey>(name)
);

export const neuroTables = {
  memoryFacts: () => table<MemoryFact>('memoryFacts'),
  memoryRelations: () => table<MemoryRelation>('memoryRelations'),
  memoryEvents: () => table<MemoryEvent>('memoryEvents'),
  memoryJobs: () => table<MemoryJob>('memoryJobs'),
  reflectionEntries: () => table<ReflectionEntry>('reflectionEntries'),
  memoryGrants: () => table<MemoryGrant, string>('memoryGrants'),
  affectSnapshots: () => table<AffectState, string>('affectSnapshots'),
};

// ==========================================
// IN-MEMORY FALLBACK STORES (For Node/Bun & SSR)
// ==========================================

const memEvents = new Map<string, MemoryEvent>();
const memFacts = new Map<string, MemoryFact>();
const memRelations = new Map<string, MemoryRelation>();
const memJobs = new Map<string, MemoryJob>();
const memReflections = new Map<string, ReflectionEntry>();
const memGrants = new Map<string, MemoryGrant>();
const memAffects = new Map<string, AffectState>();

// ==========================================
// 1. EVENT LEDGER OPERATIONS (Append-Only)
// ==========================================

export const appendMemoryEvent = async (event: MemoryEvent): Promise<void> => {
  if (!isIndexedDbAvailable()) {
    const exists = Array.from(memEvents.values()).some(e => e.idempotencyKey === event.idempotencyKey);
    if (!exists) {
      memEvents.set(event.id, structuredClone(event));
    }
    return;
  }

  const existing = await neuroTables.memoryEvents()
    .where('idempotencyKey')
    .equals(event.idempotencyKey)
    .first();

  if (existing) return;
  await neuroTables.memoryEvents().put(event);
};

export const getMemoryEvents = async (
  companionId: string,
  limit = 50,
): Promise<MemoryEvent[]> => {
  if (!isIndexedDbAvailable()) {
    return Array.from(memEvents.values())
      .filter(e => e.companionId === companionId)
      .sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime())
      .slice(0, limit);
  }

  return neuroTables.memoryEvents()
    .where('companionId')
    .equals(companionId)
    .reverse()
    .sortBy('eventTime')
    .then(events => events.slice(0, limit));
};

// ==========================================
// 2. MEMORY FACT OPERATIONS (Sourced & Versioned)
// ==========================================

export const saveMemoryFact = async (fact: MemoryFact): Promise<void> => {
  if (!isIndexedDbAvailable()) {
    memFacts.set(fact.id, structuredClone(fact));
    return;
  }
  await neuroTables.memoryFacts().put(fact);
};

export const getMemoryFacts = async (
  companionId: string,
  options?: { status?: FactStatus; limit?: number },
): Promise<MemoryFact[]> => {
  const limit = options?.limit ?? 100;

  if (!isIndexedDbAvailable()) {
    return Array.from(memFacts.values())
      .filter(f => f.companionId === companionId && (!options?.status || f.status === options.status))
      .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime())
      .slice(0, limit);
  }

  const facts = await neuroTables.memoryFacts()
    .where('companionId')
    .equals(companionId)
    .toArray();

  const filtered = options?.status
    ? facts.filter(f => f.status === options.status)
    : facts;

  return filtered
    .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime())
    .slice(0, limit);
};

export const getActiveFactsBySubject = async (
  companionId: string,
  subjectId: string,
): Promise<MemoryFact[]> => {
  if (!isIndexedDbAvailable()) {
    return Array.from(memFacts.values()).filter(
      f => f.companionId === companionId && f.subjectId === subjectId && f.status === 'active',
    );
  }

  const facts = await neuroTables.memoryFacts()
    .where('companionId')
    .equals(companionId)
    .toArray();

  return facts.filter(f => f.subjectId === subjectId && f.status === 'active');
};

export const findActiveFactByPredicate = async (
  companionId: string,
  subjectId: string,
  predicate: string,
): Promise<MemoryFact | undefined> => {
  const facts = await getActiveFactsBySubject(companionId, subjectId);
  return facts.find(f => f.predicate.toLowerCase() === predicate.toLowerCase());
};

export const supersedeMemoryFact = async (
  oldFactId: string,
  newFact: MemoryFact,
): Promise<void> => {
  if (!isIndexedDbAvailable()) {
    const oldFact = memFacts.get(oldFactId);
    if (oldFact) {
      memFacts.set(oldFactId, {
        ...oldFact,
        status: 'superseded',
        updatedAt: new Date(),
      });
    }
    memFacts.set(newFact.id, {
      ...newFact,
      supersedesId: oldFactId,
      version: (oldFact?.version || 1) + 1,
    });
    return;
  }

  const oldFact = await neuroTables.memoryFacts().get(oldFactId);
  if (oldFact) {
    const updatedOld: MemoryFact = {
      ...oldFact,
      status: 'superseded',
      updatedAt: new Date(),
    };
    await neuroTables.memoryFacts().put(updatedOld);
  }
  await neuroTables.memoryFacts().put({
    ...newFact,
    supersedesId: oldFactId,
    version: (oldFact?.version || 1) + 1,
  });
};

export const retractMemoryFact = async (
  factId: string,
): Promise<void> => {
  if (!isIndexedDbAvailable()) {
    const fact = memFacts.get(factId);
    if (fact) {
      memFacts.set(factId, {
        ...fact,
        status: 'retracted',
        updatedAt: new Date(),
      });
    }
    return;
  }

  const fact = await neuroTables.memoryFacts().get(factId);
  if (fact) {
    await neuroTables.memoryFacts().put({
      ...fact,
      status: 'retracted',
      updatedAt: new Date(),
    });
  }
};

// ==========================================
// 3. MEMORY RELATION OPERATIONS
// ==========================================

export const saveMemoryRelation = async (rel: MemoryRelation): Promise<void> => {
  if (!isIndexedDbAvailable()) {
    memRelations.set(rel.id, structuredClone(rel));
    return;
  }
  await neuroTables.memoryRelations().put(rel);
};

export const getMemoryRelations = async (
  companionId: string,
  entityId?: string,
): Promise<MemoryRelation[]> => {
  if (!isIndexedDbAvailable()) {
    const rels = Array.from(memRelations.values()).filter(
      r => r.companionId === companionId && r.status === 'active',
    );
    if (!entityId) return rels;
    return rels.filter(r => r.fromEntityId === entityId || r.toEntityId === entityId);
  }

  const rels = await neuroTables.memoryRelations()
    .where('companionId')
    .equals(companionId)
    .toArray();

  if (!entityId) {
    return rels.filter(r => r.status === 'active');
  }

  return rels.filter(
    r => r.status === 'active' && (r.fromEntityId === entityId || r.toEntityId === entityId),
  );
};

// ==========================================
// 4. MEMORY JOB OPERATIONS (Durable Queue)
// ==========================================

export const enqueueMemoryJob = async (job: MemoryJob): Promise<void> => {
  if (!isIndexedDbAvailable()) {
    const exists = Array.from(memJobs.values()).some(j => j.idempotencyKey === job.idempotencyKey);
    if (!exists) {
      memJobs.set(job.id, structuredClone(job));
    }
    return;
  }

  const existing = await neuroTables.memoryJobs()
    .where('idempotencyKey')
    .equals(job.idempotencyKey)
    .first();

  if (existing) return;
  await neuroTables.memoryJobs().put(job);
};

export const leaseNextPendingJob = async (
  companionId: string,
  leaseDurationMs = 30_000,
): Promise<MemoryJob | undefined> => {
  const now = new Date();

  if (!isIndexedDbAvailable()) {
    const jobs = Array.from(memJobs.values()).filter(j => j.companionId === companionId);
    const candidate = jobs.find(job => {
      if (job.status === 'pending') {
        return !job.retryAfter || new Date(job.retryAfter).getTime() <= now.getTime();
      }
      if (job.status === 'leased' && job.leaseUntil) {
        return new Date(job.leaseUntil).getTime() < now.getTime();
      }
      return false;
    });

    if (!candidate) return undefined;

    const leasedJob: MemoryJob = {
      ...candidate,
      status: 'leased',
      attempts: candidate.attempts + 1,
      leaseUntil: new Date(now.getTime() + leaseDurationMs),
      updatedAt: now,
    };

    memJobs.set(candidate.id, leasedJob);
    return leasedJob;
  }

  const jobs = await neuroTables.memoryJobs()
    .where('companionId')
    .equals(companionId)
    .toArray();

  const candidate = jobs.find(job => {
    if (job.status === 'pending') {
      return !job.retryAfter || new Date(job.retryAfter).getTime() <= now.getTime();
    }
    if (job.status === 'leased' && job.leaseUntil) {
      return new Date(job.leaseUntil).getTime() < now.getTime();
    }
    return false;
  });

  if (!candidate) return undefined;

  const leasedJob: MemoryJob = {
    ...candidate,
    status: 'leased',
    attempts: candidate.attempts + 1,
    leaseUntil: new Date(now.getTime() + leaseDurationMs),
    updatedAt: now,
  };

  await neuroTables.memoryJobs().put(leasedJob);
  return leasedJob;
};

export const completeMemoryJob = async (jobId: string): Promise<void> => {
  if (!isIndexedDbAvailable()) {
    const job = memJobs.get(jobId);
    if (job) {
      memJobs.set(jobId, { ...job, status: 'completed', updatedAt: new Date() });
    }
    return;
  }

  const job = await neuroTables.memoryJobs().get(jobId);
  if (job) {
    await neuroTables.memoryJobs().put({
      ...job,
      status: 'completed',
      updatedAt: new Date(),
    });
  }
};

export const failMemoryJob = async (
  jobId: string,
  error: string,
  retryDelayMs = 10_000,
): Promise<void> => {
  const now = new Date();

  if (!isIndexedDbAvailable()) {
    const job = memJobs.get(jobId);
    if (!job) return;
    const nextStatus = job.attempts >= job.maxAttempts ? 'dead_letter' : 'pending';
    memJobs.set(jobId, {
      ...job,
      status: nextStatus,
      error,
      retryAfter: new Date(now.getTime() + retryDelayMs),
      updatedAt: now,
    });
    return;
  }

  const job = await neuroTables.memoryJobs().get(jobId);
  if (!job) return;

  const nextStatus = job.attempts >= job.maxAttempts ? 'dead_letter' : 'pending';

  await neuroTables.memoryJobs().put({
    ...job,
    status: nextStatus,
    error,
    retryAfter: new Date(now.getTime() + retryDelayMs),
    updatedAt: now,
  });
};

// ==========================================
// 5. REFLECTION JOURNAL OPERATIONS (Private & Deletable)
// ==========================================

export const saveReflectionEntry = async (entry: ReflectionEntry): Promise<void> => {
  if (!isIndexedDbAvailable()) {
    memReflections.set(entry.id, structuredClone(entry));
    return;
  }
  await neuroTables.reflectionEntries().put(entry);
};

export const getActiveReflections = async (
  companionId: string,
  limit = 5,
): Promise<ReflectionEntry[]> => {
  const now = new Date().getTime();

  if (!isIndexedDbAvailable()) {
    return Array.from(memReflections.values())
      .filter(r => r.companionId === companionId && r.status === 'active' && new Date(r.expiresAt).getTime() > now)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  const reflections = await neuroTables.reflectionEntries()
    .where('companionId')
    .equals(companionId)
    .toArray();

  return reflections
    .filter(r => r.status === 'active' && new Date(r.expiresAt).getTime() > now)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
};

export const deleteReflectionEntry = async (id: string): Promise<void> => {
  if (!isIndexedDbAvailable()) {
    memReflections.delete(id);
    return;
  }
  await neuroTables.reflectionEntries().delete(id);
};

export const pruneExpiredReflections = async (now = new Date()): Promise<number> => {
  const nowMs = now.getTime();

  if (!isIndexedDbAvailable()) {
    let pruned = 0;
    for (const [id, item] of memReflections.entries()) {
      if (new Date(item.expiresAt).getTime() <= nowMs) {
        memReflections.delete(id);
        pruned++;
      }
    }
    return pruned;
  }

  const all = await neuroTables.reflectionEntries().toArray();
  const expired = all.filter(r => new Date(r.expiresAt).getTime() <= nowMs);

  for (const item of expired) {
    await neuroTables.reflectionEntries().delete(item.id);
  }
  return expired.length;
};

// ==========================================
// 6. CROSS-COMPANION MEMORY GRANTS (One-Way & Revocable)
// ==========================================

export const saveMemoryGrant = async (grant: MemoryGrant): Promise<void> => {
  if (!isIndexedDbAvailable()) {
    memGrants.set(grant.grantId, structuredClone(grant));
    return;
  }
  await neuroTables.memoryGrants().put(grant);
};

export const getActiveGrant = async (
  sourceCompanionId: string,
  targetCompanionId: string,
): Promise<MemoryGrant | undefined> => {
  const now = new Date().getTime();

  if (!isIndexedDbAvailable()) {
    return Array.from(memGrants.values()).find(g =>
      g.sourceCompanionId === sourceCompanionId &&
      g.targetCompanionId === targetCompanionId &&
      !g.revokedAt &&
      (!g.expiresAt || new Date(g.expiresAt).getTime() > now),
    );
  }

  const grants = await neuroTables.memoryGrants().toArray();

  return grants.find(g =>
    g.sourceCompanionId === sourceCompanionId &&
    g.targetCompanionId === targetCompanionId &&
    !g.revokedAt &&
    (!g.expiresAt || new Date(g.expiresAt).getTime() > now),
  );
};

export const revokeMemoryGrant = async (grantId: string): Promise<void> => {
  if (!isIndexedDbAvailable()) {
    const grant = memGrants.get(grantId);
    if (grant) {
      memGrants.set(grantId, { ...grant, revokedAt: new Date() });
    }
    return;
  }

  const grant = await neuroTables.memoryGrants().get(grantId);
  if (grant) {
    await neuroTables.memoryGrants().put({
      ...grant,
      revokedAt: new Date(),
    });
  }
};

export const listActiveGrants = async (ownerId = 'main_user'): Promise<MemoryGrant[]> => {
  const now = new Date().getTime();

  if (!isIndexedDbAvailable()) {
    return Array.from(memGrants.values()).filter(g =>
      g.ownerId === ownerId &&
      !g.revokedAt &&
      (!g.expiresAt || new Date(g.expiresAt).getTime() > now),
    );
  }

  const grants = await neuroTables.memoryGrants()
    .where('ownerId')
    .equals(ownerId)
    .toArray();

  return grants.filter(g =>
    !g.revokedAt && (!g.expiresAt || new Date(g.expiresAt).getTime() > now),
  );
};

// ==========================================
// 7. AFFECT SNAPSHOT OPERATIONS
// ==========================================

export const saveAffectSnapshot = async (snapshot: AffectState): Promise<void> => {
  if (!isIndexedDbAvailable()) {
    memAffects.set(snapshot.companionId, structuredClone(snapshot));
    return;
  }
  await neuroTables.affectSnapshots().put(snapshot);
};

export const getAffectSnapshot = async (
  companionId: string,
): Promise<AffectState | undefined> => {
  if (!isIndexedDbAvailable()) {
    return memAffects.get(companionId);
  }
  return neuroTables.affectSnapshots().get(companionId);
};
