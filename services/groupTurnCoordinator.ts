import {
  GroupTurnJobSchema,
  type GroupTurnJob,
} from '../contracts/rafiqV6.js';
import { v6Tables } from './v6Tables.js';

export type CoordinatedGroupTurnJob = GroupTurnJob;

export interface GroupTurnJobStore {
  get(id: string): Promise<CoordinatedGroupTurnJob | undefined>;
  put(job: CoordinatedGroupTurnJob): Promise<void>;
  list(): Promise<CoordinatedGroupTurnJob[]>;
}

const dexieStore: GroupTurnJobStore = {
  get: id => v6Tables.groupTurnJobs().get(id),
  put: async job => { await v6Tables.groupTurnJobs().put(job); },
  list: () => v6Tables.groupTurnJobs().toArray(),
};

export interface EnqueueGroupTurnInput {
  groupId: string;
  rootMessageId: string;
  causalMessageId: string;
  triggerDepth: number;
  triggerSenderId: string;
  triggerSenderName?: string;
  triggerText: string;
  replyToMessageId?: string;
  speakerBotId: string;
  attachmentIds?: string[];
  reactionContext?: CoordinatedGroupTurnJob['reactionContext'];
  idempotencyKey: string;
  modelCallBudget?: number;
  estimatedCostMicros?: number;
  maxAttempts?: number;
}

export interface GroupTurnExecutionResult {
  outputMessageId: string;
  modelCallsUsed: number;
  actualCostMicros: number;
}

export type GroupTurnExecutor = (
  job: CoordinatedGroupTurnJob,
  signal: AbortSignal,
) => Promise<GroupTurnExecutionResult>;

export class GroupBudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GroupBudgetExceededError';
  }
}

const isActiveJob = (job: CoordinatedGroupTurnJob): boolean => (
  job.status === 'queued' || job.status === 'running' || job.status === 'completed'
);

const parseCoordinatedJob = (value: CoordinatedGroupTurnJob): CoordinatedGroupTurnJob => {
  const base = GroupTurnJobSchema.parse(value) as CoordinatedGroupTurnJob;
  if (!value.rootMessageId.trim()) throw new Error('Group turn root message ID is required.');
  if (!Number.isInteger(value.triggerDepth) || value.triggerDepth < 0 || value.triggerDepth > 8) {
    throw new Error('Group turn depth must be between 0 and 8.');
  }
  if (!value.triggerSenderId.trim() || !value.triggerText.trim()) {
    throw new Error('Group turn trigger context is required.');
  }
  return {
    ...value,
    ...base,
    rootMessageId: value.rootMessageId.trim(),
    triggerSenderId: value.triggerSenderId.trim(),
    triggerText: value.triggerText.trim().slice(0, 4000),
    attachmentIds: [...new Set(value.attachmentIds || [])].slice(0, 20),
    reactionContext: (value.reactionContext || []).slice(0, 50),
    modelCallsUsed: Math.max(0, Math.floor(value.modelCallsUsed || 0)),
  };
};

export class PersistentGroupTurnCoordinator {
  private readonly runningControllers = new Map<string, AbortController>();
  private readonly runningGroups = new Set<string>();

  constructor(
    private readonly store: GroupTurnJobStore = dexieStore,
    private readonly now: () => Date = () => new Date(),
    private readonly createId: () => string = () => crypto.randomUUID(),
    private readonly maxQueuedPerGroup = 20,
  ) {}

