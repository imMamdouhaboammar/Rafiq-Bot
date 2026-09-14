import React from 'react';
import { Sliders, Sparkles, Loader2, X, MessageSquareText } from 'lucide-react';

export interface PresetReply {
  id: string;
  text: string;
}

interface PresetRepliesDockProps {
  replies: PresetReply[];
  onSend: (text: string) => void | Promise<void>;
  onTriggerRandom: () => void | Promise<void>;
  isRandomBusy?: boolean;
  onOpenSettings: () => void;
  onClose: () => void;
}

const PresetRepliesDock: React.FC<PresetRepliesDockProps> = ({
  replies,
  onSend,
  onTriggerRandom,
  isRandomBusy = false,
  onOpenSettings,
  onClose,
}) => {
  return (
    <aside
      className="absolute bottom-12 right-0 z-50 w-72 sm:w-80 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 p-3 shadow-2xl backdrop-blur animate-in fade-in slide-in-from-bottom-2 duration-200"
      aria-label="مساعد الردود السريعة"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2 mb-2">
        <div className="flex items-center gap-1.5 text-gray-800 dark:text-gray-200">
          <MessageSquareText size={16} className="text-emerald-600" />
          <span className="text-xs font-extrabold font-sans">مساعد الردود</span>
        </div>
        
        <div className="flex items-center gap-1">
          {/* AI Trigger Button */}
          <button
            type="button"
            onClick={onTriggerRandom}
            disabled={isRandomBusy}
            title="توليد محفز عشوائي (AI)"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition disabled:opacity-50"
          >
            {isRandomBusy ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Sparkles size={15} />
            )}
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={onOpenSettings}
            title="إدارة الردود الجاهزة"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <Sliders size={15} />
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            title="إغلاق"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Body: Scrollable list of preset replies */}
      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-0.5">
        {replies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">لا توجد ردود محفوظة</p>
            <button
              type="button"
              onClick={onOpenSettings}
              className="mt-2 text-[10px] font-bold text-emerald-600 hover:underline"
            >
              إضافة رد جديد
            </button>
          </div>
        ) : (
          replies.map((reply) => (
            <button
              key={reply.id}
              type="button"
              onClick={() => void onSend(reply.text)}
              className="w-full rounded-xl border border-gray-100 dark:border-gray-800 px-3 py-2 text-right text-xs leading-5 text-gray-700 dark:text-gray-300 hover:border-emerald-600/30 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all"
            >
              {reply.text}
            </button>
          ))
        )}
      </div>
    </aside>
  );
};

export default PresetRepliesDock;
