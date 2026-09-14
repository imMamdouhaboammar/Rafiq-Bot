export interface BoundedAsyncQueueOptions {
  maxPending: number;
  onError?: (error: unknown, key: string) => void;
}

interface QueueEntry {
  key: string;
  task: () => Promise<void>;
}

export class BoundedAsyncQueue {
  private readonly maxPending: number;
  private readonly onError?: (error: unknown, key: string) => void;
  private readonly pending: QueueEntry[] = [];
  private readonly keys = new Set<string>();
  private runningKey: string | null = null;
  private processing = false;

  constructor(options: BoundedAsyncQueueOptions) {
    if (!Number.isInteger(options.maxPending) || options.maxPending < 1) {
      throw new Error('BoundedAsyncQueue maxPending must be a positive integer.');
    }
    this.maxPending = options.maxPending;
    this.onError = options.onError;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  get activeKey(): string | null {
    return this.runningKey;
  }

  has(key: string): boolean {
    return this.runningKey === key || this.keys.has(key);
  }

  enqueue(key: string, task: () => Promise<void>): boolean {
    const normalizedKey = key.trim();
    if (!normalizedKey) throw new Error('Queue key is required.');
    if (this.has(normalizedKey)) return false;
    if (this.pending.length >= this.maxPending) return false;

    this.pending.push({ key: normalizedKey, task });
    this.keys.add(normalizedKey);
    void this.process();
    return true;
  }

  cancel(key: string): boolean {
    const index = this.pending.findIndex(entry => entry.key === key);
    if (index < 0) return false;
    this.pending.splice(index, 1);
    this.keys.delete(key);
    return true;
  }

  clear(): void {
    this.pending.length = 0;
    this.keys.clear();
  }

  private async process(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      while (this.pending.length > 0) {
        const entry = this.pending.shift()!;
        this.keys.delete(entry.key);
        this.runningKey = entry.key;
        try {
          await entry.task();
        } catch (error) {
          this.onError?.(error, entry.key);
        } finally {
          this.runningKey = null;
        }
      }
    } finally {
      this.processing = false;
    }
  }
}
