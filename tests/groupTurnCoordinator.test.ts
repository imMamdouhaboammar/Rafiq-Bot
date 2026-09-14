import assert from 'node:assert/strict';
import type { CoordinatedGroupTurnJob, GroupTurnJobStore } from '../services/groupTurnCoordinator.js';
import {
  GroupBudgetExceededError,
  PersistentGroupTurnCoordinator,
} from '../services/groupTurnCoordinator.js';

const values = new Map<string, CoordinatedGroupTurnJob>();
const store: GroupTurnJobStore = {
  get: async id => values.get(id),
  put: async job => { values.set(job.id, structuredClone(job)); },
  list: async () => Array.from(values.values()).map(job => structuredClone(job)),
};
let now = new Date('2026-07-13T12:00:00.000Z');
let idCounter = 0;
const coordinator = new PersistentGroupTurnCoordinator(
  store,
  () => new Date(now),
  () => `job-${++idCounter}`,
  20,
);

const baseInput = {
  groupId: 'group-a',
  rootMessageId: 'root-1',
  causalMessageId: 'message-user',
  triggerDepth: 0 as const,
  triggerSenderId: 'user',
  triggerSenderName: 'Mamdouh',
  triggerText: 'إيه رأيكم في الخطة؟',
  speakerBotId: 'bot-a',
  attachmentIds: ['attachment-1'],
  reactionContext: [{ messageId: 'previous', senderId: 'bot-b', emoji: '👍' }],
  idempotencyKey: 'group-a:root-1:bot-a',
  modelCallBudget: 1,
};

const first = await coordinator.enqueue(baseInput);
assert.equal(first.status, 'queued');
assert.equal(first.triggerText, 'إيه رأيكم في الخطة؟');
assert.deepEqual(first.attachmentIds, ['attachment-1']);

const duplicate = await coordinator.enqueue(baseInput);
assert.equal(duplicate.id, first.id, 'duplicate idempotency key must return the existing job');
assert.equal(values.size, 1);

const second = await coordinator.enqueue({
  ...baseInput,
  speakerBotId: 'bot-b',
  idempotencyKey: 'group-a:root-1:bot-b',
});
assert.notEqual(second.id, first.id);

const followUp = await coordinator.enqueue({
  ...baseInput,
  causalMessageId: 'message-bot-a',
  triggerDepth: 1,
  triggerSenderId: 'bot-a',
  speakerBotId: 'bot-b',
  idempotencyKey: 'group-a:root-1:follow-up:bot-b',
});
assert.equal(followUp.triggerDepth, 1);

const continuedThread = await coordinator.enqueue({
  ...baseInput,
  causalMessageId: 'message-bot-b',
  triggerDepth: 2,
  triggerSenderId: 'bot-b',
  speakerBotId: 'bot-c',
  idempotencyKey: 'group-a:root-1:continued-thread:bot-c',
});
assert.equal(continuedThread.triggerDepth, 2, 'Persisted jobs must support continued bot-to-bot threads');

const third = await coordinator.enqueue({
  ...baseInput,
  speakerBotId: 'bot-c',
  idempotencyKey: 'group-a:root-1:bot-c',
});
assert.equal(third.status, 'queued');

await assert.rejects(
  coordinator.enqueue({
    ...baseInput,
    rootMessageId: 'root-self',
    triggerSenderId: 'bot-a',
    speakerBotId: 'bot-a',
    idempotencyKey: 'self-response',
  }),
  /cannot schedule a response to its own message/,
);

const completed = await coordinator.runNext('group-a', async (job, signal) => {
  assert.equal(signal.aborted, false);
  assert.equal(job.id, first.id);
  return {
    outputMessageId: 'output-1',
    modelCallsUsed: 1,
    actualCostMicros: 350,
  };
});
assert.equal(completed?.status, 'completed');
assert.equal(completed?.outputMessageId, 'output-1');
assert.equal(completed?.actualCostMicros, 350);

values.clear();
idCounter = 0;
now = new Date('2026-07-13T13:00:00.000Z');
const retryCoordinator = new PersistentGroupTurnCoordinator(
  store,
  () => new Date(now),
  () => `retry-${++idCounter}`,
);
const retryJob = await retryCoordinator.enqueue({
  ...baseInput,
  rootMessageId: 'root-retry',
  idempotencyKey: 'retry-key',
  maxAttempts: 3,
});
let attempts = 0;
const firstAttempt = await retryCoordinator.runNext('group-a', async () => {
  attempts += 1;
  throw new Error('temporary provider failure');
});
assert.equal(firstAttempt?.status, 'queued');
assert.equal(firstAttempt?.attempt, 1);
assert.equal(firstAttempt?.runAfter.toISOString(), '2026-07-13T13:00:01.000Z');
assert.equal(await retryCoordinator.runNext('group-a', async () => {
  throw new Error('must not run before backoff');
}), undefined);

now = new Date('2026-07-13T13:00:01.000Z');
const retried = await retryCoordinator.runNext('group-a', async () => {
  attempts += 1;
  return { outputMessageId: 'output-retry', modelCallsUsed: 1, actualCostMicros: 100 };
});
assert.equal(retried?.status, 'completed');
assert.equal(retried?.attempt, 2);
assert.equal(attempts, 2);

values.clear();
const cancellable = await retryCoordinator.enqueue({
  ...baseInput,
  rootMessageId: 'root-cancel',
  idempotencyKey: 'cancel-key',
});
assert.equal(await retryCoordinator.cancel(cancellable.id), true);
assert.equal((await store.get(cancellable.id))?.status, 'cancelled');
assert.equal(await retryCoordinator.cancel(cancellable.id), false);
assert.equal(await retryCoordinator.runNext('group-a', async () => {
  throw new Error('cancelled jobs must not execute');
}), undefined);

values.clear();
const budgetJob = await retryCoordinator.enqueue({
  ...baseInput,
  rootMessageId: 'root-budget',
  idempotencyKey: 'budget-key',
  modelCallBudget: 1,
});
const overBudget = await retryCoordinator.runNext('group-a', async () => ({
  outputMessageId: 'output-over-budget',
  modelCallsUsed: 2,
  actualCostMicros: 500,
}));
assert.equal(overBudget?.id, budgetJob.id);
assert.equal(overBudget?.status, 'failed');
assert.match(overBudget?.lastError || '', /exceeded/);

values.clear();
const smallQueue = new PersistentGroupTurnCoordinator(store, () => new Date(now), () => crypto.randomUUID(), 1);
await smallQueue.enqueue({ ...baseInput, rootMessageId: 'root-q1', idempotencyKey: 'q1' });
await assert.rejects(
  smallQueue.enqueue({ ...baseInput, rootMessageId: 'root-q2', idempotencyKey: 'q2' }),
  /queue is full/,
);

console.log('Persistent group turn coordinator tests passed.');
