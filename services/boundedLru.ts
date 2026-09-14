export interface BoundedLruOptions {
  maxEntries: number;
}

export class BoundedLru<K, V> {
  private readonly entries = new Map<K, V>();
  private readonly maxEntries: number;

  constructor(options: BoundedLruOptions) {
    if (!Number.isInteger(options.maxEntries) || options.maxEntries < 1) {
      throw new Error('BoundedLru maxEntries must be a positive integer.');
    }
    this.maxEntries = options.maxEntries;
  }

  get size(): number {
    return this.entries.size;
  }

  has(key: K): boolean {
    return this.entries.has(key);
  }

  get(key: K): V | undefined {
    const value = this.entries.get(key);
    if (value === undefined) return undefined;

    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(key: K, value: V): this {
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, value);

    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as K | undefined;
      if (oldestKey === undefined) break;
      this.entries.delete(oldestKey);
    }

    return this;
  }

  delete(key: K): boolean {
    return this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  entriesSnapshot(): Array<[K, V]> {
    return Array.from(this.entries.entries());
  }
}
