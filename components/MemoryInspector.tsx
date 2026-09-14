import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Brain,
  CalendarClock,
  ChevronDown,
  Eye,
  Filter,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { MemoryRecord, MemoryScope } from '../contracts/rafiqV6.js';
import { eventBus } from '../services/eventBus.js';
import { memoryRepository } from '../services/memoryRepository.js';
import { useRafiqStore } from '../stores/useRafiqStore.js';

const scopeLabels: Record<MemoryScope, string> = {
  user_story: 'قصة المستخدم',
  bot: 'ذاكرة بوت',
  chat: 'محادثة',
  group: 'مجموعة',
  knowledge: 'معرفة',
};

const categoryLabels: Record<MemoryRecord['category'], string> = {
  identity: 'هوية',
  preference: 'تفضيل',
  memory: 'ذكرى',
  goal: 'هدف',
  fact: 'معلومة',
  emotion: 'شعور',
  general: 'عام',
};

const retentionLabels: Record<MemoryRecord['retention'], string> = {
  durable: 'دائمة',
  transient_7d: '7 أيام',
  general_30d: '30 يومًا',
  manual: 'حتى الحذف اليدوي',
};

const sensitivityClasses: Record<MemoryRecord['sensitivity'], string> = {
  normal: 'bg-gray-100 text-gray-600',
  sensitive: 'bg-amber-50 text-amber-700',
  private: 'bg-rose-50 text-rose-700',
};

