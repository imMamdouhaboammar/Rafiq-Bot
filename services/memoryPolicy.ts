import type { MemoryRecord, MemoryRetention, MemoryScope } from '../contracts/rafiqV6.js';

export const MEMORY_SCOPE_RECORD_LIMIT = 250;
export const DEFAULT_PROMPT_MEMORY_LIMIT = 8;

export interface MemoryAccessContext {
  botId: string;
  chatId?: string;
  groupIds?: string[];
  knowledgeScopeIds?: string[];
  allowUserStory?: boolean;
}

export const buildMemoryScopeKey = (scope: MemoryScope, scopeId: string): string => {
  const normalizedId = scopeId.trim();
  if (!normalizedId) throw new Error('Memory scope ID is required.');
  if (normalizedId === 'global_shared_pool') {
    throw new Error('global_shared_pool is forbidden. Use an explicit memory scope.');
  }
  return `${scope}:${normalizedId}`;
};

export const canReadMemory = (record: MemoryRecord, context: MemoryAccessContext): boolean => {
  if (record.status !== 'active') return false;
  if (record.sensitivity === 'private' && record.scope !== 'bot') return false;

  switch (record.scope) {
    case 'user_story':
      return context.allowUserStory === true;
    case 'bot':
      return record.scopeId === context.botId;
    case 'chat':
      return Boolean(context.chatId && record.scopeId === context.chatId);
    case 'group':
      return context.groupIds?.includes(record.scopeId) === true;
    case 'knowledge':
      return context.knowledgeScopeIds?.includes(record.scopeId) === true;
    default:
      return false;
  }
};

export const inferMemoryRetention = (
  category: MemoryRecord['category'],
): MemoryRetention => {
  if (category === 'identity' || category === 'goal') return 'durable';
  if (category === 'emotion') return 'transient_7d';
  return 'general_30d';
};

export const calculateMemoryExpiry = (
  retention: MemoryRetention,
  createdAt: Date,
): Date | undefined => {
  if (retention === 'durable' || retention === 'manual') return undefined;
  const expiresAt = new Date(createdAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + (retention === 'transient_7d' ? 7 : 30));
  return expiresAt;
};

export const isMemoryExpired = (record: MemoryRecord, now = new Date()): boolean => (
  Boolean(record.expiresAt && record.expiresAt.getTime() <= now.getTime())
);

const scoreMemory = (record: MemoryRecord, now: Date): number => {
  const ageDays = Math.max(0, (now.getTime() - record.updatedAt.getTime()) / 86_400_000);
  const recency = Math.max(0, 1 - ageDays / 30);
  const durableBoost = record.retention === 'durable' ? 0.15 : 0;
  return (record.salience * 0.45) + (record.confidence * 0.3) + (recency * 0.25) + durableBoost;
};

export const selectPromptMemories = (
  records: MemoryRecord[],
  context: MemoryAccessContext,
  options: { now?: Date; limit?: number } = {},
): MemoryRecord[] => {
  const now = options.now ?? new Date();
  const limit = Math.max(0, Math.min(20, options.limit ?? DEFAULT_PROMPT_MEMORY_LIMIT));

  return records
    .filter(record => canReadMemory(record, context))
    .filter(record => !isMemoryExpired(record, now))
    .sort((left, right) => {
      const scoreDifference = scoreMemory(right, now) - scoreMemory(left, now);
      if (scoreDifference !== 0) return scoreDifference;
      return right.updatedAt.getTime() - left.updatedAt.getTime();
    })
    .slice(0, limit);
};

export interface MemoryCompactionPlan {
  keepIds: string[];
  removeIds: string[];
}

export const planMemoryCompaction = (
  records: MemoryRecord[],
  now = new Date(),
  limit = MEMORY_SCOPE_RECORD_LIMIT,
): MemoryCompactionPlan => {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Memory compaction limit must be positive.');

  const active = records.filter(record => record.status === 'active' && !isMemoryExpired(record, now));
  const ranked = [...active].sort((left, right) => {
    if (left.retention === 'durable' && right.retention !== 'durable') return -1;
    if (right.retention === 'durable' && left.retention !== 'durable') return 1;
    const scoreDifference = scoreMemory(right, now) - scoreMemory(left, now);
    if (scoreDifference !== 0) return scoreDifference;
    return right.updatedAt.getTime() - left.updatedAt.getTime();
  });

  const keep = ranked.slice(0, limit);
  const remove = ranked.slice(limit);
  const protectedPredecessorIds = new Set(
    keep.flatMap(record => record.supersedesId ? [record.supersedesId] : []),
  );
  const protectedPredecessors = records.filter(record => (
    protectedPredecessorIds.has(record.id) &&
    record.status === 'superseded' &&
    !isMemoryExpired(record, now)
  ));
  const inactiveIds = records
    .filter(record => (
      isMemoryExpired(record, now) ||
      (record.status !== 'active' && !protectedPredecessorIds.has(record.id))
    ))
    .map(record => record.id);

  return {
    keepIds: [...keep, ...protectedPredecessors].map(record => record.id),
    removeIds: [...inactiveIds, ...remove.map(record => record.id)],
  };
};
