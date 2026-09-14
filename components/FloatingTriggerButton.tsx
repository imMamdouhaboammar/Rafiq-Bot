import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageSquareText, X } from 'lucide-react';
import { useRafiqStore } from '../stores/useRafiqStore.js';
import { pickRandomPrompt } from '../services/randomPrompts.js';
import PresetRepliesDock from './PresetRepliesDock.js';
import { eventBus } from '../services/eventBus.js';

const THROTTLE_MS = 10_000;

interface FloatingTriggerButtonProps {
  onTrigger: (chatId: string, text: string) => Promise<void> | void;
  disabled?: boolean;
}

export const FloatingTriggerButton: React.FC<FloatingTriggerButtonProps> = ({
  onTrigger,
  disabled = false,
}) => {
  const activeChatId = useRafiqStore((state) => state.activeChatId);
  const prompts = useRafiqStore((state) => state.randomPrompts);
  
  // Local storage state for whether the helper should be shown at all
  const [showHelper, setShowHelper] = useState(() => {
    return localStorage.getItem('rafiq:show-floating-helper') !== 'false';
  });

  // Dock open state
  const [isOpen, setIsOpen] = useState(false);
  const [showRandomPrompts, setShowRandomPrompts] = useState(false);

  const enabledPrompts = useMemo(
    () => prompts.filter(prompt => prompt.enabled),
    [prompts],
  );
  
  const presetReplies = useMemo(
    () => enabledPrompts.map(prompt => ({ id: prompt.id, text: prompt.text })),
    [enabledPrompts],
  );

  const [busy, setBusy] = useState(false);
  const [lastClickAt, setLastClickAt] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  useEffect(() => {
    const handleStorageChange = () => {
      setShowHelper(localStorage.getItem('rafiq:show-floating-helper') !== 'false');
    };
    window.addEventListener('rafiq:floating-helper-changed', handleStorageChange);
    return () => window.removeEventListener('rafiq:floating-helper-changed', handleStorageChange);
  }, []);

  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = window.setTimeout(
      () => setCooldownRemaining(current => Math.max(0, current - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [cooldownRemaining]);

  const handleTriggerRandom = useCallback(async () => {
    if (busy || disabled || !activeChatId) return;

    const now = Date.now();
    const elapsed = now - lastClickAt;
    if (elapsed < THROTTLE_MS) {
      setCooldownRemaining(Math.ceil((THROTTLE_MS - elapsed) / 1000));
      eventBus.emit('ui:toast', {
        message: `برجاء الانتظار ${Math.ceil((THROTTLE_MS - elapsed) / 1000)} ثانية قبل توليد المحفز التالي`,
        type: 'info',
      });
      return;
    }

    setBusy(true);
    setLastClickAt(now);

    try {
      const picked = await pickRandomPrompt();
      if (!picked) {
        eventBus.emit('ui:toast', { message: 'لا توجد محفزات مفعلة لتوليدها عشوائياً', type: 'warning' });
        return;
      }
      await onTrigger(activeChatId, picked.text);
    } catch (error) {
      console.error('[FloatingTriggerButton] random trigger failed:', error);
    } finally {
      setBusy(false);
    }
  }, [activeChatId, busy, disabled, lastClickAt, onTrigger]);

  const sendPreset = useCallback(async (text: string) => {
    if (!activeChatId || disabled || busy) return;
    await onTrigger(activeChatId, text);
    setIsOpen(false); // Close dock after sending
  }, [activeChatId, busy, disabled, onTrigger]);

  const hideHelperPermanently = () => {
    localStorage.setItem('rafiq:show-floating-helper', 'false');
    setShowHelper(false);
    setIsOpen(false);
    eventBus.emit('ui:toast', {
      message: 'تم إخفاء المساعد العائم. يمكنك استعادته من إعدادات المظهر في ملفك الشخصي.',
      type: 'info',
    });
    // Dispatch event to keep other instances or views synced
    window.dispatchEvent(new Event('rafiq:floating-helper-changed'));
  };

  if (!showHelper || !activeChatId) return null;

  return (
    <div className="fixed bottom-28 right-4 z-40 flex flex-col items-end">
      {/* Small Floating Icon Button */}
      <div className="relative group/helper">
        {/* Main circular button */}
        <button
          type="button"
          onClick={() => setIsOpen(current => !current)}
          aria-label="مساعد الردود"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg border border-white/10 transition-all hover:bg-emerald-700 hover:scale-105 active:scale-95"
        >
          <MessageSquareText size={20} />
        </button>

        {/* Tiny close 'x' button on hover */}
        <button
          type="button"
          onClick={hideHelperPermanently}
          title="إخفاء المساعد العائم"
          className="absolute -top-1.5 -left-1.5 hidden group-hover/helper:flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-800 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 border border-white dark:border-gray-700 shadow transition cursor-pointer"
        >
          <X size={10} />
        </button>
      </div>

      {/* Expanded popover */}
      {isOpen ? (
        <PresetRepliesDock
          replies={presetReplies}
          onSend={sendPreset}
          onTriggerRandom={handleTriggerRandom}
          isRandomBusy={busy}
          onOpenSettings={() => {
            setIsOpen(false);
            // We use eventBus to open the settings modal
            eventBus.emit('ui:modal_open', { modalName: 'random-prompts-settings' });
          }}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </div>
  );
};

export default FloatingTriggerButton;
