import assert from 'node:assert/strict';
import { buildRafiqTransferV2 } from '../services/transferV2.js';
import {
  TransactionalTransferImporter,
  TransactionalTransferImportError,
  type TransactionalTransferStore,
  type TransferDataset,
  type TransferStageRecord,
} from '../services/transactionalTransferImport.js';

const emptyDataset = (): TransferDataset => ({
  chats: [],
  messages: [],
  lifeStoryEvents: [],
  botStoryEvents: [],
  memories: [],
  attachments: [],
});

class MemoryTransactionalStore implements TransactionalTransferStore {
  state: TransferDataset = emptyDataset();
  stages: TransferStageRecord[] = [];
  mode: 'success' | 'failure' | 'wait-for-abort' = 'success';

  async snapshot(): Promise<TransferDataset> {
    return structuredClone(this.state);
  }

  async apply(transfer: any, context: {
    signal?: AbortSignal;
    onProgress?: (completedUnits: number, totalUnits: number) => void;
  }): Promise<void> {
    const sections: Array<keyof TransferDataset> = [
      'chats',
      'messages',
      'lifeStoryEvents',
      'botStoryEvents',
      'memories',
      'attachments',
    ];
    let completed = 0;
    for (const section of sections) {
      if (context.signal?.aborted) throw new DOMException('cancelled', 'AbortError');
      this.state[section] = [
        ...(this.state[section] as any[]),
        ...(transfer[section] as any[]),
      ] as any;
      completed += 1;
      context.onProgress?.(completed, sections.length);

      if (this.mode === 'failure' && completed === 2) {
        throw new Error('quota exceeded during attachment metadata commit');
      }
      if (this.mode === 'wait-for-abort' && completed === 2) {
        await new Promise(resolve => setTimeout(resolve, 0));
        if (context.signal?.aborted) throw new DOMException('cancelled', 'AbortError');
      }
    }
  }

  async restore(snapshot: TransferDataset): Promise<void> {
    this.state = structuredClone(snapshot);
  }

  async saveStage(record: TransferStageRecord): Promise<void> {
    this.stages.push(structuredClone(record));
  }
}

const createTransfer = () => buildRafiqTransferV2({
  appVersion: 'test',
  chats: [{ id: 'chat-imported', isGroup: false }],
  messages: [{ id: 'message-imported', chatId: 'chat-imported', text: 'hello' }],
  lifeStoryEvents: [],
  botStoryEvents: [],
  memories: [],
  attachments: [],
}, { createdAt: new Date('2026-07-13T12:00:00.000Z') });

let now = new Date('2026-07-13T13:00:00.000Z');
const successStore = new MemoryTransactionalStore();
successStore.state.chats = [{ id: 'chat-existing' }];
const successProgress: number[] = [];
const successImporter = new TransactionalTransferImporter(
  successStore,
  () => new Date(now),
  () => 'stage-success',
);
const success = await successImporter.import(createTransfer(), {
  createRemappedId: (prefix, oldId) => `${prefix}-copy-${oldId}`,
  onProgress: progress => successProgress.push(progress.ratio),
});
assert.equal(success.stageId, 'stage-success');
assert.equal(successStore.state.chats.length, 2);
assert.equal(successStore.state.messages.length, 1);
assert.equal(successStore.stages.at(-1)?.status, 'committed');
assert.equal(successProgress.at(-1), 1);
assert.deepEqual(
  successStore.stages.map(stage => stage.status),
  ['staging', 'validated', 'committing', 'committed'],
);

now = new Date('2026-07-13T14:00:00.000Z');
const failureStore = new MemoryTransactionalStore();
failureStore.state = {
  ...emptyDataset(),
  chats: [{ id: 'chat-before-failure' }],
};
failureStore.mode = 'failure';
const originalFailureState = structuredClone(failureStore.state);
const failureImporter = new TransactionalTransferImporter(
  failureStore,
  () => new Date(now),
  () => 'stage-failure',
);
await assert.rejects(
  failureImporter.import(createTransfer()),
  error => (
    error instanceof TransactionalTransferImportError &&
    error.rolledBack === true &&
    /quota exceeded/.test(error.message)
  ),
);
assert.deepEqual(failureStore.state, originalFailureState, 'partial writes must be rolled back');
assert.equal(failureStore.stages.at(-1)?.status, 'rolled_back');
assert.match(failureStore.stages.at(-1)?.error || '', /quota exceeded/);

now = new Date('2026-07-13T15:00:00.000Z');
const cancelStore = new MemoryTransactionalStore();
cancelStore.state = {
  ...emptyDataset(),
  messages: [{ id: 'message-before-cancel' }],
};
cancelStore.mode = 'wait-for-abort';
const originalCancelState = structuredClone(cancelStore.state);
const cancelImporter = new TransactionalTransferImporter(
  cancelStore,
  () => new Date(now),
  () => 'stage-cancel',
);
const controller = new AbortController();
await assert.rejects(
  cancelImporter.import(createTransfer(), {
    signal: controller.signal,
    onProgress: progress => {
      if (progress.phase === 'commit' && progress.ratio > 0.55 && !controller.signal.aborted) {
        controller.abort();
      }
    },
  }),
  error => (
    error instanceof TransactionalTransferImportError &&
    error.rolledBack === true &&
    error.causeError instanceof DOMException &&
    error.causeError.name === 'AbortError'
  ),
);
assert.deepEqual(cancelStore.state, originalCancelState, 'cancelled import must restore its snapshot');
assert.equal(cancelStore.stages.at(-1)?.status, 'rolled_back');

const malformedStore = new MemoryTransactionalStore();
const malformedImporter = new TransactionalTransferImporter(
  malformedStore,
  () => new Date(now),
  () => 'stage-malformed',
);
await assert.rejects(
  malformedImporter.import({ format: 'wrong' }),
  /schema validation failed/,
);
assert.equal(malformedStore.stages.at(-1)?.status, 'failed');
assert.deepEqual(malformedStore.state, emptyDataset());

console.log('Transactional transfer import tests passed.');