const formatDate = (value: Date): string => new Intl.DateTimeFormat('ar-EG', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

const MemoryInspector: React.FC = () => {
  const chats = useRafiqStore(state => state.chats);
  const [records, setRecords] = useState<MemoryRecord[]>([]);
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<MemoryScope | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [forgettingId, setForgettingId] = useState<string>();
  const [pendingForget, setPendingForget] = useState<MemoryRecord>();

  const chatNames = useMemo(() => new Map(chats.map(chat => [
    chat.id,
    chat.isGroup ? chat.groupName || chat.settings.botName : chat.settings.botName,
  ] as const)), [chats]);

  const loadRecords = useCallback(async () => {
    const nextRecords = await memoryRepository.list({
      status: 'active',
      scopes: scope === 'all' ? undefined : [scope],
      text: search.trim() || undefined,
    });
    setRecords(nextRecords);
  }, [scope, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRecords()
        .catch(error => {
          console.error('[MemoryInspector] Failed to load memories:', error);
          eventBus.emit('ui:toast', { message: 'تعذر تحميل الذاكرة', type: 'error' });
        })
        .finally(() => setLoading(false));
    }, search ? 180 : 0);
    return () => window.clearTimeout(timer);
  }, [loadRecords, search]);

  const resolveScopeName = (record: MemoryRecord): string => {
    if (record.scope === 'user_story') return 'خط حياتك';
    if (record.scope === 'knowledge') return record.scopeId;
    return chatNames.get(record.scopeId) || record.scopeId;
  };

  const confirmForget = async () => {
    if (!pendingForget) return;
    const target = pendingForget;
    setForgettingId(target.id);
    try {
      const forgottenCount = await memoryRepository.forgetEverywhere({ ids: [target.id] });
      await loadRecords();
      setPendingForget(undefined);
      eventBus.emit('ui:toast', {
        message: forgottenCount > 0 ? 'تم نسيان المعلومة من كل النطاقات المرتبطة' : 'المعلومة لم تعد موجودة',
        type: 'success',
      });
    } catch (error) {
      eventBus.emit('ui:toast', {
        message: error instanceof Error ? error.message : 'تعذر نسيان المعلومة',
        type: 'error',
      });
    } finally {
      setForgettingId(undefined);
    }
  };

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm" aria-labelledby="memory-inspector-title">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <h2 id="memory-inspector-title" className="flex items-center gap-2 text-base font-bold text-gray-800">
            <Brain size={19} className="text-wa-teal" aria-hidden="true" />
            مراقب الذاكرة
          </h2>
          <p className="mt-1 max-w-xl text-xs leading-5 text-gray-500">
            راجع ما يتذكره رفيق حاليًا، واعرف مصدره ونطاقه، أو امسحه من كل الأماكن المرتبطة
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadRecords()}
          className="grid min-h-11 min-w-11 place-items-center rounded-full text-gray-500 hover:bg-gray-100"
          aria-label="تحديث قائمة الذاكرة"
        >
          <RefreshCw size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px]">
        <label className="relative block">
          <span className="sr-only">ابحث في الذاكرة</span>
          <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="ابحث في النص أو الملخص"
            className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-3 pr-10 text-sm outline-none focus:border-wa-teal focus:bg-white"
          />
        </label>
        <label className="relative block">
          <span className="sr-only">تصفية حسب النطاق</span>
          <Filter className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} aria-hidden="true" />
          <select
            value={scope}
            onChange={event => setScope(event.target.value as MemoryScope | 'all')}
            className="min-h-11 w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-10 text-sm outline-none focus:border-wa-teal"
          >
            <option value="all">كل النطاقات</option>
            {(Object.keys(scopeLabels) as MemoryScope[]).map(value => (
              <option key={value} value={value}>{scopeLabels[value]}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} aria-hidden="true" />
        </label>
      </div>

      {pendingForget ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4" role="alertdialog" aria-labelledby="forget-memory-title" aria-describedby="forget-memory-description">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="forget-memory-title" className="font-bold text-rose-900">نسيان هذه المعلومة في كل مكان؟</h3>
              <p id="forget-memory-description" className="mt-1 text-xs leading-5 text-rose-700">
                سيتم تعليم السجل وأي نسخة مرتبطة به كمعلومة منسية، ولن تظهر في الاستدعاء النشط
              </p>
              <p className="mt-2 line-clamp-3 rounded-lg bg-white/70 p-2 text-xs leading-5 text-gray-700">{pendingForget.text}</p>
            </div>
            <button type="button" onClick={() => setPendingForget(undefined)} className="grid min-h-11 min-w-11 place-items-center rounded-full text-rose-700 hover:bg-rose-100" aria-label="إلغاء النسيان">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setPendingForget(undefined)} className="min-h-11 rounded-xl px-4 text-sm font-bold text-gray-600 hover:bg-white/70">رجوع</button>
            <button
              type="button"
              onClick={() => void confirmForget()}
              disabled={forgettingId === pendingForget.id}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
            >
              <Trash2 size={16} aria-hidden="true" />
              {forgettingId === pendingForget.id ? 'جاري النسيان' : 'انسَ في كل مكان'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="rounded-xl bg-gray-50 p-8 text-center text-sm text-gray-500">جاري تحميل الذاكرة</div>
        ) : records.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
            <Eye size={26} className="mx-auto text-gray-300" aria-hidden="true" />
            <p className="mt-2 text-sm font-bold text-gray-700">لا توجد نتائج نشطة</p>
            <p className="mt-1 text-xs text-gray-500">غيّر البحث أو النطاق، أو ابدأ محادثة جديدة لتتكون ذكريات</p>
          </div>
        ) : records.map(record => (
          <article key={record.id} className="rounded-xl border border-gray-100 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="rounded-full bg-teal-50 px-2.5 py-1 font-bold text-wa-teal">{categoryLabels[record.category]}</span>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 font-bold text-gray-600">{scopeLabels[record.scope]}: {resolveScopeName(record)}</span>
                  <span className={`rounded-full px-2.5 py-1 font-bold ${sensitivityClasses[record.sensitivity]}`}>{record.sensitivity}</span>
                </div>
                <h3 className="mt-3 text-sm font-bold leading-6 text-gray-900">{record.summary}</h3>
                {record.text !== record.summary ? <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-gray-600">{record.text}</p> : null}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400">
                  <span className="inline-flex items-center gap-1"><CalendarClock size={13} aria-hidden="true" /> آخر تحديث: {formatDate(record.updatedAt)}</span>
                  <span>الاحتفاظ: {retentionLabels[record.retention]}</span>
                  <span>الثقة: {Math.round(record.confidence * 100)}%</span>
                  <span>الأهمية: {Math.round(record.salience * 100)}%</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingForget(record)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-100 px-3 text-xs font-bold text-rose-600 hover:bg-rose-50"
              >
                <Trash2 size={15} aria-hidden="true" />
                انسَ في كل مكان
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default MemoryInspector;
