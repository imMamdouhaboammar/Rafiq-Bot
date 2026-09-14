import type {
  AttachmentRecord,
  BotStoryEvent,
  LifeStoryEvent,
  MemoryRecord,
  RafiqTransferV2,
} from '../contracts/rafiqV6.js';
import {
  prepareTransferV2Import,
  type PreparedTransferImport,
} from './transferV2ImportPlan.js';
import { validateRafiqTransferV2 } from './transferV2.js';

export interface TransferDataset {
  chats: unknown[];
  messages: unknown[];
  lifeStoryEvents: LifeStoryEvent[];
  botStoryEvents: BotStoryEvent[];
  memories: MemoryRecord[];
  attachments: Array<RafiqTransferV2['attachments'][number] | AttachmentRecord>;
}

export interface TransferStageRecord {
  id: string;
  status: 'staging' | 'validated' | 'committing' | 'committed' | 'rolled_back' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  error?: string;
  warnings: string[];
  counts?: RafiqTransferV2['manifest']['counts'];
}

export interface TransactionalTransferStore {
  snapshot(): Promise<TransferDataset>;
  apply(
    transfer: RafiqTransferV2,
    context: {
      signal?: AbortSignal;
      onProgress?: (completedUnits: number, totalUnits: number) => void;
    },
  ): Promise<void>;
  restore(snapshot: TransferDataset): Promise<void>;
  saveStage(record: TransferStageRecord): Promise<void>;
}

export interface TransferImportProgress {
  phase: 'validate' | 'snapshot' | 'prepare' | 'commit' | 'rollback' | 'complete';
  ratio: number;
  message: string;
}

export interface TransactionalTransferImportResult {
  stageId: string;
  prepared: PreparedTransferImport;
}

export class TransactionalTransferImportError extends Error {
  readonly rolledBack: boolean;
  readonly causeError: unknown;

  constructor(message: string, options: { rolledBack: boolean; causeError: unknown }) {
    super(message);
    this.name = 'TransactionalTransferImportError';
    this.rolledBack = options.rolledBack;
    this.causeError = options.causeError;
  }
}

const abortError = (): DOMException => new DOMException('Transfer import cancelled.', 'AbortError');

const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) throw abortError();
};

const readRecordId = (value: unknown): string | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const id = (value as Record<string, unknown>).id;
  return typeof id === 'string' && id.trim() ? id : undefined;
};

const existingIdsFromSnapshot = (snapshot: TransferDataset) => ({
  chatIds: snapshot.chats.map(readRecordId).filter((id): id is string => Boolean(id)),
  messageIds: snapshot.messages.map(readRecordId).filter((id): id is string => Boolean(id)),
  lifeStoryEventIds: snapshot.lifeStoryEvents.map(record => record.id),
  botStoryEventIds: snapshot.botStoryEvents.map(record => record.id),
  memoryIds: snapshot.memories.map(record => record.id),
  attachmentIds: snapshot.attachments.map(record => record.id),
});

const cloneDataset = (dataset: TransferDataset): TransferDataset => structuredClone(dataset);

export class TransactionalTransferImporter {
  constructor(
    private readonly store: TransactionalTransferStore,
    private readonly now: () => Date = () => new Date(),
    private readonly createId: () => string = () => crypto.randomUUID(),
  ) {}

  async import(
    transferInput: unknown,
    options: {
      signal?: AbortSignal;
      onProgress?: (progress: TransferImportProgress) => void;
      createRemappedId?: (prefix: string, oldId: string) => string;
    } = {},
  ): Promise<TransactionalTransferImportResult> {
    const stageId = this.createId();
    const createdAt = this.now();
    let snapshot: TransferDataset | undefined;
    let stage: TransferStageRecord = {
      id: stageId,
      status: 'staging',
      createdAt,
      updatedAt: createdAt,
      warnings: [],
    };
    await this.store.saveStage(stage);

    try {
      options.onProgress?.({ phase: 'validate', ratio: 0.05, message: 'Validating transfer manifest and checksums.' });
      throwIfAborted(options.signal);
      const validated = validateRafiqTransferV2(transferInput);
      stage = {
        ...stage,
        status: 'validated',
        counts: validated.manifest.counts,
        updatedAt: this.now(),
      };
      await this.store.saveStage(stage);

      options.onProgress?.({ phase: 'snapshot', ratio: 0.15, message: 'Creating rollback snapshot.' });
      throwIfAborted(options.signal);
      snapshot = cloneDataset(await this.store.snapshot());

      options.onProgress?.({ phase: 'prepare', ratio: 0.3, message: 'Remapping IDs and group references.' });
      throwIfAborted(options.signal);
      const prepared = prepareTransferV2Import(
        validated,
        existingIdsFromSnapshot(snapshot),
        { createId: options.createRemappedId },
      );
      stage = {
        ...stage,
        warnings: prepared.warnings,
        status: 'committing',
        updatedAt: this.now(),
      };
      await this.store.saveStage(stage);

      options.onProgress?.({ phase: 'commit', ratio: 0.4, message: 'Committing staged records.' });
      throwIfAborted(options.signal);
      await this.store.apply(prepared.transfer, {
        signal: options.signal,
        onProgress: (completedUnits, totalUnits) => {
          const internalRatio = totalUnits <= 0 ? 1 : Math.max(0, Math.min(1, completedUnits / totalUnits));
          options.onProgress?.({
            phase: 'commit',
            ratio: 0.4 + internalRatio * 0.55,
            message: `Committing staged records ${completedUnits}/${totalUnits}.`,
          });
        },
      });
      throwIfAborted(options.signal);

      stage = {
        ...stage,
        status: 'committed',
        updatedAt: this.now(),
      };
      await this.store.saveStage(stage);
      options.onProgress?.({ phase: 'complete', ratio: 1, message: 'Transfer import committed.' });
      return { stageId, prepared };
    } catch (error) {
      if (!snapshot) {
        stage = {
          ...stage,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          updatedAt: this.now(),
        };
        await this.store.saveStage(stage);
        throw error;
      }

      options.onProgress?.({ phase: 'rollback', ratio: 0.97, message: 'Rolling back interrupted import.' });
      let rolledBack = false;
      try {
        await this.store.restore(cloneDataset(snapshot));
        rolledBack = true;
      } catch (rollbackError) {
        stage = {
          ...stage,
          status: 'failed',
          error: `Import failed and rollback also failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
          updatedAt: this.now(),
        };
        await this.store.saveStage(stage);
        throw new TransactionalTransferImportError(stage.error!, {
          rolledBack: false,
          causeError: error,
        });
      }

      stage = {
        ...stage,
        status: 'rolled_back',
        error: error instanceof Error ? error.message : String(error),
        updatedAt: this.now(),
      };
      await this.store.saveStage(stage);
      throw new TransactionalTransferImportError(
        `Transfer import failed and was rolled back: ${stage.error}`,
        { rolledBack, causeError: error },
      );
    }
  }
}
