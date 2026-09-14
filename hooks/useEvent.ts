
import { useEffect, useRef } from 'react';
import { eventBus, RafiqEventMap } from '../services/eventBus.js';

/**
 * Hook to subscribe to the Rafiq Smart Event Bus.
 * Uses a stable ref to avoid re-subscribing on every render.
 * Automatically handles cleanup (unsubscribe) on component unmount.
 * 
 * @param eventName - The name of the event to listen for (e.g., 'chat:new_message')
 * @param handler - The callback function to execute when the event fires
 */
export function useEvent<K extends keyof RafiqEventMap>(
  eventName: K,
  handler: (payload: RafiqEventMap[K]) => void
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const stableHandler = (payload: RafiqEventMap[K]) => handlerRef.current(payload);
    eventBus.on(eventName, stableHandler);

    return () => {
      eventBus.off(eventName, stableHandler);
    };
  }, [eventName]);
}
