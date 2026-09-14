import {
  SocialAgencySchema,
  type SocialAgency,
} from '../contracts/rafiqV6.js';
import {
  buildDefaultSocialAgencyRecord,
  type SocialAgencyRecord,
} from './dbV6Migration.js';
import { v6Tables } from './v6Tables.js';

export interface SocialAgencyStore {
  get(botId: string): Promise<SocialAgencyRecord | undefined>;
  put(record: SocialAgencyRecord): Promise<void>;
}

const dexieStore: SocialAgencyStore = {
  get: botId => v6Tables.socialAgency().get(botId),
  put: async record => { await v6Tables.socialAgency().put(record); },
};

export class SocialAgencyRepository {
  constructor(
    private readonly store: SocialAgencyStore = dexieStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async get(botId: string): Promise<SocialAgencyRecord> {
    const normalizedBotId = botId.trim();
    if (!normalizedBotId) throw new Error('Bot ID is required.');
    const existing = await this.store.get(normalizedBotId);
    if (existing) {
      return {
        botId: normalizedBotId,
        ...SocialAgencySchema.parse(existing),
        updatedAt: new Date(existing.updatedAt),
      };
    }
    const created = buildDefaultSocialAgencyRecord(normalizedBotId, this.now());
    await this.store.put(created);
    return created;
  }

  async save(
    botId: string,
    settings: SocialAgency,
  ): Promise<SocialAgencyRecord> {
    const normalizedBotId = botId.trim();
    if (!normalizedBotId) throw new Error('Bot ID is required.');
    const parsed = SocialAgencySchema.parse(settings);
    const record: SocialAgencyRecord = {
      botId: normalizedBotId,
      ...parsed,
      updatedAt: this.now(),
    };
    await this.store.put(record);
    return record;
  }

  async patch(
    botId: string,
    patch: Partial<SocialAgency>,
  ): Promise<SocialAgencyRecord> {
    const current = await this.get(botId);
    return this.save(botId, SocialAgencySchema.parse({
      ...current,
      ...patch,
      quietHours: {
        ...current.quietHours,
        ...(patch.quietHours || {}),
      },
    }));
  }
}

export const socialAgencyRepository = new SocialAgencyRepository();
