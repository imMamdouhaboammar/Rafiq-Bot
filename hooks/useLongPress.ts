import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';

export interface LongPressHandlers {
  onPointerDown: (event: ReactPointerEvent) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onPointerLeave: () => void;
}

export const useLongPress = (
  onLongPress: (event: ReactPointerEvent) => void,
  delayMs = 500,
): LongPressHandlers => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventRef = useRef<ReactPointerEvent | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    eventRef.current = null;
  }, []);

  const onPointerDown = useCallback((event: ReactPointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    cancel();
    eventRef.current = event;
    timerRef.current = setTimeout(() => {
      const storedEvent = eventRef.current;
      timerRef.current = null;
      eventRef.current = null;
      if (storedEvent) onLongPress(storedEvent);
    }, delayMs);
  }, [cancel, delayMs, onLongPress]);

  useEffect(() => cancel, [cancel]);

  return {
    onPointerDown,
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
  };
};
