import { AsyncGenerationGuard, type GenerationLease } from './asyncGenerationGuard.js';
import { useRafiqStore } from '../stores/useRafiqStore.js';

export interface BackgroundChatJob {
  chatId: string;
  botName: string;
  avatarUrl?: string;
  status: 'scheduled' | 'running' | 'completed' | 'cancelled';
  startedAt: Date;
  cancelTimer?: () => void;
}

class RafiqBackgroundWorkerManager {
  private guards = new Map<string, AsyncGenerationGuard>();
  private activeJobs = new Map<string, BackgroundChatJob>();
  private scheduledTimerCallbacks = new Map<string, () => void>();

  // Background keep-alive media & power handles
  private audioCtx: AudioContext | null = null;
  private silentGain: GainNode | null = null;
  private oscillator: OscillatorNode | null = null;
  private wakeLockSentinel: any = null;
  private isKeepingAlive = false;

  // Title flashing & tab awareness
  private originalDocumentTitle = '';
  private titleFlashInterval: ReturnType<typeof setInterval> | null = null;

  // Web Worker timer bridge
  private timerWorker: Worker | null = null;
  private timerIdCounter = 0;

  constructor() {
    this.initBrowserHooks();
    this.initTimerWorker();
  }

  private initBrowserHooks(): void {
    if (typeof document === 'undefined') return;

    this.originalDocumentTitle = document.title;
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.stopTitleFlash();
      } else if (this.activeJobs.size > 0) {
        document.title = '(رفيق بيكتب...) ✍️';
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        this.stopTitleFlash();
      });
    }
  }

  private initTimerWorker(): void {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') return;
    try {
      this.timerWorker = new Worker(
        new URL('../workers/chatKeepAlive.worker.ts', import.meta.url),
        { type: 'module' },
      );

      this.timerWorker.addEventListener('message', (event: MessageEvent) => {
        const { type, id } = event.data || {};
        if (type === 'TIMER_ELAPSED' && id) {
          const callback = this.scheduledTimerCallbacks.get(id);
          if (callback) {
            this.scheduledTimerCallbacks.delete(id);
            callback();
          }
        }
      });
    } catch (err) {
      console.warn('[RafiqBackgroundWorker] Dedicated timer worker unavailable, falling back to window timers:', err);
      this.timerWorker = null;
    }
  }

  /**
   * Get or create a persistent AsyncGenerationGuard for a specific chat.
   * Unlike component-scoped guards, this guard survives view navigation and component unmounts.
   */
  getGenerationGuard(chatId: string): AsyncGenerationGuard {
    let guard = this.guards.get(chatId);
    if (!guard) {
      guard = new AsyncGenerationGuard();
      this.guards.set(chatId, guard);
    }
    return guard;
  }

  /**
   * Check if a specific chat has an active or scheduled background response job.
   */
  isJobActive(chatId: string): boolean {
    return this.activeJobs.has(chatId);
  }

  /**
   * Schedule a bot response with unthrottled timer execution.
   * If a previous response was scheduled for the same chat, it will be cancelled/rescheduled.
   */
  scheduleResponse(
    chatId: string,
    task: () => Promise<void> | void,
    delayMs = 1500,
    botName = 'الرفيق',
  ): void {
    // Cancel any existing scheduled job for this chat
    this.cancelScheduledTimer(chatId);

    const timerId = `chat-timer-${chatId}-${++this.timerIdCounter}`;
    let isFired = false;

    const executeTask = () => {
      if (isFired) return;
      isFired = true;
      this.scheduledTimerCallbacks.delete(timerId);

      const job = this.activeJobs.get(chatId);
      if (job) {
        job.status = 'running';
      }

      void Promise.resolve(task()).catch(err => {
        console.error(`[RafiqBackgroundWorker] Execution failed for chat ${chatId}:`, err);
      });
    };

    let cancelTimer: () => void;

    if (this.timerWorker) {
      this.scheduledTimerCallbacks.set(timerId, executeTask);
      this.timerWorker.postMessage({
        type: 'SCHEDULE_TIMER',
        id: timerId,
        delayMs,
      });

      cancelTimer = () => {
        if (!isFired) {
          isFired = true;
          this.scheduledTimerCallbacks.delete(timerId);
          this.timerWorker?.postMessage({ type: 'CANCEL_TIMER', id: timerId });
        }
      };
    } else {
      const timeoutHandle = setTimeout(executeTask, delayMs);
      cancelTimer = () => {
        if (!isFired) {
          isFired = true;
          clearTimeout(timeoutHandle);
        }
      };
    }

    this.activeJobs.set(chatId, {
      chatId,
      botName,
      status: 'scheduled',
      startedAt: new Date(),
      cancelTimer,
    });

    this.startKeepAlive(chatId, botName);
  }

  private cancelScheduledTimer(chatId: string): void {
    const existing = this.activeJobs.get(chatId);
    if (existing?.cancelTimer) {
      existing.cancelTimer();
    }
  }

  /**
   * Cancel an active or pending background job for a specific chat (e.g. when chat is deleted).
   */
  cancelJob(chatId: string, reason = 'job_cancelled'): void {
    this.cancelScheduledTimer(chatId);
    const guard = this.guards.get(chatId);
    if (guard) {
      guard.cancel(reason);
    }
    this.activeJobs.delete(chatId);
    this.checkKeepAliveStatus();
  }

  /**
   * Advance the generation guard for a chat (e.g. when user sends a new message to supersede the old turn).
   */
  advanceJob(chatId: string, reason = 'generation_advanced'): number {
    this.cancelScheduledTimer(chatId);
    const guard = this.getGenerationGuard(chatId);
    return guard.advance(reason);
  }

  /**
   * Called when a response generation completes or errors out for a chat.
   */
  onJobFinished(chatId: string): void {
    this.cancelScheduledTimer(chatId);
    this.activeJobs.delete(chatId);
    this.checkKeepAliveStatus();
  }

  /**
   * Precision delay that respects the generation lease and uses the timer worker
   * to bypass background tab setTimeout clamping.
   */
  precisionDelay(milliseconds: number, lease: GenerationLease): Promise<void> {
    return new Promise((resolve, reject) => {
      if (lease.signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }

      const timerId = `delay-${++this.timerIdCounter}`;
      let isDone = false;

      const handleAbort = () => {
        if (isDone) return;
        isDone = true;
        if (this.timerWorker) {
          this.scheduledTimerCallbacks.delete(timerId);
          this.timerWorker.postMessage({ type: 'CANCEL_TIMER', id: timerId });
        } else {
          clearTimeout(nativeTimer);
        }
        reject(new DOMException('Aborted', 'AbortError'));
      };

      const finish = () => {
        if (isDone) return;
        isDone = true;
        lease.signal.removeEventListener('abort', handleAbort);
        resolve();
      };

      let nativeTimer: ReturnType<typeof setTimeout>;

      if (this.timerWorker) {
        this.scheduledTimerCallbacks.set(timerId, finish);
        this.timerWorker.postMessage({
          type: 'SCHEDULE_TIMER',
          id: timerId,
          delayMs: milliseconds,
        });
      } else {
        nativeTimer = setTimeout(finish, milliseconds);
      }

      lease.signal.addEventListener('abort', handleAbort, { once: true });
    });
  }

  /**
   * Starts background keep-alive using silent Web Audio API + Screen Wake Lock + Dedicated Worker pulse.
   * Modern browsers (Chrome, Safari, Edge) throttle or freeze background tabs unless media is active.
   */
  startKeepAlive(chatId: string, botName?: string): void {
    if (this.timerWorker) {
      this.timerWorker.postMessage({ type: 'START_HEARTBEAT', intervalMs: 2000 });
    }

    if (this.isKeepingAlive) return;
    this.isKeepingAlive = true;

    // 1. Silent Web Audio Output (Gold standard to prevent tab sleep & socket freeze)
    try {
      if (typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          if (!this.audioCtx || this.audioCtx.state === 'closed') {
            this.audioCtx = new AudioCtx();
          }
          if (this.audioCtx.state === 'suspended') {
            void this.audioCtx.resume();
          }

          // Silent oscillator with near-zero gain (completely inaudible)
          this.oscillator = this.audioCtx.createOscillator();
          this.silentGain = this.audioCtx.createGain();
          this.silentGain.gain.setValueAtTime(0.00001, this.audioCtx.currentTime);
          this.oscillator.connect(this.silentGain);
          this.silentGain.connect(this.audioCtx.destination);
          this.oscillator.start();
        }
      }
    } catch (err) {
      console.warn('[RafiqBackgroundWorker] Audio keep-alive unavailable:', err);
    }

    // 2. Screen Wake Lock (if supported)
    try {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && (navigator as any).wakeLock?.request) {
        (navigator as any).wakeLock.request('screen').then((sentinel: any) => {
          this.wakeLockSentinel = sentinel;
        }).catch(() => {});
      }
    } catch {}

    // 3. Tab Title indicator while generating
    if (typeof document !== 'undefined') {
      if (!this.originalDocumentTitle) {
        this.originalDocumentTitle = document.title;
      }
      if (document.hidden) {
        document.title = botName ? `(${botName} بيكتب...) ✍️` : '(رفيق بيكتب...) ✍️';
      }
    }
  }

  private checkKeepAliveStatus(): void {
    if (this.activeJobs.size === 0) {
      this.stopKeepAlive();
    }
  }

  stopKeepAlive(): void {
    this.isKeepingAlive = false;

    if (this.timerWorker) {
      this.timerWorker.postMessage({ type: 'STOP_HEARTBEAT' });
    }

    try {
      if (this.oscillator) {
        this.oscillator.stop();
        this.oscillator.disconnect();
        this.oscillator = null;
      }
      if (this.silentGain) {
        this.silentGain.disconnect();
        this.silentGain = null;
      }
      if (this.audioCtx && this.audioCtx.state !== 'closed') {
        void this.audioCtx.suspend();
      }
    } catch {}

    try {
      if (this.wakeLockSentinel) {
        this.wakeLockSentinel.release?.();
        this.wakeLockSentinel = null;
      }
    } catch {}

    if (typeof document !== 'undefined' && !this.titleFlashInterval && this.originalDocumentTitle) {
      document.title = this.originalDocumentTitle;
    }
  }

  /**
   * Plays a pleasant 2-tone melodic chime to alert user that a companion reply is ready.
   */
  playNotificationChime(): void {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Note 1: E5 (659.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.08, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      // Note 2: A5 (880 Hz) - cheerful ascending tone
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.frequency.setValueAtTime(880, now + 0.12);
      gain2.gain.setValueAtTime(0.1, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.45);

      setTimeout(() => {
        void ctx.close();
      }, 600);
    } catch (err) {
      console.warn('[RafiqBackgroundWorker] Chime error:', err);
    }
  }

  /**
   * Request browser notification permissions.
   */
  async requestNotificationPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      const res = await Notification.requestPermission();
      return res === 'granted';
    }
    return false;
  }

  /**
   * Alert user when a response is ready and the user is either in a background tab
   * or looking at a different chat.
   */
  notifyResponseComplete(
    chatId: string,
    botName: string,
    messageText: string,
    avatarUrl?: string,
  ): void {
    const isHidden = typeof document !== 'undefined' && document.hidden;
    const isViewingThisChat = useRafiqStore.getState().activeChatId === chatId;

    // If user is inside the current chat and tab is focused, no background alerts needed
    if (isViewingThisChat && !isHidden) {
      return;
    }

    // 1. Play audio chime
    this.playNotificationChime();

    // 2. If tab is in background, flash title and send system notification
    if (isHidden) {
      this.startTitleFlash(`💬 رفيق: رد جديد من ${botName}!`);

      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          const cleanPreview = messageText
            .replace(/\s*\|\|\|\s*/g, ' ')
            .replace(/\[\[[\s\S]*?\]\]/g, '')
            .slice(0, 120);

          const notif = new Notification(`${botName} 💬`, {
            body: cleanPreview || 'بعتلك رسالة جديدة!',
            icon: avatarUrl || '/icons/rafiq-icon-192.png',
            tag: `rafiq-reply-${chatId}`,
          });

          notif.onclick = () => {
            window.focus();
            useRafiqStore.getState().setActiveChatId(chatId);
            notif.close();
          };
        } catch {}
      }
    }
  }

  private startTitleFlash(alertText: string): void {
    if (this.titleFlashInterval) clearInterval(this.titleFlashInterval);
    let state = false;
    this.titleFlashInterval = setInterval(() => {
      document.title = state ? alertText : (this.originalDocumentTitle || 'رفيق');
      state = !state;
    }, 1200);
  }

  private stopTitleFlash(): void {
    if (this.titleFlashInterval) {
      clearInterval(this.titleFlashInterval);
      this.titleFlashInterval = null;
    }
    if (typeof document !== 'undefined' && this.originalDocumentTitle) {
      document.title = this.originalDocumentTitle;
    }
  }
}

export const rafiqBackgroundWorker = new RafiqBackgroundWorkerManager();
