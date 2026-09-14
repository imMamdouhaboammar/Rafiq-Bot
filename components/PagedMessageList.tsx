import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  createInitialMessageWindow,
  followLatestMessages,
  getWindowedMessages,
  loadOlderMessagePage,
  type MessageWindow,
} from '../services/messageWindow.js';

interface IdentifiedMessage {
  id?: string;
}

interface PagedMessageListProps<T extends IdentifiedMessage> {
  messages: T[];
  renderMessage: (message: T) => React.ReactNode;
  className?: string;
  ariaLabel?: string;
  footer?: React.ReactNode;
}

const PagedMessageList = <T extends IdentifiedMessage>({
  messages,
  renderMessage,
  className = '',
  ariaLabel = 'الرسائل',
  footer,
}: PagedMessageListProps<T>) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const olderSentinelRef = useRef<HTMLDivElement>(null);
  const previousCountRef = useRef(messages.length);
  const restoreScrollRef = useRef<{ height: number; top: number }>();
  const [windowState, setWindowState] = useState<MessageWindow>(() => (
    createInitialMessageWindow(messages.length)
  ));

  useEffect(() => {
    setWindowState(current => followLatestMessages(
      current,
      previousCountRef.current,
      messages.length,
    ));
    previousCountRef.current = messages.length;
  }, [messages.length]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const restore = restoreScrollRef.current;
    if (!container || !restore) return;
    const heightDifference = container.scrollHeight - restore.height;
    container.scrollTop = restore.top + heightDifference;
    restoreScrollRef.current = undefined;
  }, [windowState.startIndex]);

  useEffect(() => {
    const sentinel = olderSentinelRef.current;
    const container = containerRef.current;
    if (!sentinel || !container || !windowState.hasOlder) return;

    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      restoreScrollRef.current = {
        height: container.scrollHeight,
        top: container.scrollTop,
      };
      setWindowState(current => loadOlderMessagePage(current, messages.length));
    }, {
      root: container,
      rootMargin: '200px 0px 0px 0px',
      threshold: 0,
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [messages.length, windowState.hasOlder]);

  const visibleMessages = getWindowedMessages(messages, windowState);

  return (
    <div
      ref={containerRef}
      className={`min-h-0 overflow-y-auto overscroll-contain ${className}`}
      role="log"
      aria-label={ariaLabel}
      aria-live="polite"
      aria-relevant="additions"
    >
      <div ref={olderSentinelRef} className="h-px" aria-hidden="true" />
      {windowState.hasOlder ? (
        <button
          type="button"
          onClick={() => {
            const container = containerRef.current;
            if (container) {
              restoreScrollRef.current = {
                height: container.scrollHeight,
                top: container.scrollTop,
              };
            }
            setWindowState(current => loadOlderMessagePage(current, messages.length));
          }}
          className="mx-auto my-2 block min-h-11 rounded-full bg-white/90 px-4 text-xs font-bold text-gray-600 shadow-sm hover:bg-white"
        >
          تحميل رسائل أقدم
        </button>
      ) : null}
      {visibleMessages.map((message, index) => (
        <React.Fragment key={message.id || `message-window-${windowState.startIndex + index}`}>
          {renderMessage(message)}
        </React.Fragment>
      ))}
      {footer}
      {windowState.hasNewer ? (
        <button
          type="button"
          onClick={() => setWindowState(createInitialMessageWindow(messages.length))}
          className="sticky bottom-3 mx-auto my-3 block min-h-11 rounded-full bg-wa-teal px-4 text-xs font-bold text-white shadow-lg"
        >
          الانتقال لأحدث الرسائل
        </button>
      ) : null}
    </div>
  );
};

export default PagedMessageList;
