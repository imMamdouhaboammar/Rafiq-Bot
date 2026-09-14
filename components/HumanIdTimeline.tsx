import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Edit3,
  LockKeyhole,
  Plus,
  Save,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type { LifeStoryEvent } from '../contracts/rafiqV6.js';
import { eventBus } from '../services/eventBus.js';
import {
  normalizeLifeStoryDraft,
  toDateInputValue,
  type LifeStoryDraft,
  type LifeStorySensitivity,
  type LifeStoryVisibility,
} from '../services/lifeStoryForm.js';
import { storyRepository } from '../services/storyRepository.js';
import { useRafiqStore } from '../stores/useRafiqStore.js';

const createEmptyDraft = (): LifeStoryDraft => ({
  title: '',
  summary: '',
  happenedAt: toDateInputValue(new Date()),
  visibility: 'all_bots',
  selectedBotIds: [],
  sensitivity: 'normal',
});

const visibilityLabels: Record<LifeStoryVisibility, string> = {
  all_bots: 'كل البوتات',
  selected_bots: 'بوتات محددة',
  private: 'خاص بي فقط',
};

const sensitivityLabels: Record<LifeStorySensitivity, string> = {
  normal: 'عادي',
  sensitive: 'حساس',
  private: 'شديد الخصوصية',
};

