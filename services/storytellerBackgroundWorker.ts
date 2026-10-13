// Background Worker & Tab Throttling Prevention for Rafiq Storyteller

class StorytellerBackgroundManager {
  private audioCtx: AudioContext | null = null;
  private silentGain: GainNode | null = null;
  private oscillator: OscillatorNode | null = null;
  private wakeLockSentinel: any = null;
  private originalDocumentTitle: string = '';
  private titleFlashInterval: ReturnType<typeof setInterval> | null = null;
  private isKeepingAlive: boolean = false;

  constructor() {
    if (typeof document !== 'undefined') {
      this.originalDocumentTitle = document.title;
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.stopTitleFlash();
        }
      });
    }
  }

  /**
   * Request browser notification permissions
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
   * Starts background keep-alive using silent Web Audio API + Screen Wake Lock + Web Locks.
   * Modern browsers (Chrome, Safari, Edge) throttle or freeze background tabs unless media is active.
   */
  startKeepAlive(): void {
    if (this.isKeepingAlive) return;
    this.isKeepingAlive = true;

    // 1. Silent Web Audio Output (Gold standard to prevent tab sleep)
    try {
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
    } catch (err) {
      console.warn('[StorytellerBackground] Audio keep-alive unavailable:', err);
    }

    // 2. Screen Wake Lock (if supported)
    try {
      if ('wakeLock' in navigator && (navigator as any).wakeLock?.request) {
        (navigator as any).wakeLock.request('screen').then((sentinel: any) => {
          this.wakeLockSentinel = sentinel;
        }).catch(() => {});
      }
    } catch {}

    // 3. Tab Title indicator while generating
    if (typeof document !== 'undefined') {
      this.originalDocumentTitle = document.title;
      if (document.hidden) {
        document.title = '(رفيق بيحكي...) 🎙️';
      }
    }
  }

  /**
   * Stops background keep-alive and cleans up audio context
   */
  stopKeepAlive(): void {
    this.isKeepingAlive = false;

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
  }

  /**
   * Plays a pleasant 2-tone melodic chime to alert user that a story part is ready
   */
  playReadyChime(): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Note 1: C5 (523.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.3);

      // Note 2: E5 (659.25 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.frequency.setValueAtTime(659.25, now + 0.15);
      gain2.gain.setValueAtTime(0.15, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.55);

      setTimeout(() => {
        void ctx.close();
      }, 700);
    } catch (err) {
      console.warn('[StorytellerBackground] Chime error:', err);
    }
  }

  /**
   * Alerts the user that a new story part is ready when in a background tab
   */
  notifyPartReady(botName: string, partNumber: number, title: string): void {
    // 1. Play audio chime
    this.playReadyChime();

    // 2. If tab is in background, flash title and send system notification
    if (typeof document !== 'undefined' && document.hidden) {
      this.startTitleFlash(`🔔 رفيق نزّل جزء جديد (${partNumber})!`);

      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          const notif = new Notification(`${botName}: الجزء ${partNumber} جاهز! ☕`, {
            body: `«${title}» — افتح الشات واسمع رفيق وهو بيكملك اللي حصل!`,
            icon: '/icons/rafiq-icon-192.png',
            tag: 'rafiq-story-part',
          });
          notif.onclick = () => {
            window.focus();
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

export const storytellerBackground = new StorytellerBackgroundManager();
