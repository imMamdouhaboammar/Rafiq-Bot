export interface GenerationLease {
  generation: number;
  signal: AbortSignal;
  isCurrent: () => boolean;
  throwIfStale: () => void;
}

export class StaleGenerationError extends Error {
  constructor() {
    super('The async operation belongs to a stale chat generation.');
    this.name = 'StaleGenerationError';
  }
}

export class AsyncGenerationGuard {
  private generation = 0;
  private controller = new AbortController();

  get currentGeneration(): number {
    return this.generation;
  }

  begin(): GenerationLease {
    const generation = this.generation;
    const signal = this.controller.signal;
    const isCurrent = () => (
      generation === this.generation &&
      signal.aborted === false
    );

    return {
      generation,
      signal,
      isCurrent,
      throwIfStale: () => {
        if (!isCurrent()) throw new StaleGenerationError();
      },
    };
  }

  advance(reason = 'generation_changed'): number {
    this.controller.abort(reason);
    this.generation += 1;
    this.controller = new AbortController();
    return this.generation;
  }

  cancel(reason = 'cancelled'): void {
    this.controller.abort(reason);
  }
}

export const isAbortLikeError = (error: unknown): boolean => (
  error instanceof StaleGenerationError ||
  (error instanceof DOMException && error.name === 'AbortError') ||
  (error instanceof Error && error.name === 'AbortError')
);
