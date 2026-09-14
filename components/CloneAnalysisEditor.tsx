import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { BotSettings, SoulMemorySeed } from '../types.js';

type CloneProfile = NonNullable<BotSettings['cloneProfile']>;

export type EditableCloneProfile = CloneProfile & {
  memorySeeds?: SoulMemorySeed[];
};

interface CloneAnalysisEditorProps {
  profile: EditableCloneProfile;
  onChange: (profile: EditableCloneProfile) => void;
  error?: string;
}

const fieldClass = 'min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm leading-6 text-gray-800 transition-colors focus-visible:border-[#00a884] focus-visible:ring-2 focus-visible:ring-[#00a884] focus-visible:ring-offset-2';
const textareaClass = `${fieldClass} resize-y`;
const addButtonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800 transition-colors hover:bg-emerald-100 focus-visible:ring-2 focus-visible:ring-[#00a884] focus-visible:ring-offset-2';
const deleteButtonClass = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-red-600 transition-colors hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2';

const sectionClass = 'rounded-2xl border border-gray-200 bg-white p-4 shadow-sm';

const makeId = (prefix: string): string => {
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
};

const updateStringList = (
  values: string[],
  index: number,
  value: string,
): string[] => values.map((item, itemIndex) => itemIndex === index ? value : item);

const StringListEditor: React.FC<{
  id: string;
  label: string;
  values: string[];
  placeholder: string;
  onChange: (values: string[]) => void;
}> = ({ id, label, values, placeholder, onChange }) => (
  <fieldset className="space-y-2">
    <legend className="text-xs font-bold leading-6 text-gray-600">{label}</legend>
    {values.map((value, index) => (
      <div key={`${id}-${index}`} className="flex items-start gap-2">
        <input
          type="text"
          value={value}
          onChange={event => onChange(updateStringList(values, index, event.target.value))}
          aria-label={`${label} ${index + 1}`}
          className={fieldClass}
          dir="auto"
        />
        <button
          type="button"
          onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}
          aria-label={`حذف ${label} ${index + 1}`}
          className={deleteButtonClass}
        >
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </div>
    ))}
    <button type="button" onClick={() => onChange([...values, ''])} className={addButtonClass}>
      <Plus size={18} aria-hidden="true" />
      {placeholder}
    </button>
  </fieldset>
);

