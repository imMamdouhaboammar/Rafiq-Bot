import {
  BotStoryEventSchema,
  LifeStoryEventSchema,
  StorySignalSchema,
  type BotStoryEvent,
  type LifeStoryEvent,
  type StoryAcl,
  type StorySignal,
} from '../contracts/rafiqV6.js';
import { v6Tables } from './v6Tables.js';

export interface StoryStore<T extends { id?: string }> {
  get(id: string): Promise<T | undefined>;
  put(value: T): Promise<void>;
  delete(id: string): Promise<void>;
  list(): Promise<T[]>;
  deleteWhere(predicate: (value: T) => boolean): Promise<void>;
}

const createDexieStore = <T extends { id?: string }>(
  getTable: () => {
    get(id: string): Promise<T | undefined>;
    put(value: T): Promise<unknown>;
    delete(id: string): Promise<void>;
    toArray(): Promise<T[]>;
    bulkDelete(ids: string[]): Promise<void>;
  },
): StoryStore<T> => ({
  get: id => getTable().get(id),
  put: async value => { await getTable().put(value); },
  delete: id => getTable().delete(id),
  list: () => getTable().toArray(),
  deleteWhere: async predicate => {
    const matches = (await getTable().toArray())
      .filter(predicate)
      .flatMap(value => value.id ? [value.id] : []);
    if (matches.length > 0) await getTable().bulkDelete(matches);
  },
});

export interface StoryRepositoryDependencies {
  lifeEvents: StoryStore<LifeStoryEvent>;
  signals: StoryStore<StorySignal>;
  botEvents: StoryStore<BotStoryEvent>;
  now: () => Date;
  createId: () => string;
}

const defaultDependencies = (): StoryRepositoryDependencies => ({
  lifeEvents: createDexieStore(v6Tables.lifeStoryEvents),
  signals: createDexieStore(v6Tables.storySignals),
  botEvents: createDexieStore(v6Tables.botStoryEvents),
  now: () => new Date(),
  createId: () => crypto.randomUUID(),
});

export interface CreateLifeStoryEventInput {
  title: string;
  summary: string;
  happenedAt: Date | string;
  acl: StoryAcl;
  sensitivity?: LifeStoryEvent['sensitivity'];
  source?: LifeStoryEvent['source'];
}

export interface CreateBotStoryEventInput {
  botId: string;
  title: string;
  summary: string;
  kind: BotStoryEvent['kind'];
  sourceMessageIds?: string[];
  sourceGroupId?: string;
  confidence: number;
  acl: StoryAcl;
}

export class StoryRepository {
  constructor(private readonly dependencies: StoryRepositoryDependencies = defaultDependencies()) {}

  async listLifeEvents(): Promise<LifeStoryEvent[]> {
    return (await this.dependencies.lifeEvents.list())
      .sort((left, right) => right.happenedAt.getTime() - left.happenedAt.getTime());
  }

  async createLifeEvent(input: CreateLifeStoryEventInput): Promise<LifeStoryEvent> {
    const now = this.dependencies.now();
    const event = LifeStoryEventSchema.parse({
      id: this.dependencies.createId(),
      userId: 'main_user',
      title: input.title,
      summary: input.summary,
      happenedAt: input.happenedAt,
      createdAt: now,
      updatedAt: now,
      acl: input.acl,
      sensitivity: input.sensitivity || 'normal',
      source: input.source || 'user_entered',
    });
    await this.dependencies.lifeEvents.put(event);
    return event;
  }

  async updateLifeEvent(
    id: string,
    patch: Partial<Pick<LifeStoryEvent, 'title' | 'summary' | 'happenedAt' | 'acl' | 'sensitivity'>>,
  ): Promise<LifeStoryEvent> {
    const current = await this.dependencies.lifeEvents.get(id);
    if (!current) throw new Error('Life story event not found.');
    const updated = LifeStoryEventSchema.parse({
      ...current,
      ...patch,
      id: current.id,
      userId: 'main_user',
      createdAt: current.createdAt,
      updatedAt: this.dependencies.now(),
    });
    await this.dependencies.lifeEvents.put(updated);

    const signals = await this.dependencies.signals.list();
    for (const signal of signals.filter(candidate => candidate.eventId === id)) {
      await this.dependencies.signals.put(StorySignalSchema.parse({
        ...signal,
        acl: updated.acl,
        sensitivity: updated.sensitivity,
      }));
    }
    return updated;
  }

