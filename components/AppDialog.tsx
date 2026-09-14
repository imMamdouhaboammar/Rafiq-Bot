import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Info, Zap, X } from 'lucide-react';
import Modal from './Modal.js';

type AppDialogTone = 'info' | 'warning' | 'danger';

interface AppDialogProps {
  open: boolean;
  title: string;
  message: string;
  tone?: AppDialogTone;
  confirmLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
  dismissible?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const toneConfig: Record<AppDialogTone, { icon: React.ReactNode; accent: string; surface: string; button: string }> = {
  info: {
    icon: <Info size={18} />,
    accent: 'text-[#008069]',
    surface: 'bg-[#e8f5f1]',
    button: 'bg-[#008069] hover:bg-[#006c58]',
  },
  warning: {
    icon: <Zap size={18} />,
    accent: 'text-[#b7791f]',
    surface: 'bg-[#fff7e8]',
    button: 'bg-[#d69e2e] hover:bg-[#b7791f]',
  },
  danger: {
    icon: <AlertTriangle size={18} />,
    accent: 'text-[#c53030]',
    surface: 'bg-[#fff1f1]',
    button: 'bg-[#c53030] hover:bg-[#9b2c2c]',
  },
};

const AppDialog: React.FC<AppDialogProps> = ({
  open,
  title,
  message,
  tone = 'info',
  confirmLabel = 'تمام',
  cancelLabel = 'إلغاء',
  showCancel = false,
  dismissible = true,
  onConfirm,
  onCancel,
}) => {
  const currentTone = toneConfig[tone];
  const [locallyDismissed, setLocallyDismissed] = useState(false);
  const previousRequestRef = useRef({
    open: false,
    title: '',
    message: '',
    onConfirm,
    onCancel,
  });

  useEffect(() => {
    const previous = previousRequestRef.current;
    const receivedNewRequest = open && (
      !previous.open
      || previous.title !== title
      || previous.message !== message
      || previous.onConfirm !== onConfirm
      || previous.onCancel !== onCancel
    );
    if (receivedNewRequest) setLocallyDismissed(false);
    if (!open) setLocallyDismissed(false);
    previousRequestRef.current = { open, title, message, onConfirm, onCancel };
  }, [message, onCancel, onConfirm, open, title]);

  const confirm = () => {
    setLocallyDismissed(true);
    onConfirm();
  };

  const cancel = () => {
    setLocallyDismissed(true);
    onCancel();
  };

  return (
    <Modal
      open={open && !locallyDismissed}
      title={title}
      description={message}
      dismissible={dismissible}
      role={tone === 'danger' ? 'alertdialog' : 'dialog'}
      onDismiss={cancel}
    >
      <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${currentTone.surface} ${currentTone.accent}`}>
            {currentTone.icon}
          </div>
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
        </div>
        {dismissible ? (
          <button
            type="button"
            onClick={cancel}
            className="min-h-11 min-w-11 rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="إغلاق"
          >
            <X size={18} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="px-5 py-4">
        <p className="text-sm leading-7 text-gray-600">{message}</p>
      </div>

      <div className="flex items-center gap-3 border-t border-gray-100 px-5 py-4">
        {showCancel ? (
          <button
            type="button"
            onClick={cancel}
            className="min-h-11 flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
          >
            {cancelLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={confirm}
          data-autofocus="true"
          className={`min-h-11 flex-1 rounded-2xl px-4 py-3 text-sm font-bold text-white transition-colors ${currentTone.button}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
};

export default AppDialog;
