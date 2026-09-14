import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  BookOpenText,
  Check,
  ChevronDown,
  Edit3,
  ExternalLink,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { BotStoryEvent } from '../contracts/rafiqV6.js';
import { eventBus } from '../services/eventBus.js';
import { storyRepository } from '../services/storyRepository.js';
import { useRafiqStore } from '../stores/useRafiqStore.js';

const kindLabels: Record<BotStoryEvent['kind'], string> = {
  observed: 'حدث حقيقي مرصود',
  bio: 'جزء من السيرة',
  imaginary: 'حدث خيالي',
};

const kindClasses: Record<BotStoryEvent['kind'], string> = {
  observed: 'bg-emerald-50 text-emerald-700',
  bio: 'bg-sky-50 text-sky-700',
  imaginary: 'bg-violet-50 text-violet-700',
};

const formatDate = (value: Date): string => new Intl.DateTimeFormat('ar-EG', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

interface CorrectionDraft {
  title: string;
  summary: string;
  confidence: number;
}

const BotStoryPanel: React.FC = () => {
  const chats = useRafiqStore(state => state.chats);
  const setActiveChatId = useRafiqStore(state => state.setActiveChatId);
  const bots = useMemo(() => chats.filter(chat => !chat.isGroup), [chats]);
  const [selectedBotId, setSelectedBotId] = useState('');
  const [events, setEvents] = useState<BotStoryEvent[]>([]);
  const [includeImaginary, setIncludeImaginary] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string>();
  const [correction, setCorrection] = useState<CorrectionDraft>();
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<BotStoryEvent>();

  useEffect(() => {
    if (!selectedBotId && bots[0]) setSelectedBotId(bots[0].id);
    if (selectedBotId && !bots.some(bot => bot.id === selectedBotId)) {
      setSelectedBotId(bots[0]?.id || '');
    }
  }, [bots, selectedBotId]);

  const loadEvents = useCallback(async () => {
    if (!selectedBotId) {
      setEvents([]);
      setLoading(false);
      return;
    }
    const records = await storyRepository.listBotEvents(selectedBotId, includeImaginary);
    setEvents(showHistory ? records : records.filter(event => event.status === 'active'));
  }, [includeImaginary, selectedBotId, showHistory]);

  useEffect(() => {
    setLoading(true);
    void loadEvents()
      .catch(error => {
        console.error('[BotStoryPanel] Failed to load events:', error);
        eventBus.emit('ui:toast', { message: 'تعذر تحميل أحداث البوت', type: 'error' });
      })
      .finally(() => setLoading(false));
  }, [loadEvents]);

  const selectedBot = bots.find(bot => bot.id === selectedBotId);

  const beginCorrection = (event: BotStoryEvent) => {
    setEditingId(event.id);
    setCorrection({
      title: event.title,
      summary: event.summary,
      confidence: event.confidence,
    });
  };

  const cancelCorrection = () => {
    setEditingId(undefined);
    setCorrection(undefined);
  };

  const saveCorrection = async (event: BotStoryEvent) => {
    if (!correction) return;
    const title = correction.title.trim();
    const summary = correction.summary.trim();
    if (!title || !summary) {
      eventBus.emit('ui:toast', { message: 'اكتب عنوانًا وملخصًا للتصحيح', type: 'warning' });
      return;
    }

    setSaving(true);
    try {
      await storyRepository.correctBotEvent(event.id, {
        title,
        summary,
        confidence: Math.max(0, Math.min(1, correction.confidence)),
        sourceMessageIds: event.sourceMessageIds,
        acl: event.acl,
      });
      await loadEvents();
      cancelCorrection();
      eventBus.emit('ui:toast', { message: 'تم حفظ التصحيح مع الاحتفاظ بالنسخة السابقة', type: 'success' });
    } catch (error) {
      eventBus.emit('ui:toast', {
        message: error instanceof Error ? error.message : 'تعذر تصحيح الحدث',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const event = pendingDelete;
    try {
      await storyRepository.deleteBotEvent(event.id);
      await loadEvents();
      setPendingDelete(undefined);
      if (editingId === event.id) cancelCorrection();
      eventBus.emit('ui:toast', { message: 'تم حذف الحدث من القصة النشطة', type: 'success' });
    } catch (error) {
      eventBus.emit('ui:toast', {
        message: error instanceof Error ? error.message : 'تعذر حذف الحدث',
        type: 'error',
      });
    }
  };

  const focusSourceMessage = (event: BotStoryEvent, messageId: string) => {
    setActiveChatId(event.sourceGroupId || event.botId);
    let attempts = 0;
    const scrollToSource = () => {
      const bubble = document.getElementById(`bubble-${messageId}`);
      if (bubble) {
        bubble.scrollIntoView({ behavior: 'smooth', block: 'center' });
        bubble.animate(
          [
            { outline: '0 solid rgba(0,128,105,0)' },
            { outline: '4px solid rgba(0,128,105,0.35)' },
            { outline: '0 solid rgba(0,128,105,0)' },
          ],
          { duration: 1400, easing: 'ease-out' },
        );
        return;
      }
      attempts += 1;
      if (attempts < 5) {
        window.setTimeout(scrollToSource, 250);
      } else {
        eventBus.emit('ui:toast', {
          message: 'تم فتح المحادثة، لكن الرسالة قد تكون خارج نافذة الرسائل المحملة',
          type: 'info',
        });
      }
    };
    window.setTimeout(scrollToSource, 120);
  };

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm" aria-labelledby="bot-story-title">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <h2 id="bot-story-title" className="flex items-center gap-2 text-base font-bold text-gray-800">
            <BookOpenText size={19} className="text-wa-teal" aria-hidden="true" />
            قصة البوت
          </h2>
          <p className="mt-1 max-w-xl text-xs leading-5 text-gray-500">
            راجع الأحداث التي يعتبرها البوت جزءًا من قصته، وافصل بوضوح بين الحقيقي والخيالي، وصحح أي استنتاج غير دقيق
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadEvents()}
          className="grid min-h-11 min-w-11 place-items-center rounded-full text-gray-500 hover:bg-gray-100"
          aria-label="تحديث قصة البوت"
        >
          <RefreshCw size={18} aria-hidden="true" />
        </button>
      </div>

      {bots.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-8 text-center">
          <Bot size={28} className="mx-auto text-gray-300" aria-hidden="true" />
          <p className="mt-2 text-sm font-bold text-gray-700">لا يوجد بوت لمراجعة قصته</p>
          <p className="mt-1 text-xs text-gray-500">أنشئ بوتًا أولًا ثم ارجع إلى هذه الشاشة</p>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <label className="relative block">
              <span className="sr-only">اختار البوت</span>
              <select
                value={selectedBotId}
                onChange={event => setSelectedBotId(event.target.value)}
                className="min-h-11 w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-3 pl-10 text-sm font-bold text-gray-800 outline-none focus:border-wa-teal"
              >
                {bots.map(bot => <option key={bot.id} value={bot.id}>{bot.settings.botName}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} aria-hidden="true" />
            </label>

            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-3 text-xs font-bold text-gray-600">
              <input
                type="checkbox"
                checked={includeImaginary}
                onChange={event => setIncludeImaginary(event.target.checked)}
                className="h-4 w-4 accent-[#008069]"
              />
              عرض الأحداث الخيالية
            </label>

            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-3 text-xs font-bold text-gray-600">
              <input
                type="checkbox"
                checked={showHistory}
                onChange={event => setShowHistory(event.target.checked)}
                className="h-4 w-4 accent-[#008069]"
              />
              عرض النسخ المصححة القديمة
            </label>
          </div>

          {pendingDelete ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4" role="alertdialog" aria-labelledby="delete-bot-story-title">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 id="delete-bot-story-title" className="font-bold text-rose-900">حذف الحدث من قصة {selectedBot?.settings.botName}؟</h3>
                  <p className="mt-1 text-xs leading-5 text-rose-700">سيبقى السجل تقنيًا بحالة deleted للتتبع، لكنه لن يظهر كحدث نشط</p>
                  <p className="mt-2 rounded-lg bg-white/70 p-2 text-xs font-bold text-gray-700">{pendingDelete.title}</p>
                </div>
                <button type="button" onClick={() => setPendingDelete(undefined)} className="grid min-h-11 min-w-11 place-items-center rounded-full text-rose-700 hover:bg-rose-100" aria-label="إلغاء الحذف">
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setPendingDelete(undefined)} className="min-h-11 rounded-xl px-4 text-sm font-bold text-gray-600 hover:bg-white/70">رجوع</button>
                <button type="button" onClick={() => void confirmDelete()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-bold text-white">
                  <Trash2 size={16} aria-hidden="true" />
                  احذف الحدث
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="rounded-xl bg-gray-50 p-8 text-center text-sm text-gray-500">جاري تحميل قصة البوت</div>
            ) : events.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
                <Sparkles size={28} className="mx-auto text-gray-300" aria-hidden="true" />
                <p className="mt-2 text-sm font-bold text-gray-700">لا توجد أحداث مطابقة</p>
                <p className="mt-1 text-xs text-gray-500">الأحداث ستظهر هنا عندما تُسجل من السيرة أو المحادثات</p>
              </div>
            ) : events.map(event => {
              const isEditing = editingId === event.id && correction;
              return (
                <article key={event.id} className={`rounded-xl border p-4 ${event.status === 'superseded' ? 'border-gray-100 bg-gray-50 opacity-75' : 'border-gray-100 bg-white'}`}>
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-sm text-gray-800">تصحيح الحدث</strong>
                        <button type="button" onClick={cancelCorrection} className="grid min-h-11 min-w-11 place-items-center rounded-full text-gray-500 hover:bg-gray-100" aria-label="إلغاء التصحيح">
                          <X size={18} aria-hidden="true" />
                        </button>
                      </div>
                      <label className="block text-xs font-bold text-gray-600">
                        العنوان
                        <input
                          type="text"
                          value={correction.title}
                          maxLength={160}
                          onChange={change => setCorrection(current => current ? { ...current, title: change.target.value } : current)}
                          className="mt-1 min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-normal text-gray-900 outline-none focus:border-wa-teal"
                        />
                      </label>
                      <label className="block text-xs font-bold text-gray-600">
                        التفسير الصحيح
                        <textarea
                          value={correction.summary}
                          maxLength={2000}
                          onChange={change => setCorrection(current => current ? { ...current, summary: change.target.value } : current)}
                          className="mt-1 min-h-28 w-full resize-y rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm font-normal leading-6 text-gray-900 outline-none focus:border-wa-teal"
                        />
                      </label>
                      <label className="block text-xs font-bold text-gray-600">
                        درجة الثقة: {Math.round(correction.confidence * 100)}%
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={correction.confidence}
                          onChange={change => setCorrection(current => current ? { ...current, confidence: Number(change.target.value) } : current)}
                          className="mt-2 w-full accent-[#008069]"
                        />
                      </label>
                      <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
                        <button type="button" onClick={cancelCorrection} className="min-h-11 rounded-xl px-4 text-sm font-bold text-gray-600 hover:bg-gray-100">إلغاء</button>
                        <button type="button" onClick={() => void saveCorrection(event)} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-wa-teal px-4 text-sm font-bold text-white disabled:opacity-60">
                          <Save size={16} aria-hidden="true" />
                          {saving ? 'جاري الحفظ' : 'احفظ التصحيح'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className={`rounded-full px-2.5 py-1 font-bold ${kindClasses[event.kind]}`}>{kindLabels[event.kind]}</span>
                          {event.status === 'superseded' ? <span className="rounded-full bg-gray-200 px-2.5 py-1 font-bold text-gray-600">نسخة سابقة</span> : <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700"><Check size={12} aria-hidden="true" /> نشط</span>}
                          <span className="text-gray-400">ثقة {Math.round(event.confidence * 100)}%</span>
                        </div>
                        <h3 className="mt-3 text-sm font-bold leading-6 text-gray-900">{event.title}</h3>
                        <p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-gray-600">{event.summary}</p>
                        <p className="mt-2 text-[11px] text-gray-400">آخر تحديث: {formatDate(event.updatedAt)}</p>

                        {event.sourceMessageIds.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                            <span className="w-full text-[11px] font-bold text-gray-500">الرسائل المصدر</span>
                            {event.sourceMessageIds.slice(0, 6).map((messageId, index) => (
                              <button
                                key={messageId}
                                type="button"
                                onClick={() => focusSourceMessage(event, messageId)}
                                className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-gray-100 px-3 text-[11px] font-bold text-gray-600 hover:bg-teal-50 hover:text-wa-teal"
                              >
                                <ExternalLink size={13} aria-hidden="true" />
                                افتح المصدر {index + 1}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      {event.status === 'active' ? (
                        <div className="flex shrink-0 gap-1">
                          <button type="button" onClick={() => beginCorrection(event)} className="grid min-h-11 min-w-11 place-items-center rounded-full text-gray-500 hover:bg-gray-100" aria-label={`تصحيح ${event.title}`}>
                            <Edit3 size={17} aria-hidden="true" />
                          </button>
                          <button type="button" onClick={() => setPendingDelete(event)} className="grid min-h-11 min-w-11 place-items-center rounded-full text-rose-600 hover:bg-rose-50" aria-label={`حذف ${event.title}`}>
                            <Trash2 size={17} aria-hidden="true" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
};

export default BotStoryPanel;
