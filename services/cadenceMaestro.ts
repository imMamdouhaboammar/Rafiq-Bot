import { CoalescedMessageBurst } from '../types';

export interface CadenceQueueItem {
  chatId: string;
  messages: string[];
  firstReceivedAt: number;
  lastReceivedAt: number;
  timeoutId: ReturnType<typeof setTimeout> | null;
  abortController: AbortController | null;
}

export interface BubbleChunk {
  text: string;
  delayMs: number;
  order: number;
}

export class CadenceMaestro {
  private queues: Map<string, CadenceQueueItem> = new Map();
  private debounceWindowMs: number;

  constructor(debounceWindowMs = 3200) {
    this.debounceWindowMs = debounceWindowMs;
  }

  /**
   * Enqueues an incoming user message.
   * If a burst is in progress, cancels any in-flight AbortController,
   * merges the message, and resets the debounce window.
   */
  public enqueue(
    chatId: string,
    message: string,
    onReady: (burst: CoalescedMessageBurst, signal: AbortSignal) => Promise<void> | void
  ): { isBurst: boolean; pendingCount: number } {
    const now = Date.now();
    let queue = this.queues.get(chatId);

    if (!queue) {
      const abortController = new AbortController();
      queue = {
        chatId,
        messages: [message],
        firstReceivedAt: now,
        lastReceivedAt: now,
        timeoutId: null,
        abortController
      };
      this.queues.set(chatId, queue);

      queue.timeoutId = setTimeout(() => {
        this.flush(chatId, onReady);
      }, this.debounceWindowMs);

      return { isBurst: false, pendingCount: 1 };
    }

    // Burst detected: cancel in-flight request if one exists
    if (queue.abortController && !queue.abortController.signal.aborted) {
      queue.abortController.abort('New incoming message burst');
    }

    if (queue.timeoutId) {
      clearTimeout(queue.timeoutId);
    }

    queue.abortController = new AbortController();
    queue.messages.push(message);
    queue.lastReceivedAt = now;

    const count = queue.messages.length;
    queue.timeoutId = setTimeout(() => {
      this.flush(chatId, onReady);
    }, this.debounceWindowMs);

    return { isBurst: true, pendingCount: count };
  }

  /**
   * Immediately flushes the queue for a chatId without waiting for the debounce window.
   */
  public flush(
    chatId: string,
    onReady: (burst: CoalescedMessageBurst, signal: AbortSignal) => Promise<void> | void
  ): CoalescedMessageBurst | null {
    const queue = this.queues.get(chatId);
    if (!queue || queue.messages.length === 0) {
      return null;
    }

    if (queue.timeoutId) {
      clearTimeout(queue.timeoutId);
      queue.timeoutId = null;
    }

    const messages = [...queue.messages];
    const coalescedText = messages.length === 1 
      ? messages[0] 
      : messages.join(' | ');

    const burst: CoalescedMessageBurst = {
      messages,
      coalescedText,
      messageCount: messages.length,
      firstReceivedAt: queue.firstReceivedAt,
      lastReceivedAt: queue.lastReceivedAt
    };

    const signal = queue.abortController ? queue.abortController.signal : new AbortController().signal;
    this.queues.delete(chatId);

    onReady(burst, signal);
    return burst;
  }

  /**
   * Splits a raw response into natural WhatsApp conversational bubbles.
   * Splits on explicit delimiter '|||' or double newlines,
   * and calculates biological human-like typing delays for each bubble.
   */
  public splitIntoBubbles(rawResponse: string): BubbleChunk[] {
    if (!rawResponse || !rawResponse.trim()) {
      return [];
    }

    let rawChunks: string[] = [];

    if (rawResponse.includes('|||')) {
      rawChunks = rawResponse
        .split('|||')
        .map(c => c.trim())
        .filter(Boolean);
    } else {
      // Split on double newlines or single newlines if line represents a short dialogue bubble
      const lines = rawResponse
        .split(/\n\n+/)
        .map(c => c.trim())
        .filter(Boolean);

      rawChunks = lines;
    }

    if (rawChunks.length === 0) {
      rawChunks = [rawResponse.trim()];
    }

    return rawChunks.map((text, index) => {
      // Calculate realistic WhatsApp delay: micro-bubbles (1-4 words) arrive quickly, longer thoughts have human jitter
      const charCount = text.length;
      let delayMs: number;

      if (charCount < 15) {
        // Ultra-short micro-bubble (e.g. "ازيك", "نعم", "وه", "اشطا", "صاحبي")
        delayMs = 380 + Math.floor(Math.random() * 320);
      } else if (charCount < 40) {
        // Short conversational clause (~3-6 words, standard Egyptian WhatsApp rhythm)
        delayMs = 720 + Math.floor(Math.random() * 500);
      } else if (charCount < 80) {
        delayMs = 1200 + Math.floor(Math.random() * 650);
      } else {
        delayMs = 1800 + Math.min(Math.floor(charCount * 20), 2500) + Math.floor(Math.random() * 600);
      }

      return {
        text,
        delayMs,
        order: index
      };
    });
  }

  /**
   * Resets and cleans up any active queues.
   */
  public clearAll(): void {
    for (const queue of this.queues.values()) {
      if (queue.timeoutId) {
        clearTimeout(queue.timeoutId);
      }
      if (queue.abortController && !queue.abortController.signal.aborted) {
        queue.abortController.abort('Queue cleared');
      }
    }
    this.queues.clear();
  }
}

export const cadenceMaestro = new CadenceMaestro();
