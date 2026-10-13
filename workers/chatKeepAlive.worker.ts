// Web Worker to provide unthrottled timers and heartbeat pulses for background chat execution
// Browsers clamp main thread setTimeout to >= 1000ms when a tab is hidden, but Dedicated Workers
// run in an independent OS thread and maintain precise timer execution.

interface ScheduleTimerMessage {
  type: 'SCHEDULE_TIMER';
  id: string;
  delayMs: number;
}

interface CancelTimerMessage {
  type: 'CANCEL_TIMER';
  id: string;
}

interface StartHeartbeatMessage {
  type: 'START_HEARTBEAT';
  intervalMs?: number;
}

interface StopHeartbeatMessage {
  type: 'STOP_HEARTBEAT';
}

type InboundMessage =
  | ScheduleTimerMessage
  | CancelTimerMessage
  | StartHeartbeatMessage
  | StopHeartbeatMessage;

const activeTimers = new Map<string, ReturnType<typeof setTimeout>>();
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

self.addEventListener('message', (event: MessageEvent<InboundMessage>) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  switch (data.type) {
    case 'SCHEDULE_TIMER': {
      const existing = activeTimers.get(data.id);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        activeTimers.delete(data.id);
        self.postMessage({ type: 'TIMER_ELAPSED', id: data.id });
      }, Math.max(0, data.delayMs));

      activeTimers.set(data.id, timer);
      break;
    }

    case 'CANCEL_TIMER': {
      const existing = activeTimers.get(data.id);
      if (existing) {
        clearTimeout(existing);
        activeTimers.delete(data.id);
      }
      break;
    }

    case 'START_HEARTBEAT': {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      const intervalMs = data.intervalMs || 1000;
      heartbeatInterval = setInterval(() => {
        self.postMessage({ type: 'HEARTBEAT_TICK', timestamp: Date.now() });
      }, intervalMs);
      break;
    }

    case 'STOP_HEARTBEAT': {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      break;
    }

    default:
      break;
  }
});
