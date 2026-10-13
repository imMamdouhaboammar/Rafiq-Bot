import React, { useState } from 'react';
import {
  Download,
  FileJson,
  MessageSquareText,
  Sliders,
  Sparkles,
  X,
} from 'lucide-react';
import type { ChatSession } from '../types.js';
import Avatar from './Avatar.js';
import Modal from './Modal.js';
import { triggerHaptic } from '../utils/haptics.js';
import {
  downloadBlob,
  exportCompanionPackage,
  type CompanionExportMode,
} from '../services/chatTransfer.js';
import { eventBus } from '../services/eventBus.js';

interface ExportCompanionModalProps {
  open: boolean;
  onClose: () => void;
  chat: ChatSession;
  messageCount?: number;
}

export const ExportCompanionModal: React.FC<ExportCompanionModalProps> = ({
  open,
  onClose,
  chat,
  messageCount = 0,
}) => {
  const [selectedMode, setSelectedMode] = useState<CompanionExportMode>('with_messages');
  const [isExporting, setIsExporting] = useState(false);

  const botName = chat.isGroup
    ? (chat.groupName || 'مجموعة')
    : chat.settings.botName;

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    triggerHaptic('medium');

    try {
      const { blob, fileName } = await exportCompanionPackage(chat.id, {
        mode: selectedMode,
      });

      downloadBlob(blob, fileName);
      onClose();

      const toastMessage = selectedMode === 'settings_only'
        ? `تم تصدير إعدادات "${botName}" بنجاح ⚙️`
        : `تم تصدير "${botName}" مع المحادثة بنجاح ✅`;

      eventBus.emit('ui:toast', {
        message: toastMessage,
        type: 'success',
      });
    } catch (error) {
      console.error('[ExportCompanionModal] Export failed:', error);
      eventBus.emit('ui:toast', {
        message: error instanceof Error ? error.message : 'فشل تصدير الرفيق',
        type: 'error',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="تصدير الرفيق"
      description="حفظ ونقل بيانات الرفيق كملف منظم"
      dismissible={!isExporting}
      role="dialog"
      onDismiss={onClose}
    >
      <div className="flex flex-col bg-white font-sans text-right" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#e7f7ef] text-[#008069]">
              <Download size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#111b21]">تصدير الرفيق</h2>
              <p className="text-xs text-[#667781]">حفظ ونقل بيانات الرفيق كملف منظم بصيغة JSON</p>
            </div>
          </div>
          <button
            type="button"
            disabled={isExporting}
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-50"
            aria-label="إغلاق"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-4 px-6 py-5">
          {/* Companion Mini Profile Card */}
          <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-[#f8faf9] p-3.5">
            <Avatar
              name={botName}
              gender={chat.settings.botGender}
              imageUrl={chat.settings.avatarUrl}
              size="md"
              isGroup={chat.isGroup}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-bold text-[#111b21]">{botName}</span>
                {chat.settings.cloneProfile ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                    <Sparkles size={10} />
                    مستنسخ
                  </span>
                ) : null}
              </div>
              <p className="truncate text-xs text-[#667781]">
                {chat.settings.botBio?.slice(0, 70) || 'مرافق ذكي ومستمع حقيقي'}
              </p>
            </div>
            <div className="text-left text-xs text-[#54656f]">
              <span className="font-bold text-[#008069]">{messageCount}</span> رسالة
            </div>
          </div>

          <p className="text-xs font-semibold text-[#54656f]">اختر نوع التصدير المطلوب:</p>

          {/* Option 1: With Conversation (Without Media) */}
          <button
            type="button"
            disabled={isExporting}
            onClick={() => {
              triggerHaptic('selection');
              setSelectedMode('with_messages');
            }}
            className={`flex w-full cursor-pointer items-start gap-3.5 rounded-2xl border p-4 text-right transition-all ${
              selectedMode === 'with_messages'
                ? 'border-[#008069] bg-[#e7f7ef]/40 shadow-xs ring-1 ring-[#008069]'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50'
            }`}
          >
            <div
              className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                selectedMode === 'with_messages'
                  ? 'bg-[#008069] text-white'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              <MessageSquareText size={18} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#111b21]">مع المحادثة (بدون الميديا)</h3>
                <span className="rounded-full bg-[#008069]/10 px-2 py-0.5 text-[10px] font-bold text-[#008069]">
                  شامل وخفيف
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[#667781]">
                تصدير كامل لنصوص الدردشة، التفاعلات، الردود، والذكريات مع تجريد وتفريغ ملفات الصور والصوتيات للحفاظ على خفة وسرعة الملف.
              </p>
            </div>
          </button>

          {/* Option 2: Settings Only (Without Conversation) */}
          <button
            type="button"
            disabled={isExporting}
            onClick={() => {
              triggerHaptic('selection');
              setSelectedMode('settings_only');
            }}
            className={`flex w-full cursor-pointer items-start gap-3.5 rounded-2xl border p-4 text-right transition-all ${
              selectedMode === 'settings_only'
                ? 'border-[#008069] bg-[#e7f7ef]/40 shadow-xs ring-1 ring-[#008069]'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50'
            }`}
          >
            <div
              className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                selectedMode === 'settings_only'
                  ? 'bg-[#008069] text-white'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              <Sliders size={18} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#111b21]">بدون المحادثة (فقط الإعدادات)</h3>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                  قالب جديد
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[#667781]">
                تصدير هوية الرفيق وصوته وشخصيته ونموذجه وقوالب الذاكرة كقالب جاهز للبدء من الصفر بدون أي سجل رسائل أو ذاكرة قديمة.
              </p>
            </div>
          </button>

          {/* File Format Badge Info */}
          <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3.5 py-2.5 text-[11px] text-[#54656f]">
            <FileJson size={16} className="shrink-0 text-[#008069]" />
            <span>يتم حفظ الملف كـ JSON منظم (`.rafiq.json`) جاهز للاستيراد والمشاركة مباشرة.</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-[#f8faf9] px-6 py-3.5">
          <button
            type="button"
            disabled={isExporting}
            onClick={onClose}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-[#54656f] hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={() => void handleExport()}
            className="flex items-center gap-2 rounded-xl bg-[#008069] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#00705a] active:scale-95 transition-all disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>جاري التصدير...</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>تصدير وتنزيل الملف</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ExportCompanionModal;
