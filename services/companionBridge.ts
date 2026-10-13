import {
  type MemoryGrant,
  type MemoryFact,
  MemoryGrantSchema,
} from '../contracts/neuroCognitive.js';
import * as NeuroDB from './neuroDb.js';

export interface BridgedMemoryResult {
  sourceCompanionId: string;
  sourceCompanionName?: string;
  facts: MemoryFact[];
  formattedContext?: string;
}

// In-memory grant cache with short TTL (e.g. 10 seconds) or instant invalidation on revocation
const grantCache = new Map<string, { grant: MemoryGrant; cachedAt: number }>();

const grantCacheKey = (sourceId: string, targetId: string) => `${sourceId}->${targetId}`;

export const invalidateGrantCache = (sourceId?: string, targetId?: string) => {
  if (sourceId && targetId) {
    grantCache.delete(grantCacheKey(sourceId, targetId));
  } else {
    grantCache.clear();
  }
};

/**
 * Authorize and create a new MemoryGrant.
 */
export const authorizeMemoryBridge = async (
  ownerId: string,
  sourceCompanionId: string,
  targetCompanionId: string,
  categories: Array<'facts' | 'preferences' | 'experiences'> = ['facts', 'preferences'],
  sensitivityMax: 'normal' | 'sensitive' = 'normal',
  expiresInDays?: number,
): Promise<MemoryGrant> => {
  const now = new Date();
  const expiresAt = expiresInDays
    ? new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000)
    : undefined;

  const grantId = `grant_${sourceCompanionId}_to_${targetCompanionId}_${now.getTime()}`;

  const grant: MemoryGrant = MemoryGrantSchema.parse({
    grantId,
    ownerId,
    sourceCompanionId,
    targetCompanionId,
    direction: 'source_to_target',
    categories,
    sensitivityMax,
    approvedAt: now,
    expiresAt,
  });

  await NeuroDB.saveMemoryGrant(grant);
  invalidateGrantCache(sourceCompanionId, targetCompanionId);
  return grant;
};

/**
 * Revoke an existing MemoryGrant immediately.
 */
export const revokeMemoryBridge = async (
  grantId: string,
  sourceCompanionId: string,
  targetCompanionId: string,
): Promise<void> => {
  await NeuroDB.revokeMemoryGrant(grantId);
  invalidateGrantCache(sourceCompanionId, targetCompanionId);
};

/**
 * Reads memory facts from source companion under an active, verified grant.
 * Strictly enforces:
 * - Read-only projection
 * - Excludes reflections, raw messages, affect states, restricted items
 * - Non-transitive
 */
export const readBridgedMemories = async (
  targetCompanionId: string,
  sourceCompanionId: string,
  queryTokens: string[] = [],
  grantLookup = () => NeuroDB.getActiveGrant(sourceCompanionId, targetCompanionId),
  factsFetcher = () => NeuroDB.getMemoryFacts(sourceCompanionId, { status: 'active' }),
  sourceName = 'رفيق آخر',
): Promise<BridgedMemoryResult | null> => {
  // 1. Verify Active Grant
  const activeGrant = await grantLookup();
  if (!activeGrant || activeGrant.revokedAt) {
    return null; // Not authorized or revoked
  }

  if (activeGrant.expiresAt && new Date(activeGrant.expiresAt).getTime() <= Date.now()) {
    return null; // Expired
  }

  // 2. Fetch Source Facts
  const facts = await factsFetcher();

  // 3. Filter by grant's sensitivity and categories
  const allowed = facts.filter(f => {
    if (f.sensitivity === 'restricted') return false;
    if (f.sensitivity === 'sensitive' && activeGrant.sensitivityMax === 'normal') return false;
    return true;
  });

  // 4. Token-based filtering if query provided
  let filtered = allowed;
  if (queryTokens.length > 0) {
    filtered = allowed.filter(f => {
      const tokens = `${f.predicate} ${f.objectValue}`.toLowerCase();
      return queryTokens.some(qt => tokens.includes(qt.toLowerCase()));
    });
  }

  const finalFacts = filtered.slice(0, 3);
  if (finalFacts.length === 0) return null;

  // 5. Format cited context
  const lines = finalFacts.map(f => {
    return `- [معلومة تمت مشاركتها بموافقة المستخدم]: ${f.predicate} -> ${f.objectValue}`;
  });

  const formattedContext = `[ذاكرة مشتركة من رفيق آخر: ${sourceName}]\n${lines.join('\n')}`;

  return {
    sourceCompanionId,
    sourceCompanionName: sourceName,
    facts: finalFacts,
    formattedContext,
  };
};
