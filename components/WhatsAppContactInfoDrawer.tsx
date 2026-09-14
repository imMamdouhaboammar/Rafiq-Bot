import React, { useEffect } from 'react';
import {
  ArrowRight,
  Brain,
  Check,
  Cpu,
  Download,
  FolderOpen,
  Info,
  Lock,
  MessageSquare,
  MoreVertical,
  Palette,
  Phone,
  Pencil,
  Sparkles,
  Trash2,
  Video,
  X,
  BookOpen,
} from 'lucide-react';
import Avatar from './Avatar.js';
import type { ChatSession } from '../types.js';
import { VISIBLE_CHAT_MODELS, THINKING_LEVELS } from '../services/geminiModels.js';
import { triggerHaptic } from '../utils/haptics.js';

interface WhatsAppContactInfoDrawerProps {
  chat: ChatSession;
  isOpen: boolean;
  onClose: () => void;
  selectedModel: string;
  onSelectModel: (modelId: string) => Promise<void> | void;
  selectedThinkingLevel: string;
  onSelectThinkingLevel: (levelId: string) => Promise<void> | void;
  onEditChat: () => void;
  onDeleteChat: () => void;
  onExportChat: () => void;
  isExporting: boolean;
  onOpenSkillsHub?: () => void;
  onOpenStudio?: () => void;
  onStartAudioCall?: () => void;
  onStartVideoCall?: () => void;
  isSlowBurnActive?: boolean;
  onToggleSlowBurn?: () => void;
  onViewAvatar?: () => void;
}