const CloneAnalysisEditor: React.FC<CloneAnalysisEditorProps> = ({ profile, onChange, error }) => {
  const speechStyle = profile.speechStyle || {
    toneSummary: '',
    signaturePhrases: [],
    responsePatterns: [],
    emojiPatterns: [],
  };
  const memorySeeds = profile.memorySeeds || [];
  const timeline = profile.timeline || [];
  const snippets = profile.chatSnippets || [];
  const sourceBatch = profile.analysis?.processedBatches || 0;

  const updateSpeechStyle = (patch: Partial<typeof speechStyle>) => {
    onChange({ ...profile, speechStyle: { ...speechStyle, ...patch } });
  };

  return (
    <div className="space-y-4" dir="rtl" aria-label="تعديل نتيجة تحليل الاستنساخ">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-7 text-blue-900" role="status">
        التحليل اكتمل وتقدر دلوقتي تصحّح النتيجة أو تزود وتحذف منها. التعديلات دي هتبقى المرجع اللي الشخصية بتتكلم وتفتكر منه.
      </div>
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium leading-7 text-red-800" role="alert">
          {error}
        </div>
      ) : null}

      <section className={sectionClass} aria-labelledby="clone-bio-heading">
        <h4 id="clone-bio-heading" className="font-bold text-gray-900">السيرة بصوت الشخصية</h4>
        <p className="mt-1 text-xs leading-6 text-gray-500">اكتبها بصيغة المتكلم وبنفس لغة ولهجة صاحب المحادثة.</p>
        <label htmlFor="clone-rich-bio" className="sr-only">السيرة الذاتية المستنسخة</label>
        <textarea
          id="clone-rich-bio"
          value={profile.richBio || ''}
          onChange={event => onChange({ ...profile, richBio: event.target.value })}
          rows={10}
          className={`${textareaClass} mt-3`}
          dir="auto"
        />
      </section>

      <section className={`${sectionClass} space-y-4`} aria-labelledby="clone-speech-heading">
        <div>
          <h4 id="clone-speech-heading" className="font-bold text-gray-900">التون وطريقة الكلام</h4>
          <p className="mt-1 text-xs leading-6 text-gray-500">عدّل الوصف والقواعد اللي البوت هيستخدمها في ردوده.</p>
        </div>
        <div>
          <label htmlFor="clone-tone-summary" className="mb-1 block text-xs font-bold text-gray-600">وصف النبرة</label>
          <textarea
            id="clone-tone-summary"
            value={speechStyle.toneSummary}
            onChange={event => updateSpeechStyle({ toneSummary: event.target.value })}
            rows={4}
            className={textareaClass}
            dir="auto"
          />
        </div>
        <StringListEditor
          id="signature-phrase"
          label="عبارات مميزة"
          values={speechStyle.signaturePhrases}
          placeholder="إضافة عبارة مميزة"
          onChange={signaturePhrases => updateSpeechStyle({ signaturePhrases })}
        />
        <StringListEditor
          id="response-pattern"
          label="أنماط الرد"
          values={speechStyle.responsePatterns}
          placeholder="إضافة نمط رد"
          onChange={responsePatterns => updateSpeechStyle({ responsePatterns })}
        />
        <StringListEditor
          id="emoji-pattern"
          label="استخدام الإيموجي"
          values={speechStyle.emojiPatterns}
          placeholder="إضافة نمط إيموجي"
          onChange={emojiPatterns => updateSpeechStyle({ emojiPatterns })}
        />
      </section>

      <section className={`${sectionClass} space-y-3`} aria-labelledby="clone-memories-heading">
        <div>
          <h4 id="clone-memories-heading" className="font-bold text-gray-900">الذكريات المزروعة</h4>
          <p className="mt-1 text-xs leading-6 text-gray-500">كل ذكرى هنا لازم تكون حقيقة واضحة عرفناها من المحادثة أو صححتها بنفسك.</p>
        </div>
        {memorySeeds.length === 0 ? (
          <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">مفيش ذكريات ظاهرة للتعديل لسه. تقدر تضيف أول ذكرى.</p>
        ) : null}
        {memorySeeds.map((memory, index) => (
          <div key={`memory-${index}`} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-start gap-2">
              <label htmlFor={`clone-memory-${index}`} className="sr-only">نص الذكرى {index + 1}</label>
              <textarea
                id={`clone-memory-${index}`}
                value={memory.text}
                onChange={event => onChange({
                  ...profile,
                  memorySeeds: memorySeeds.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item),
                })}
                rows={3}
                className={textareaClass}
                dir="auto"
              />
              <button
                type="button"
                onClick={() => onChange({ ...profile, memorySeeds: memorySeeds.filter((_, itemIndex) => itemIndex !== index) })}
                aria-label={`حذف الذكرى ${index + 1}`}
                className={deleteButtonClass}
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-bold text-gray-600">
                النوع
                <select
                  value={memory.category}
                  onChange={event => onChange({
                    ...profile,
                    memorySeeds: memorySeeds.map((item, itemIndex) => itemIndex === index
                      ? { ...item, category: event.target.value as SoulMemorySeed['category'] }
                      : item),
                  })}
                  className={`${fieldClass} mt-1`}
                  aria-label={`نوع الذكرى ${index + 1}`}
                >
                  <option value="identity">هوية</option>
                  <option value="preference">تفضيل</option>
                  <option value="memory">ذكرى</option>
                  <option value="goal">هدف</option>
                  <option value="fact">حقيقة</option>
                  <option value="emotion">مشاعر</option>
                </select>
              </label>
              <label className="text-xs font-bold text-gray-600">
                الأهمية: {Math.round(memory.salience * 100)}%
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={memory.salience}
                  onChange={event => onChange({
                    ...profile,
                    memorySeeds: memorySeeds.map((item, itemIndex) => itemIndex === index
                      ? { ...item, salience: Number(event.target.value) }
                      : item),
                  })}
                  className="mt-1 min-h-11 w-full accent-[#00a884] focus-visible:ring-2 focus-visible:ring-[#00a884] focus-visible:ring-offset-2"
                  aria-label={`أهمية الذكرى ${index + 1}`}
                />
              </label>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange({
            ...profile,
            memorySeeds: [...memorySeeds, { text: '', category: 'memory', salience: 0.7, subject: 'persona' }],
          })}
          className={addButtonClass}
        >
          <Plus size={18} aria-hidden="true" />
          إضافة ذكرى
        </button>
      </section>

      <section className={`${sectionClass} space-y-3`} aria-labelledby="clone-timeline-heading">
        <div>
          <h4 id="clone-timeline-heading" className="font-bold text-gray-900">الخط الزمني والأماكن</h4>
          <p className="mt-1 text-xs leading-6 text-gray-500">رتّب الأحداث المهمة وعدّل وقتها ومكانها.</p>
        </div>
        {timeline.map((event, index) => (
          <fieldset key={event.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <legend className="px-1 text-xs font-bold text-gray-600">حدث {index + 1}</legend>
            <div className="flex items-start gap-2">
              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={event.title}
                  onChange={changeEvent => onChange({ ...profile, timeline: timeline.map(item => item.id === event.id ? { ...item, title: changeEvent.target.value } : item) })}
                  className={fieldClass}
                  aria-label={`عنوان الحدث ${index + 1}`}
                  placeholder="عنوان الحدث"
                  dir="auto"
                />
                <input
                  type="text"
                  value={event.when || ''}
                  onChange={changeEvent => onChange({ ...profile, timeline: timeline.map(item => item.id === event.id ? { ...item, when: changeEvent.target.value || undefined } : item) })}
                  className={fieldClass}
                  aria-label={`وقت الحدث ${index + 1}`}
                  placeholder="الوقت أو التاريخ"
                  dir="auto"
                />
                <input
                  type="text"
                  value={event.location || ''}
                  onChange={changeEvent => onChange({ ...profile, timeline: timeline.map(item => item.id === event.id ? { ...item, location: changeEvent.target.value || undefined } : item) })}
                  className={`${fieldClass} sm:col-span-2`}
                  aria-label={`مكان الحدث ${index + 1}`}
                  placeholder="المكان"
                  dir="auto"
                />
                <textarea
                  value={event.details}
                  onChange={changeEvent => onChange({ ...profile, timeline: timeline.map(item => item.id === event.id ? { ...item, details: changeEvent.target.value } : item) })}
                  rows={3}
                  className={`${textareaClass} sm:col-span-2`}
                  aria-label={`تفاصيل الحدث ${index + 1}`}
                  placeholder="تفاصيل الحدث"
                  dir="auto"
                />
              </div>
              <button
                type="button"
                onClick={() => onChange({ ...profile, timeline: timeline.filter(item => item.id !== event.id) })}
                aria-label={`حذف الحدث ${index + 1}`}
                className={deleteButtonClass}
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </div>
          </fieldset>
        ))}
        <button
          type="button"
          onClick={() => onChange({
            ...profile,
            timeline: [...timeline, {
              id: makeId('manual-event'),
              title: '',
              details: '',
              evidence: [],
              sourceBatch,
            }],
          })}
          className={addButtonClass}
        >
          <Plus size={18} aria-hidden="true" />
          إضافة حدث
        </button>
      </section>

      <section className={`${sectionClass} space-y-3`} aria-labelledby="clone-snippets-heading">
        <div>
          <h4 id="clone-snippets-heading" className="font-bold text-gray-900">مقاطع وجمل كاملة من كلامه</h4>
          <p className="mt-1 text-xs leading-6 text-gray-500">دي أمثلة الكلام الحقيقية اللي البوت بيقلّد إيقاعها. راجعها أو أضف رسالة كاملة.</p>
        </div>
        {snippets.map((snippet, index) => (
          <fieldset key={`snippet-${index}`} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <legend className="px-1 text-xs font-bold text-gray-600">مقطع {index + 1}</legend>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <textarea
                  value={snippet.text}
                  onChange={event => onChange({ ...profile, chatSnippets: snippets.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item) })}
                  rows={3}
                  className={textareaClass}
                  aria-label={`نص المقطع ${index + 1}`}
                  dir="auto"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    value={snippet.context || ''}
                    onChange={event => onChange({ ...profile, chatSnippets: snippets.map((item, itemIndex) => itemIndex === index ? { ...item, context: event.target.value || undefined } : item) })}
                    className={fieldClass}
                    aria-label={`سياق المقطع ${index + 1}`}
                    placeholder="السياق"
                    dir="auto"
                  />
                  <input
                    type="text"
                    value={snippet.tone || ''}
                    onChange={event => onChange({ ...profile, chatSnippets: snippets.map((item, itemIndex) => itemIndex === index ? { ...item, tone: event.target.value || undefined } : item) })}
                    className={fieldClass}
                    aria-label={`نبرة المقطع ${index + 1}`}
                    placeholder="النبرة"
                    dir="auto"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => onChange({ ...profile, chatSnippets: snippets.filter((_, itemIndex) => itemIndex !== index) })}
                aria-label={`حذف المقطع ${index + 1}`}
                className={deleteButtonClass}
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </div>
          </fieldset>
        ))}
        <button
          type="button"
          onClick={() => onChange({
            ...profile,
            chatSnippets: [...snippets, { text: '', sourceBatch }],
          })}
          className={addButtonClass}
        >
          <Plus size={18} aria-hidden="true" />
          إضافة رسالة كاملة
        </button>
      </section>
    </div>
  );
};

export default CloneAnalysisEditor;
