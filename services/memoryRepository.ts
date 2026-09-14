import {
  MemoryRecordSchema,
  type MemoryRecord,
  type MemoryScope,
} from '../contracts/rafiqV6.js';
import {
  calculateMemoryExpiry,
  inferMemoryRetention,
  planMemoryCompaction,
} from './memoryPolicy.js';
import { v6Tables } from './v6Tables.js';

export interface MemoryStore {
  get(id: string): Promise<MemoryRecord | undefined>;
  put(record: MemoryRecord): Promise<void>;
  bulkPut(records: MemoryRecord[]): Promise<void>;
  list(): Promise<MemoryRecord[]>;
}

const dexieMemoryStore: MemoryStore = {
  get: id => v6Tables.memoryRecords().get(id),
  put: async record => { await v6Tables.memoryRecords().put(record); },
  bulkPut: async records => { await v6Tables.memoryRecords().bulkPut(records); },
  list: () => v6Tables.memoryRecords().toArray(),
};

export interface CreateMemoryInput {
  scope: MemoryScope;
  scopeId: string;
  text: string;
  summary?: string;
  category: MemoryRecord['category'];
  provenance: MemoryRecord['provenance'];
  confidence: number;
  salience: number;
  sensitivity?: MemoryRecord['sensitivity'];
  retention?: MemoryRecord['retention'];
}

export interface MemoryQuery {
  scopes?: MemoryScope[];
  scopeId?: string;
  category?: MemoryRecord['category'];
  status?: MemoryRecord['status'];
  sourceId?: string;
  text?: string;
}

const normalizeText = (value: string): string => (
  value.toLocaleLowerCase('ar').replace(/\s+/g, ' ').trim()
);

export class MemoryRepository {
  constructor(
    private readonly store: MemoryStore = dexieMemoryStore,
    private readonly now: () => Date = () => new Date(),
    private readonly createId: () => string = () => crypto.randomUUID(),
  ) {}

  async list(query: MemoryQuery = {}): Promise<MemoryRecord[]> {
    const textNeedle = query.text ? normalizeText(query.text) : undefined;
    return (await this.store.list())
      .filter(record => !query.scopes || query.scopes.includes(record.scope))
      .filter(record => !query.scopeId || record.scopeId === query.scopeId)
      .filter(record => !query.category || record.category === query.category)
      .filter(record => !query.status || record.status === query.status)
      .filter(record => !query.sourceId || record.provenance.sourceIds.includes(query.sourceId))
      .filter(record => !textNeedle || normalizeText(`${record.summary} ${record.text}`).includes(textNeedle))
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  }