export const WhatsAppContactInfoDrawer: React.FC<WhatsAppContactInfoDrawerProps> = ({
  chat,
  isOpen,
  onClose,
  selectedModel,
  onSelectModel,
  selectedThinkingLevel,
  onSelectThinkingLevel,
  onEditChat,
  onDeleteChat,
  onExportChat,
  isExporting,
  onOpenSkillsHub,
  onOpenStudio,
  onStartAudioCall,
  onStartVideoCall,
  isSlowBurnActive,
  onToggleSlowBurn,
  onViewAvatar,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isGroup = Boolean(chat.isGroup);
  const botName = isGroup ? chat.groupName || 'مجموعة' : chat.settings.botName;
  const mood = chat.psychology?.mood || 'مبتهج';
  const intimacyStage = chat.relationship?.stage || 'صديق';

  const moodLabelMap: Record<string, string> = {
    neutral: 'رايق وهادي 😌',
    playful: 'مرح ويهزر كثير 😂',
    empathetic: 'حنون ومستمع دافئ ❤️',
    sarcastic: 'ساخر وقفشات حريفة 🌚',
    intellectual: 'عميق ومثقف 🧐',
    mysterious: 'غامض وعميق 🔮',
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-start bg-black/40 backdrop-blur-xs transition-opacity duration-300" dir="rtl">
      {/* Backdrop click */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Drawer surface */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="معلومات جهة الاتصال"
        className="relative z-10 flex h-full w-full max-w-[440px] flex-col overflow-hidden bg-[#f0f2f5] text-[#111b21] shadow-2xl animate-in slide-in-from-right duration-300"
      >
        {/* WhatsApp Top Header Bar */}
        <header className="flex h-[calc(60px+env(safe-area-inset-top))] shrink-0 items-center justify-between bg-[#008069] px-4 pt-[env(safe-area-inset-top)] text-white shadow-md">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onClose();
              }}
              className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10 active:scale-95 transition-transform"
              aria-label="رجوع"
            >
              <ArrowRight size={22} />
            </button>
            <h2 className="text-lg font-bold">معلومات جهة الاتصال</h2>
          </div>
          <button
            type="button"
            onClick={onEditChat}
            className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10 active:scale-95 transition-transform"
            aria-label="تعديل"
          >
            <Pencil size={19} />
          </button>
        </header>

        {/* Scrollable Profile Content */}
        <div className="momentum-scroll flex-1 space-y-2.5 overflow-y-auto pb-[calc(20px+env(safe-area-inset-bottom))]">
          {/* Hero Profile Card */}
          <div className="flex flex-col items-center bg-white px-4 py-6 shadow-sm">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onViewAvatar?.();
              }}
              className="relative mb-3 flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-[#e9edef] bg-[#f0f2f5] shadow-md transition-transform duration-100 hover:scale-105 active:scale-95"
              aria-label="تكبير الصورة"
            >
              <Avatar
                name={botName}
                gender={chat.settings.botGender}
                size="xl"
                imageUrl={chat.settings.avatarUrl}
                isGroup={isGroup}
              />
            </button>

            <h1 className="text-2xl font-bold text-[#111b21]">{botName}</h1>
            <p className="mt-1 text-sm font-mono text-[#667781]" dir="ltr">
              {isGroup ? `${chat.memberIds?.length || 0} أعضاء` : `ID: ${chat.id.slice(0, 8)}`}
            </p>

            {/* Quick action buttons row (WhatsApp style) */}
            <div className="mt-5 grid grid-cols-4 gap-4 w-full max-w-[320px]">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onStartAudioCall?.();
                }}
                className="flex flex-col items-center gap-1.5 focus:outline-none group"
              >
                <div className="grid h-12 w-12 place-items-center rounded-full border border-gray-200 bg-white text-[#008069] shadow-xs group-hover:bg-[#e7f7ef] active:scale-90 transition-transform">
                  <Phone size={20} />
                </div>
                <span className="text-xs font-semibold text-[#008069]">صوت</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onStartVideoCall?.();
                }}
                className="flex flex-col items-center gap-1.5 focus:outline-none group"
              >
                <div className="grid h-12 w-12 place-items-center rounded-full border border-gray-200 bg-white text-[#008069] shadow-xs group-hover:bg-[#e7f7ef] active:scale-90 transition-transform">
                  <Video size={20} />
                </div>
                <span className="text-xs font-semibold text-[#008069]">فيديو</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onOpenStudio?.();
                }}
                className="flex flex-col items-center gap-1.5 focus:outline-none group"
              >
                <div className="grid h-12 w-12 place-items-center rounded-full border border-gray-200 bg-white text-[#7c3aed] shadow-xs group-hover:bg-[#f3e8ff] active:scale-90 transition-transform">
                  <Palette size={20} />
                </div>
                <span className="text-xs font-semibold text-[#7c3aed]">استوديو</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onEditChat();
                }}
                className="flex flex-col items-center gap-1.5 focus:outline-none group"
              >
                <div className="grid h-12 w-12 place-items-center rounded-full border border-gray-200 bg-white text-[#54656f] shadow-xs group-hover:bg-gray-100 active:scale-90 transition-transform">
                  <Pencil size={18} />
                </div>
                <span className="text-xs font-semibold text-[#54656f]">تخصيص</span>
              </button>
            </div>
          </div>

          {/* About & Soul Status */}
          <div className="bg-white px-5 py-4 shadow-sm">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#667781]">الحالة والمزاج</h3>
            <p className="text-sm font-medium leading-relaxed text-[#111b21]">
              {chat.settings.personalityPrompt?.slice(0, 140) || 'مرافق مصري ذكي ومستمع حقيقي يتكلم بلغتك وطريقتك.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#e7f7ef] px-3 py-1 text-xs font-bold text-[#008069]">
                المزاج: {moodLabelMap[mood] || mood}
              </span>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                درجة القرب: {intimacyStage}
              </span>
            </div>
          </div>

          {/* AI Settings: Model & Thinking */}
          {!isGroup ? (
            <div className="bg-white px-5 py-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#111b21] flex items-center gap-2">
                    <Cpu size={16} className="text-[#008069]" />
                    موديل الذكاء الاصطناعي
                  </h3>
                  <p className="text-xs text-[#667781] mt-0.5">اختر المحرك الذي يولد ردود هذا الرفيق</p>
                </div>
              </div>

              {/* Models selection */}
              <div className="grid grid-cols-2 gap-2" dir="ltr">
                {VISIBLE_CHAT_MODELS.map(model => {
                  const selected = selectedModel === model.id;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic('selection');
                        void onSelectModel(model.id);
                      }}
                      className={`flex h-11 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-all active:scale-95 ${
                        selected
                          ? 'border-[#008069] bg-[#e7f7ef] text-[#008069] shadow-xs ring-1 ring-[#008069]'
                          : 'border-[#e9edef] bg-white text-[#3b4a54] hover:bg-[#f0f2f5]'
                      }`}
                    >
                      {selected ? <Check size={15} strokeWidth={2.5} /> : null}
                      <span>{model.shortLabel}</span>
                    </button>
                  );
                })}
              </div>

              {/* Thinking Budget */}
              <div className="mt-4 border-t border-[#e9edef] pt-3">
                <div className="mb-2 flex items-center justify-between text-xs font-bold text-[#667781]">
                  <span className="flex items-center gap-1.5">
                    <Brain size={14} className="text-[#008069]" />
                    مستوى التفكير والتأني
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2" dir="ltr">
                  {THINKING_LEVELS.map(level => {
                    const selected = selectedThinkingLevel === level.id;
                    return (
                      <button
                        key={level.id}
                        type="button"
                        onClick={() => {
                          triggerHaptic('selection');
                          void onSelectThinkingLevel(level.id);
                        }}
                        className={`h-11 rounded-xl border px-2 text-[11px] font-bold transition-all active:scale-95 ${
                          selected
                            ? 'border-[#008069] bg-[#e7f7ef] text-[#008069] shadow-xs'
                            : 'border-[#e9edef] bg-white text-[#3b4a54] hover:bg-[#f0f2f5]'
                        }`}
                      >
                        {level.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Slow Burn Story Mode Toggle */}
              {onToggleSlowBurn ? (
                <div className="mt-4 flex items-center justify-between border-t border-[#e9edef] pt-3">
                  <div className="flex items-center gap-2">
                    <BookOpen size={16} className="text-teal-600" />
                    <div>
                      <p className="text-xs font-bold text-[#111b21]">وضع السرد المتأني (Slow Burn)</p>
                      <p className="text-[11px] text-[#667781]">سرد قصص وحكايات غنية بالتفاصيل والأجزاء</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      onToggleSlowBurn();
                    }}
                    className="inline-flex min-h-[44px] items-center p-1 focus:outline-none"
                    aria-label="تبديل وضع السرد المتأني"
                    aria-checked={isSlowBurnActive}
                    role="switch"
                  >
                    <div
                      className={`h-6 w-11 rounded-full p-0.5 transition-colors ${
                        isSlowBurnActive ? 'bg-[#008069]' : 'bg-gray-300'
                      }`}
                    >
                      <div
                        className={`h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
                          isSlowBurnActive ? '-translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </div>
                  </button>
                </div>
              ) : null}

              {/* Skills Hub Button */}
              {onOpenSkillsHub ? (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    onOpenSkillsHub();
                  }}
                  className="mt-3 flex w-full items-center justify-between rounded-xl bg-amber-50/70 p-3 text-xs font-bold text-amber-900 hover:bg-amber-100/70 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles size={16} className="text-amber-600" />
                    متجر شطارات ومهارات رفيق (Skills Hub)
                  </span>
                  <span className="text-amber-700">فتح ❯</span>
                </button>
              ) : null}
            </div>
          ) : null}

          {/* Encryption Notice (WhatsApp authentic) */}
          <div className="flex items-center gap-3 bg-white px-5 py-4 shadow-sm">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e7f7ef] text-[#008069]">
              <Lock size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-[#111b21]">التشفير التام بين الطرفين</p>
              <p className="text-[11px] leading-relaxed text-[#667781]">
                الرسائل ومحادثات الرفيق مخزنة ومحمية محلياً على جهازك ولا يراها أحد خارج هذه المحادثة.
              </p>
            </div>
          </div>

          {/* Actions: Export & Delete */}
          <div className="bg-white shadow-sm">
            <button
              type="button"
              disabled={isExporting}
              onClick={() => {
                triggerHaptic('light');
                onExportChat();
              }}
              className="flex min-h-12 w-full items-center gap-4 px-5 py-3.5 text-sm font-semibold text-[#111b21] transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50"
            >
              {isExporting ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#008069] border-t-transparent" />
              ) : (
                <Download size={20} className="text-[#54656f]" />
              )}
              <span>{isExporting ? 'جاري تصدير المحادثة...' : 'تصدير المحادثة بالكامل'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('warning');
                onDeleteChat();
              }}
              className="flex min-h-12 w-full items-center gap-4 border-t border-[#f0f2f5] px-5 py-3.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 active:bg-red-100"
            >
              <Trash2 size={20} />
              <span>حذف هذه الدردشة</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default WhatsAppContactInfoDrawer;