const formatEventDate = (value: Date): string => new Intl.DateTimeFormat('ar-EG', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(new Date(value));

const HumanIdTimeline: React.FC = () => {
  const chats = useRafiqStore(state => state.chats);
  const availableBots = useMemo(() => chats
    .filter(chat => !chat.isGroup)
    .map(chat => ({ id: chat.id, name: chat.settings.botName })), [chats]);
  const [events, setEvents] = useState<LifeStoryEvent[]>([]);
  const [draft, setDraft] = useState<LifeStoryDraft>(() => createEmptyDraft());
  const [editingId, setEditingId] = useState<string>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setEvents(await storyRepository.listLifeEvents());
  }, []);

  useEffect(() => {
    void refresh()
      .catch(error => {
        console.error('[HumanIdTimeline] Failed to load life events:', error);
        eventBus.emit('ui:toast', { message: 'تعذر تحميل خط حياتك', type: 'error' });
      })
      .finally(() => setLoading(false));
  }, [refresh]);

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingId(undefined);
    setDraft(createEmptyDraft());
  };

  const startCreate = () => {
    setEditingId(undefined);
    setDraft(createEmptyDraft());
    setEditorOpen(true);
  };

  const startEdit = (event: LifeStoryEvent) => {
    setEditingId(event.id);
    setDraft({
      title: event.title,
      summary: event.summary,
      happenedAt: toDateInputValue(event.happenedAt),
      visibility: event.acl.visibility,
      selectedBotIds: [...event.acl.botIds],
      sensitivity: event.sensitivity,
    });
    setEditorOpen(true);
  };

  const toggleBot = (botId: string) => {
    setDraft(current => ({
      ...current,
      selectedBotIds: current.selectedBotIds.includes(botId)
        ? current.selectedBotIds.filter(id => id !== botId)
        : [...current.selectedBotIds, botId],
    }));
  };

  const saveDraft = async () => {
    setSaving(true);
    try {
      const normalized = normalizeLifeStoryDraft(draft);
      if (editingId) {
        await storyRepository.updateLifeEvent(editingId, normalized);
      } else {
        await storyRepository.createLifeEvent({
          ...normalized,
          source: 'user_entered',
        });
      }
      await refresh();
      closeEditor();
      eventBus.emit('ui:toast', {
        message: editingId ? 'تم تحديث الحدث' : 'تمت إضافة الحدث إلى خط حياتك',
        type: 'success',
      });
    } catch (error) {
      eventBus.emit('ui:toast', {
        message: error instanceof Error ? error.message : 'تعذر حفظ الحدث',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (event: LifeStoryEvent) => {
    eventBus.emit('ui:dialog', {
      title: 'حذف حدث من خط حياتك',
      message: `سيتم حذف ${event.title} وكل الإشارات المرتبطة به.`,
      tone: 'danger',
      confirmLabel: 'احذف',
      cancelLabel: 'رجوع',
      showCancel: true,
      dismissible: true,
      onConfirm: async () => {
        await storyRepository.deleteLifeEvent(event.id);
        await refresh();
        eventBus.emit('ui:toast', { message: 'تم حذف الحدث', type: 'success' });
      },
    });
  };

  return (
    <div className="space-y-4" aria-labelledby="human-id-timeline-title">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-teal-100 bg-white p-4 shadow-sm">
        <div>
          <h3 id="human-id-timeline-title" className="flex items-center gap-2 text-base font-bold text-gray-800">
            <CalendarDays size={18} className="text-wa-teal" aria-hidden="true" />
            خط حياتي
          </h3>
          <p className="mt-1 max-w-xl text-xs leading-5 text-gray-500">
            سجل الأحداث المهمة وحدد من يقدر يستخدمها لفهم سياقك. الترتيب يبدأ بالأحدث
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-wa-teal px-4 py-2 text-sm font-bold text-white hover:brightness-95"
        >
          <Plus size={17} aria-hidden="true" />
          إضافة حدث
        </button>
      </div>

      {editorOpen ? (
        <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm" aria-label={editingId ? 'تعديل حدث' : 'إضافة حدث'}>
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <strong className="text-sm text-gray-800">{editingId ? 'تعديل الحدث' : 'حدث جديد'}</strong>
            <button type="button" onClick={closeEditor} className="grid min-h-11 min-w-11 place-items-center rounded-full text-gray-500 hover:bg-gray-100" aria-label="إغلاق محرر الحدث">
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_180px]">
            <label className="space-y-1 text-xs font-bold text-gray-600">
              عنوان الحدث
              <input
                type="text"
                value={draft.title}
                maxLength={160}
                onChange={event => setDraft(current => ({ ...current, title: event.target.value }))}
                className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-normal text-gray-900 outline-none focus:border-wa-teal focus:bg-white"
                placeholder="مثال: بدأت شغلي الجديد"
              />
            </label>
            <label className="space-y-1 text-xs font-bold text-gray-600">
              التاريخ
              <input
                type="date"
                value={draft.happenedAt}
                onChange={event => setDraft(current => ({ ...current, happenedAt: event.target.value }))}
                className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-normal text-gray-900 outline-none focus:border-wa-teal focus:bg-white"
              />
            </label>
          </div>

          <label className="block space-y-1 text-xs font-bold text-gray-600">
            ماذا حدث؟
            <textarea
              value={draft.summary}
              maxLength={2000}
              onChange={event => setDraft(current => ({ ...current, summary: event.target.value }))}
              className="min-h-28 w-full resize-y rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm font-normal leading-6 text-gray-900 outline-none focus:border-wa-teal focus:bg-white"
              placeholder="اكتب المعلومات التي تساعد رفيق يفهم المرحلة دي من حياتك"
            />
          </label>

          <fieldset className="space-y-2">
            <legend className="text-xs font-bold text-gray-600">من يقدر يشوف الحدث؟</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(['all_bots', 'selected_bots', 'private'] as LifeStoryVisibility[]).map(visibility => (
                <button
                  key={visibility}
                  type="button"
                  onClick={() => setDraft(current => ({
                    ...current,
                    visibility,
                    selectedBotIds: visibility === 'selected_bots' ? current.selectedBotIds : [],
                  }))}
                  className={`min-h-11 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${draft.visibility === visibility ? 'border-wa-teal bg-teal-50 text-wa-teal' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  aria-pressed={draft.visibility === visibility}
                >
                  {visibilityLabels[visibility]}
                </button>
              ))}
            </div>
          </fieldset>

          {draft.visibility === 'selected_bots' ? (
            <fieldset className="space-y-2 rounded-xl bg-gray-50 p-3">
              <legend className="px-1 text-xs font-bold text-gray-600">اختار البوتات</legend>
              {availableBots.length === 0 ? (
                <p className="text-xs text-gray-500">أنشئ بوتًا أولًا حتى تختاره هنا</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {availableBots.map(bot => (
                    <label key={bot.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={draft.selectedBotIds.includes(bot.id)}
                        onChange={() => toggleBot(bot.id)}
                        className="h-4 w-4 accent-[#008069]"
                      />
                      <span className="truncate">{bot.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          ) : null}

          <label className="block space-y-1 text-xs font-bold text-gray-600">
            درجة الحساسية
            <select
              value={draft.sensitivity}
              onChange={event => setDraft(current => ({ ...current, sensitivity: event.target.value as LifeStorySensitivity }))}
              className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-normal text-gray-900 outline-none focus:border-wa-teal"
            >
              {(Object.keys(sensitivityLabels) as LifeStorySensitivity[]).map(value => (
                <option key={value} value={value}>{sensitivityLabels[value]}</option>
              ))}
            </select>
          </label>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
            <button type="button" onClick={closeEditor} className="min-h-11 rounded-xl px-4 text-sm font-bold text-gray-600 hover:bg-gray-100">إلغاء</button>
            <button
              type="button"
              onClick={() => void saveDraft()}
              disabled={saving}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-wa-teal px-4 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
            >
              <Save size={16} aria-hidden="true" />
              {saving ? 'جاري الحفظ' : 'حفظ الحدث'}
            </button>
          </div>
        </section>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500">جاري تحميل خط حياتك</div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <CalendarDays size={28} className="mx-auto text-gray-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-bold text-gray-700">خط حياتك فارغ حاليًا</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">ابدأ بحدث واحد مهم بدل كتابة سيرة طويلة مرة واحدة</p>
        </div>
      ) : (
        <ol className="relative space-y-3 before:absolute before:bottom-5 before:right-[19px] before:top-5 before:w-px before:bg-teal-100">
          {events.map(event => {
            const visibilityIcon = event.acl.visibility === 'private'
              ? <LockKeyhole size={14} aria-hidden="true" />
              : event.acl.visibility === 'selected_bots'
                ? <UserCheck size={14} aria-hidden="true" />
                : <Users size={14} aria-hidden="true" />;
            return (
              <li key={event.id} className="relative pr-10">
                <span className="absolute right-3 top-5 z-10 h-3.5 w-3.5 rounded-full border-4 border-white bg-wa-teal shadow" aria-hidden="true" />
                <article className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-wa-teal">{formatEventDate(event.happenedAt)}</p>
                      <h4 className="mt-1 text-base font-bold text-gray-900">{event.title}</h4>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">{event.summary}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 font-bold text-gray-600">
                          {visibilityIcon}
                          {visibilityLabels[event.acl.visibility]}
                        </span>
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 font-bold text-amber-700">
                          {sensitivityLabels[event.sensitivity]}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => startEdit(event)} className="grid min-h-11 min-w-11 place-items-center rounded-full text-gray-500 hover:bg-gray-100" aria-label={`تعديل ${event.title}`}>
                        <Edit3 size={17} aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => requestDelete(event)} className="grid min-h-11 min-w-11 place-items-center rounded-full text-rose-600 hover:bg-rose-50" aria-label={`حذف ${event.title}`}>
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

export default HumanIdTimeline;
