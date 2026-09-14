import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { eventBus } from '../services/eventBus.js';
import ComposerAttachmentOverlayHost from './ComposerAttachmentOverlayHost.js';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

const toastStyles: Record<ToastType, { icon: React.ReactNode; tone: string; bar: string; role: 'status' | 'alert' }> = {
  success: {
    icon: <CheckCircle2 size={18} />,
    tone: 'border-emerald-200 bg-white text-[#111b21]',
    bar: 'bg-emerald-500',
    role: 'status',
  },
  error: {
    icon: <AlertCircle size={18} />,
    tone: 'border-red-200 bg-white text-[#111b21]',
    bar: 'bg-red-500',
    role: 'alert',
  },
  warning: {
    icon: <AlertCircle size={18} />,
    tone: 'border-amber-200 bg-white text-[#111b21]',
    bar: 'bg-amber-500',
    role: 'alert',
  },
  info: {
    icon: <Info size={18} />,
    tone: 'border-sky-200 bg-white text-[#111b21]',
    bar: 'bg-sky-500',
    role: 'status',
  },
};

const ToastHost: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const onToast = (payload: { message: string; type: ToastType; duration?: number }) => {
      if (payload.type === 'error') {
        eventBus.logErrorLocally('UI Toast Notification', payload.message, 'UI_TOAST_ERROR');
        return;
      }

      const id = crypto.randomUUID();
      const toast: ToastItem = {
        id,
        message: payload.message,
        type: payload.type,
        duration: payload.duration ?? 4200,
      };

      setToasts(previous => [...previous.slice(-3), toast]);
      const timer = window.setTimeout(() => {
        setToasts(previous => previous.filter(item => item.id !== id));
      }, toast.duration);
      timersRef.current.push(timer);
    };

    eventBus.on('ui:toast', onToast);
    return () => {
      eventBus.off('ui:toast', onToast);
      timersRef.current.forEach(timer => window.clearTimeout(timer));
      timersRef.current = [];
    };
  }, []);

  return (
    <>
      <ComposerAttachmentOverlayHost />
      {toasts.length > 0 ? (
        <div
          className="pointer-events-none fixed inset-x-3 top-3 z-[120] flex flex-col items-center gap-2 sm:inset-x-auto sm:left-4 sm:items-start"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {toasts.map(toast => {
            const style = toastStyles[toast.type];
            return (
              <div
                key={toast.id}
                role={style.role}
                aria-atomic="true"
                className={`pointer-events-auto flex w-full max-w-sm overflow-hidden rounded-lg border shadow-2xl ${style.tone}`}
                dir="rtl"
              >
                <div className={`w-1.5 shrink-0 ${style.bar}`} />
                <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3">
                  <span className="shrink-0 text-current">{style.icon}</span>
                  <p className="min-w-0 flex-1 text-sm font-semibold leading-6">{toast.message}</p>
                  <button
                    type="button"
                    onClick={() => setToasts(previous => previous.filter(item => item.id !== toast.id))}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#54656f] hover:bg-[#f0f2f5]"
                    aria-label="إغلاق التنبيه"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
};

export default ToastHost;
