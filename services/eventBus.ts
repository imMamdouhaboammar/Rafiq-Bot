import mitt, { type Emitter } from 'mitt';
import { Subject } from 'rxjs';
import type { ChatMessage, ChatSession } from '../types.js';

export interface GroupReactionContext {
  messageId: string;
  senderId: string;
  emoji: string;
}

export type RafiqEventMap = {
  'chat:new_message': { message: ChatMessage };
  'chat:send_status': { messageId: string; status: 'sent' | 'delivered' | 'read' | 'error' };
  'import:seed_memories': { chatId?: string; seeds: any[] };

  'group:message_send': {
    groupId: string;
    senderId: string;
    text: string;
    senderName?: string;
    senderAvatar?: string;
    msgId: string;
    rootMessageId?: string;
    replyToMessageId?: string;
    depth?: number;
    attachmentIds?: string[];
    reactionContext?: GroupReactionContext[];
  };
  'group:message_reaction': {
    groupId: string;
    messageId: string;
    senderId: string;
    senderName: string;
    emoji: string;
  };
  'persona:perceive_message': {
    groupId: string;
    targetId: string;
    fromId: string;
    text: string;
    fromName: string;
    msgId: string;
    rootMessageId: string;
    depth: number;
    eligiblePersonaIds?: string[];
    attachmentIds?: string[];
    reactionContext?: GroupReactionContext[];
  };
  'ai:group_response_ready': {
    groupId: string;
    personaId: string;
    text: string;
    triggerMessageId: string;
    rootMessageId: string;
    triggerDepth: number;
    triggerSenderId: string;
    triggerSenderName: string;
    triggerText: string;
    attachmentIds?: string[];
    reactionContext?: GroupReactionContext[];
    sessionId: string;
    acknowledge: (persisted: boolean) => void;
  };

  'ai:thinking_start': { chatId: string; personaId: string };
  'ai:thinking_end': { chatId: string; personaId: string };
  'ai:response_ready': { chatId: string; personaId: string; text: string; audio?: string };

  'persona:mood_change': { personaId: string; oldMood: string; newMood: string; reason?: string };
  'persona:visual_generated': { personaId: string; imageUrl: string };
  'persona:adaptation_updated': { chatId: string; chat: ChatSession };

  'ui:toast': { message: string; type: 'success' | 'error' | 'info' | 'warning'; duration?: number };
  'ui:modal_open': { modalName: string; context?: any };
  'ui:modal_close': { modalName: string };
  'ui:dialog': {
    title: string;
    message: string;
    tone?: 'info' | 'warning' | 'danger';
    confirmLabel?: string;
    cancelLabel?: string;
    showCancel?: boolean;
    dismissible?: boolean;
    onConfirm?: () => void;
    onCancel?: () => void;
  };

  'system:error': { code: string; message: string; origin: string; errorObject?: any };
  'system:online_status': { isOnline: boolean };
};

export interface EventMeta {
  timestamp: number;
  id: string;
  source: string;
}

export interface SmartEvent<K extends keyof RafiqEventMap> {
  name: K;
  payload: RafiqEventMap[K];
  _meta: EventMeta;
}

const emitter: Emitter<RafiqEventMap> = mitt<RafiqEventMap>();
const eventStream$ = new Subject<SmartEvent<keyof RafiqEventMap>>();

export const emit = <K extends keyof RafiqEventMap>(
  name: K,
  payload: RafiqEventMap[K],
  source = 'system',
) => {
  emitter.emit(name, payload);
  eventStream$.next({
    name,
    payload,
    _meta: {
      timestamp: Date.now(),
      id: crypto.randomUUID(),
      source,
    },
  });
};

export const on = <K extends keyof RafiqEventMap>(
  name: K,
  handler: (event: RafiqEventMap[K]) => void,
) => {
  emitter.on(name, handler);
};

export const off = <K extends keyof RafiqEventMap>(
  name: K,
  handler: (event: RafiqEventMap[K]) => void,
) => {
  emitter.off(name, handler);
};

export const observe = eventStream$.asObservable();

export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  origin: string;
  code: string;
  message: string;
  stack?: string;
}

export const getErrorLogs = (): ErrorLogEntry[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('rafiq:error-logs');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const clearErrorLogs = () => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('rafiq:error-logs', '[]');
  window.dispatchEvent(new Event('rafiq:errors-updated'));
};

export const logErrorLocally = (origin: string, error: any, code = 'UNKNOWN_ERROR') => {
  if (typeof window === 'undefined') return;
  const message = error instanceof Error ? error.message : String(error || 'An unknown error occurred');
  const stack = error instanceof Error ? error.stack : undefined;
  const newEntry: ErrorLogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    origin,
    code,
    message,
    stack,
  };
  
  try {
    const currentLogs = getErrorLogs();
    const nextLogs = [newEntry, ...currentLogs].slice(0, 50); // Keep last 50 errors
    localStorage.setItem('rafiq:error-logs', JSON.stringify(nextLogs));
    window.dispatchEvent(new Event('rafiq:errors-updated'));
  } catch (e) {
    console.error('Failed to log error locally:', e);
  }
};

export const emitError = (origin: string, error: any, code = 'UNKNOWN_ERROR') => {
  const message = error instanceof Error ? error.message : String(error || 'An unknown error occurred');
  emit('system:error', {
    code,
    origin,
    message,
    errorObject: error,
  }, origin);
  
  // Log the error locally for the Settings logs tab
  logErrorLocally(origin, error, code);
};

export const eventBus = {
  emit,
  on,
  off,
  observe,
  emitError,
  getErrorLogs,
  clearErrorLogs,
  logErrorLocally,
};

