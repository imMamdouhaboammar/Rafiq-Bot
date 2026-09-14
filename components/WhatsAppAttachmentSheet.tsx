import React, { useEffect, useRef } from 'react';
import {
  Camera,
  Code2,
  FileText,
  FolderInput,
  Headphones,
  Image as ImageIcon,
  Palette,
  Sparkles,
  Zap,
} from 'lucide-react';
import { triggerHaptic } from '../utils/haptics.js';

interface WhatsAppAttachmentSheetProps {
  open: boolean;
  onClose: () => void;
  onSelectDocument: () => void;
  onSelectCamera: () => void;
  onSelectGallery: () => void;
  onSelectAudio: () => void;
  onSelectStudio: () => void;
  onSelectQuickPrompts: () => void;
  onSelectCode: () => void;
  onSelectImportChat: () => void;
  onSelectSelfie?: () => void;
}

export const WhatsAppAttachmentSheet: React.FC<WhatsAppAttachmentSheetProps> = ({
  open,
  onClose,
  onSelectDocument,
  onSelectCamera,
  onSelectGallery,
  onSelectAudio,
  onSelectStudio,
  onSelectQuickPrompts,
  onSelectCode,
  onSelectImportChat,
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const items = [
    {
      id: 'doc',
      label: 'مستند',
      icon: FileText,
      bg: 'bg-[#7f66ff]',
      action: onSelectDocument,
    },
    {
      id: 'camera',
      label: 'كاميرا',
      icon: Camera,
      bg: 'bg-[#d33b7d]',
      action: onSelectCamera,
    },
    {
      id: 'gallery',
      label: 'المعرض',
      icon: ImageIcon,
      bg: 'bg-[#ac44cf]',
      action: onSelectGallery,
    },
    {
      id: 'audio',
      label: 'صوت',
      icon: Headphones,
      bg: 'bg-[#e07a27]',
      action: onSelectAudio,
    },
    {
      id: 'studio',
      label: 'استوديو الصور',
      icon: Palette,
      bg: 'bg-[#6366f1]',
      action: onSelectStudio,
    },
    {
      id: 'prompts',
      label: 'ردود ومحفزات',
      icon: Zap,
      bg: 'bg-[#f59e0b]',
      action: onSelectQuickPrompts,
    },
    {
      id: 'code',
      label: 'ملف كود',
      icon: Code2,
      bg: 'bg-[#0ea5e9]',
      action: onSelectCode,
    },
    {
      id: 'import',
      label: 'استيراد محادثة',
      icon: FolderInput,
      bg: 'bg-[#25d366]',
      action: onSelectImportChat,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-end sm:justify-start" dir="rtl">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/35 backdrop-blur-[2px] transition-opacity duration-200 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet Container */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="قائمة المرفقات"
        className="relative z-10 mb-[calc(80px+env(safe-area-inset-bottom))] ms-3 me-3 w-[min(380px,calc(100vw-24px))] rounded-3xl bg-white p-5 shadow-2xl border border-gray-100/80 animate-in slide-in-from-bottom-5 zoom-in-95 duration-200"
      >
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="text-xs font-bold text-gray-500">إرفاق محتوى أو تشغيل أداة</span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[36px] items-center px-2 text-xs font-semibold text-gray-400 hover:text-gray-600 focus:outline-none"
            aria-label="إغلاق قائمة المرفقات"
          >
            إغلاق
          </button>
        </div>

        <div className="grid grid-cols-4 gap-y-4 gap-x-2 text-center">
          {items.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onClose();
                  item.action();
                }}
                className="group flex flex-col items-center gap-1.5 focus:outline-none"
                aria-label={item.label}
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full text-white shadow-md transition-transform duration-100 group-hover:scale-105 active:scale-90 ${item.bg}`}
                >
                  <Icon size={25} />
                </div>
                <span className="text-[11px] font-medium leading-tight text-[#111b21]">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppAttachmentSheet;
