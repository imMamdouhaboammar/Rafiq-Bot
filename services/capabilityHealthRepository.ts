import {
  CapabilityHealthSchema,
  type CapabilityHealth,
} from '../contracts/rafiqV6.js';
import {
  deriveCapabilityHealth,
  type CapabilityRequirement,
  type CapabilityTestResult,
} from './capabilityHealth.js';
import { v6Tables } from './v6Tables.js';

export interface CapabilityHealthStore {
  get(capability: CapabilityHealth['capability']): Promise<CapabilityHealth | undefined>;
  put(record: CapabilityHealth): Promise<void>;
  list(): Promise<CapabilityHealth[]>;
}

const dexieStore: CapabilityHealthStore = {
  get: capability => v6Tables.capabilityHealth().get(capability),
  put: async record => { await v6Tables.capabilityHealth().put(record); },
  list: () => v6Tables.capabilityHealth().toArray(),
};

export interface CapabilityProbe {
  capability: CapabilityHealth['capability'];
  requirements: () => CapabilityRequirement[];
  run: () => Promise<Omit<CapabilityTestResult, 'checkedAt'>>;
}

export class CapabilityHealthRepository {
  constructor(
    private readonly store: CapabilityHealthStore = dexieStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(): Promise<CapabilityHealth[]> {
    return (await this.store.list()).sort((left, right) => (
      left.capability.localeCompare(right.capability)
    ));
  }

  async get(capability: CapabilityHealth['capability']): Promise<CapabilityHealth | undefined> {
    return this.store.get(capability);
  }

  async save(record: CapabilityHealth): Promise<CapabilityHealth> {
    const parsed = CapabilityHealthSchema.parse(record);
    await this.store.put(parsed);
    return parsed;
  }

  async evaluateConfiguration(
    capability: CapabilityHealth['capability'],
    requirements: CapabilityRequirement[],
  ): Promise<CapabilityHealth> {
    const previous = await this.store.get(capability);
    return this.save(deriveCapabilityHealth({
      capability,
      requirements,
      lastSuccessAt: previous?.lastSuccessAt,
    }));
  }

  async runProbe(probe: CapabilityProbe): Promise<CapabilityHealth> {
    const requirements = probe.requirements();
    const previous = await this.store.get(probe.capability);
    if (requirements.some(requirement => !requirement.present)) {
      return this.save(deriveCapabilityHealth({
        capability: probe.capability,
        requirements,
        lastSuccessAt: previous?.lastSuccessAt,
      }));
    }

    let testResult: CapabilityTestResult;
    try {
      const result = await probe.run();
      testResult = {
        ...result,
        checkedAt: this.now(),
      };
    } catch (error) {
      testResult = {
        ok: false,
        checkedAt: this.now(),
        kind: 'staging',
        reason: error instanceof Error ? error.message : String(error),
      };
    }

    return this.save(deriveCapabilityHealth({
      capability: probe.capability,
      requirements,
      testResult,
      lastSuccessAt: previous?.lastSuccessAt,
    }));
  }
}

export const capabilityHealthRepository = new CapabilityHealthRepository();