  async deleteLifeEvent(id: string): Promise<void> {
    await this.dependencies.lifeEvents.delete(id);
    await this.dependencies.signals.deleteWhere(signal => signal.eventId === id);
  }

  async replaceSignals(eventId: string, signalInputs: Array<Pick<StorySignal, 'text' | 'salience' | 'expiresAt'>>): Promise<StorySignal[]> {
    const event = await this.dependencies.lifeEvents.get(eventId);
    if (!event) throw new Error('Life story event not found.');
    await this.dependencies.signals.deleteWhere(signal => signal.eventId === eventId);

    const now = this.dependencies.now();
    const signals = signalInputs.slice(0, 12).map(input => StorySignalSchema.parse({
      id: this.dependencies.createId(),
      eventId,
      text: input.text,
      salience: input.salience,
      sensitivity: event.sensitivity,
      acl: event.acl,
      createdAt: now,
      expiresAt: input.expiresAt,
    }));
    for (const signal of signals) await this.dependencies.signals.put(signal);
    return signals;
  }

  async listBotEvents(botId: string, includeImaginary = true): Promise<BotStoryEvent[]> {
    return (await this.dependencies.botEvents.list())
      .filter(event => event.botId === botId && event.status !== 'deleted')
      .filter(event => includeImaginary || event.kind !== 'imaginary')
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  }

  async createBotEvent(input: CreateBotStoryEventInput): Promise<BotStoryEvent> {
    const now = this.dependencies.now();
    const event = BotStoryEventSchema.parse({
      id: this.dependencies.createId(),
      botId: input.botId,
      title: input.title,
      summary: input.summary,
      kind: input.kind,
      sourceMessageIds: input.sourceMessageIds || [],
      sourceGroupId: input.sourceGroupId,
      confidence: input.confidence,
      status: 'active',
      acl: input.acl,
      createdAt: now,
      updatedAt: now,
    });
    await this.dependencies.botEvents.put(event);
    return event;
  }

  async correctBotEvent(
    id: string,
    correction: Pick<CreateBotStoryEventInput, 'title' | 'summary' | 'confidence' | 'acl'> & { sourceMessageIds: string[] },
  ): Promise<BotStoryEvent> {
    const current = await this.dependencies.botEvents.get(id);
    if (!current) throw new Error('Bot story event not found.');
    const now = this.dependencies.now();
    const superseded = BotStoryEventSchema.parse({
      ...current,
      status: 'superseded',
      updatedAt: now,
    });
    const replacement = BotStoryEventSchema.parse({
      id: this.dependencies.createId(),
      botId: current.botId,
      title: correction.title,
      summary: correction.summary,
      kind: current.kind,
      sourceMessageIds: correction.sourceMessageIds.length > 0
        ? correction.sourceMessageIds
        : current.sourceMessageIds,
      sourceGroupId: current.sourceGroupId,
      confidence: correction.confidence,
      status: 'active',
      supersedesId: current.id,
      acl: correction.acl,
      createdAt: now,
      updatedAt: now,
    });
    await this.dependencies.botEvents.put(superseded);
    await this.dependencies.botEvents.put(replacement);
    return replacement;
  }

  async deleteBotEvent(id: string): Promise<void> {
    const current = await this.dependencies.botEvents.get(id);
    if (!current) return;
    await this.dependencies.botEvents.put(BotStoryEventSchema.parse({
      ...current,
      status: 'deleted',
      updatedAt: this.dependencies.now(),
    }));
  }
}

export const storyRepository = new StoryRepository();