  async create(input: CreateMemoryInput): Promise<MemoryRecord> {
    const now = this.now();
    const retention = input.retention || inferMemoryRetention(input.category);
    const record = MemoryRecordSchema.parse({
      id: this.createId(),
      ownerUserId: 'main_user',
      scope: input.scope,
      scopeId: input.scopeId,
      text: input.text,
      summary: (input.summary || input.text).slice(0, 600),
      category: input.category,
      provenance: input.provenance,
      confidence: input.confidence,
      salience: input.salience,
      sensitivity: input.sensitivity || 'normal',
      retention,
      expiresAt: calculateMemoryExpiry(retention, now),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    await this.store.put(record);
    await this.compactScope(record.scope, record.scopeId);
    return record;
  }

  async update(
    id: string,
    patch: Partial<Pick<MemoryRecord, 'text' | 'summary' | 'category' | 'confidence' | 'salience' | 'sensitivity' | 'retention'>>,
  ): Promise<MemoryRecord> {
    const current = await this.store.get(id);
    if (!current) throw new Error('Memory record not found.');
    const retention = patch.retention || current.retention;
    const updated = MemoryRecordSchema.parse({
      ...current,
      ...patch,
      id: current.id,
      ownerUserId: 'main_user',
      expiresAt: calculateMemoryExpiry(retention, current.createdAt),
      updatedAt: this.now(),
    });
    await this.store.put(updated);
    return updated;
  }

  async correctEverywhere({
    sourceIds,
    text,
    replacement,
  }: {
    sourceIds?: string[];
    text?: string;
    replacement: Omit<CreateMemoryInput, 'scope' | 'scopeId' | 'provenance'> & {
      provenanceSourceIds: string[];
      fallbackScope?: { scope: MemoryScope; scopeId: string };
    };
  }): Promise<MemoryRecord[]> {
    const sourceIdSet = new Set(sourceIds || []);
    const normalizedTarget = text ? normalizeText(text) : undefined;
    const records = await this.store.list();
    const matches = records.filter(record => (
      record.status === 'active' &&
      (
        (sourceIdSet.size > 0 && record.provenance.sourceIds.some(id => sourceIdSet.has(id))) ||
        (normalizedTarget && normalizeText(record.text) === normalizedTarget)
      )
    ));

    const now = this.now();
    const superseded = matches.map(record => MemoryRecordSchema.parse({
      ...record,
      status: 'superseded',
      updatedAt: now,
    }));
    const targets = matches.length > 0
      ? Array.from(new Map(matches.map(record => [`${record.scope}:${record.scopeId}`, {
          scope: record.scope,
          scopeId: record.scopeId,
        }])).values())
      : replacement.fallbackScope ? [replacement.fallbackScope] : [];

    if (targets.length === 0) {
      throw new Error('Correction did not match any memory and no fallback scope was provided.');
    }

    const created = targets.map(target => {
      const retention = replacement.retention || inferMemoryRetention(replacement.category);
      const supersededInScope = matches.find(record => (
        record.scope === target.scope && record.scopeId === target.scopeId
      ));
      return MemoryRecordSchema.parse({
        id: this.createId(),
        ownerUserId: 'main_user',
        scope: target.scope,
        scopeId: target.scopeId,
        text: replacement.text,
        summary: (replacement.summary || replacement.text).slice(0, 600),
        category: replacement.category,
        provenance: {
          kind: 'correction',
          sourceIds: replacement.provenanceSourceIds,
          observedAt: now,
        },
        confidence: replacement.confidence,
        salience: replacement.salience,
        sensitivity: replacement.sensitivity || 'normal',
        retention,
        expiresAt: calculateMemoryExpiry(retention, now),
        status: 'active',
        supersedesId: supersededInScope?.id,
        createdAt: now,
        updatedAt: now,
      });
    });

    await this.store.bulkPut([...superseded, ...created]);
    for (const target of targets) await this.compactScope(target.scope, target.scopeId);
    return created;
  }

  async forgetEverywhere({
    ids,
    sourceIds,
    text,
  }: {
    ids?: string[];
    sourceIds?: string[];
    text?: string;
  }): Promise<number> {
    const idSet = new Set(ids || []);
    const sourceIdSet = new Set(sourceIds || []);
    const normalizedTarget = text ? normalizeText(text) : undefined;
    const now = this.now();
    const matches = (await this.store.list()).filter(record => (
      record.status !== 'forgotten' &&
      (
        idSet.has(record.id) ||
        record.provenance.sourceIds.some(id => sourceIdSet.has(id)) ||
        (normalizedTarget && normalizeText(record.text) === normalizedTarget) ||
        (record.supersedesId && idSet.has(record.supersedesId))
      )
    ));
    if (matches.length === 0) return 0;

    await this.store.bulkPut(matches.map(record => MemoryRecordSchema.parse({
      ...record,
      status: 'forgotten',
      text: '[forgotten]',
      summary: '[forgotten]',
      updatedAt: now,
    })));
    return matches.length;
  }

  async compactScope(scope: MemoryScope, scopeId: string): Promise<number> {
    const records = (await this.store.list()).filter(record => (
      record.scope === scope && record.scopeId === scopeId
    ));
    const plan = planMemoryCompaction(records, this.now());
    if (plan.removeIds.length === 0) return 0;
    const removalSet = new Set(plan.removeIds);
    const updated = records
      .filter(record => removalSet.has(record.id) && record.status !== 'forgotten')
      .map(record => MemoryRecordSchema.parse({
        ...record,
        status: 'forgotten',
        text: '[compacted]',
        summary: '[compacted]',
        updatedAt: this.now(),
      }));
    if (updated.length > 0) await this.store.bulkPut(updated);
    return updated.length;
  }
}

export const memoryRepository = new MemoryRepository();