  async enqueue(input: EnqueueGroupTurnInput): Promise<CoordinatedGroupTurnJob> {
    if (input.triggerSenderId === input.speakerBotId) {
      throw new Error('A bot cannot schedule a response to its own message.');
    }
    const allJobs = await this.store.list();
    const duplicate = allJobs.find(job => (
      job.groupId === input.groupId &&
      job.idempotencyKey === input.idempotencyKey &&
      job.status !== 'cancelled' &&
      job.status !== 'failed'
    ));
    if (duplicate) return duplicate;

    const groupQueue = allJobs.filter(job => (
      job.groupId === input.groupId &&
      (job.status === 'queued' || job.status === 'running')
    ));
    if (groupQueue.length >= this.maxQueuedPerGroup) {
      throw new GroupBudgetExceededError('The group turn queue is full.');
    }

    // Group turn budget limits are turned OFF (disabled)
    /*
    const causalJobs = allJobs.filter(job => (
      job.groupId === input.groupId &&
      job.rootMessageId === input.rootMessageId &&
      isActiveJob(job)
    ));
    const primaryCount = causalJobs.filter(job => job.triggerDepth === 0).length;
    const followUpCount = causalJobs.filter(job => job.triggerDepth === 1).length;
    if (causalJobs.length >= 3) {
      throw new GroupBudgetExceededError('This group turn already used its three-message budget.');
    }
    if (input.triggerDepth === 0 && primaryCount >= 2) {
      throw new GroupBudgetExceededError('This group turn already used two primary replies.');
    }
    if (input.triggerDepth === 1 && followUpCount >= 1) {
      throw new GroupBudgetExceededError('This group turn already used its follow-up reply.');
    }
    */

    const timestamp = this.now();
    const job = parseCoordinatedJob({
      id: this.createId(),
      groupId: input.groupId,
      rootMessageId: input.rootMessageId,
      causalMessageId: input.causalMessageId,
      triggerDepth: input.triggerDepth,
      triggerSenderId: input.triggerSenderId,
      triggerSenderName: input.triggerSenderName,
      triggerText: input.triggerText,
      replyToMessageId: input.replyToMessageId,
      speakerBotId: input.speakerBotId,
      attachmentIds: input.attachmentIds || [],
      reactionContext: input.reactionContext || [],
      status: 'queued',
      attempt: 0,
      maxAttempts: input.maxAttempts || 3,
      idempotencyKey: input.idempotencyKey,
      modelCallBudget: input.modelCallBudget || 1,
      modelCallsUsed: 0,
      estimatedCostMicros: input.estimatedCostMicros || 0,
      actualCostMicros: 0,
      runAfter: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await this.store.put(job);
    return job;
  }

  async cancel(jobId: string): Promise<boolean> {
    const job = await this.store.get(jobId);
    if (!job || job.status === 'completed' || job.status === 'cancelled') return false;
    this.runningControllers.get(jobId)?.abort('cancelled');
    await this.store.put(parseCoordinatedJob({
      ...job,
      status: 'cancelled',
      updatedAt: this.now(),
    }));
    return true;
  }

  async cancelGroup(groupId: string): Promise<number> {
    const jobs = (await this.store.list()).filter(job => (
      job.groupId === groupId &&
      (job.status === 'queued' || job.status === 'running')
    ));
    let cancelled = 0;
    for (const job of jobs) {
      if (await this.cancel(job.id)) cancelled += 1;
    }
    return cancelled;
  }

  async runNext(groupId: string, executor: GroupTurnExecutor): Promise<CoordinatedGroupTurnJob | undefined> {
    if (this.runningGroups.has(groupId)) return undefined;
    this.runningGroups.add(groupId);

    try {
      const timestamp = this.now();
      const due = (await this.store.list())
        .filter(job => (
          job.groupId === groupId &&
          job.status === 'queued' &&
          job.runAfter.getTime() <= timestamp.getTime()
        ))
        .sort((left, right) => {
          const runAfterDifference = left.runAfter.getTime() - right.runAfter.getTime();
          return runAfterDifference || left.createdAt.getTime() - right.createdAt.getTime();
        })[0];
      if (!due) return undefined;

      const running = parseCoordinatedJob({
        ...due,
        status: 'running',
        attempt: due.attempt + 1,
        updatedAt: timestamp,
      });
      await this.store.put(running);

      const controller = new AbortController();
      this.runningControllers.set(running.id, controller);
      try {
        const result = await executor(running, controller.signal);
        const latest = await this.store.get(running.id);
        if (latest?.status === 'cancelled' || controller.signal.aborted) return latest;
        if (result.modelCallsUsed > running.modelCallBudget) {
          throw new GroupBudgetExceededError('The executor exceeded the job model-call budget.');
        }
        const completed = parseCoordinatedJob({
          ...running,
          status: 'completed',
          outputMessageId: result.outputMessageId,
          modelCallsUsed: result.modelCallsUsed,
          actualCostMicros: result.actualCostMicros,
          updatedAt: this.now(),
        });
        await this.store.put(completed);
        return completed;
      } catch (error) {
        const latest = await this.store.get(running.id);
        if (latest?.status === 'cancelled' || controller.signal.aborted) return latest;

        const terminal = error instanceof GroupBudgetExceededError || running.attempt >= running.maxAttempts;
        const delaySeconds = terminal ? 0 : Math.min(60, 2 ** (running.attempt - 1));
        const failedOrQueued = parseCoordinatedJob({
          ...running,
          status: terminal ? 'failed' : 'queued',
          runAfter: new Date(this.now().getTime() + delaySeconds * 1000),
          lastError: error instanceof Error ? error.message : String(error),
          updatedAt: this.now(),
        });
        await this.store.put(failedOrQueued);
        return failedOrQueued;
      } finally {
        this.runningControllers.delete(running.id);
      }
    } finally {
      this.runningGroups.delete(groupId);
    }
  }

  async listGroupJobs(groupId: string): Promise<CoordinatedGroupTurnJob[]> {
    return (await this.store.list())
      .filter(job => job.groupId === groupId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }
}

export const persistentGroupTurnCoordinator = new PersistentGroupTurnCoordinator();
