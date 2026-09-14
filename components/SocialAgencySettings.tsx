import React, { useEffect, useState } from 'react';
import {
  Clock3,
  MessageCircleMore,
  Save,
  ShieldCheck,
  TimerReset,
} from 'lucide-react';
import type { SocialAgency } from '../contracts/rafiqV6.js';
import { eventBus } from '../services/eventBus.js';
import { socialAgencyRepository } from '../services/socialAgencyRepository.js';

interface SocialAgencySettingsProps {
  botId: string;
}

const SocialAgencySettings: React.FC<SocialAgencySettingsProps> = ({ botId }) => {
  const [settings, setSettings] = useState<SocialAgency>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState<string>();

  useEffect(() => {
    let active = true;
    setLoadError(undefined);
    void socialAgencyRepository.get(botId)
      .then(record => {
        if (!active) return;
        const { botId: _botId, updatedAt: _updatedAt, ...agency } = record;
        setSettings(agency);
      })
      .catch(error => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : 'تعذر تحميل إعدادات حضور البوت');
      });
    return () => { active = false; };
  }, [botId]);

  if (loadError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert">
        {loadError}
      </div>
    );
  }

  if (!settings) {
    return <div className="min-h-32 animate-pulse rounded-xl bg-gray-100" role="status" aria-label="جاري تحميل إعدادات البوت" />;
  }

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await socialAgencyRepository.save(botId, settings);
      setSaved(true);
      eventBus.emit('ui:toast', { message: 'تم حفظ طريقة حضور البوت', type: 'success' });
      window.setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      eventBus.emit('ui:toast', {
        message: error instanceof Error ? error.message : 'تعذر حفظ إعدادات حضور البوت',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm" aria-labelledby={`social-agency-title-${botId}`}>
      <div>
        <h3 id={`social-agency-title-${botId}`} className="flex items-center gap-2 text-base font-bold text-gray-900">
          <MessageCircleMore size={19} className="text-wa-teal" aria-hidden="true" />
          طريقة حضور البوت
        </h3>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          الجرأة والمبادرة إعدادان منفصلان. رفع الجرأة لا يطيل الرد تلقائيًا، وتعطيل المبادرة يمنع الرسائل التي يبدأها البوت من نفسه
        </p>
      </div>

      <label className="block space-y-2">
        <span className="flex items-center justify-between text-sm font-bold text-gray-800">
          <span>وضوح الرأي والاختلاف المهذب</span>
          <output>{settings.boldness}%</output>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={settings.boldness}
          onChange={event => setSettings(current => current ? ({ ...current, boldness: Number(event.target.value) }) : current)}
          className="w-full accent-[#008069]"
          aria-label="مستوى الجرأة"
        />
      </label>

      <label className="block space-y-2">
        <span className="flex items-center justify-between text-sm font-bold text-gray-800">
          <span>بدء الحديث والمتابعة</span>
          <output>{settings.proactivity}%</output>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={settings.proactivity}
          disabled={settings.unsolicitedDailyLimit === 0}
          onChange={event => setSettings(current => current ? ({ ...current, proactivity: Number(event.target.value) }) : current)}
          className="w-full accent-[#008069] disabled:opacity-40"
          aria-label="مستوى المبادرة"
        />
      </label>

      <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700">
        <span>
          <strong className="block text-gray-800">السماح برسالة يبدأها البوت</strong>
          <span className="text-[11px] text-gray-500">رسالة واحدة كحد أقصى في اليوم، مع تطبيق cooldown ومنع تكرار الموضوع</span>
        </span>
        <input
          type="checkbox"
          checked={settings.unsolicitedDailyLimit === 1}
          onChange={event => setSettings(current => current ? ({
            ...current,
            unsolicitedDailyLimit: event.target.checked ? 1 : 0,
          }) : current)}
          className="h-5 w-5 shrink-0 accent-[#008069]"
          aria-label="السماح بالرسائل الاستباقية"
        />
      </label>

      <label className="block space-y-2">
        <span className="flex items-center justify-between text-sm font-bold text-gray-800">
          <span className="flex items-center gap-1"><TimerReset size={15} aria-hidden="true" /> الفترة بين الرسائل الاستباقية</span>
          <output>{settings.cooldownHours} ساعة</output>
        </span>
        <input
          type="range"
          min={12}
          max={168}
          step={12}
          value={settings.cooldownHours}
          disabled={settings.unsolicitedDailyLimit === 0}
          onChange={event => setSettings(current => current ? ({ ...current, cooldownHours: Number(event.target.value) }) : current)}
          className="w-full accent-[#008069] disabled:opacity-40"
          aria-label="مدة الانتظار بين الرسائل الاستباقية"
        />
      </label>

      <label className="flex min-h-11 items-center gap-3 rounded-xl bg-gray-50 px-3 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={settings.quietHours.enabled}
          disabled={settings.unsolicitedDailyLimit === 0}
          onChange={event => setSettings(current => current ? ({
            ...current,
            quietHours: { ...current.quietHours, enabled: event.target.checked },
          }) : current)}
          className="h-5 w-5 accent-[#008069]"
        />
        تفعيل ساعات الهدوء
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-bold text-gray-700">
          <span className="flex items-center gap-1"><Clock3 size={14} aria-hidden="true" /> بداية الهدوء</span>
          <input
            type="number"
            min={0}
            max={23}
            value={settings.quietHours.startHour}
            disabled={!settings.quietHours.enabled || settings.unsolicitedDailyLimit === 0}
            onChange={event => setSettings(current => current ? ({
              ...current,
              quietHours: { ...current.quietHours, startHour: Number(event.target.value) },
            }) : current)}
            className="min-h-11 w-full rounded-xl border border-gray-200 px-3 disabled:bg-gray-100"
          />
        </label>
        <label className="space-y-1 text-xs font-bold text-gray-700">
          <span className="flex items-center gap-1"><Clock3 size={14} aria-hidden="true" /> نهاية الهدوء</span>
          <input
            type="number"
            min={0}
            max={23}
            value={settings.quietHours.endHour}
            disabled={!settings.quietHours.enabled || settings.unsolicitedDailyLimit === 0}
            onChange={event => setSettings(current => current ? ({
              ...current,
              quietHours: { ...current.quietHours, endHour: Number(event.target.value) },
            }) : current)}
            className="min-h-11 w-full rounded-xl border border-gray-200 px-3 disabled:bg-gray-100"
          />
        </label>
      </div>

      <label className="block space-y-1 text-xs font-bold text-gray-700">
        المنطقة الزمنية
        <input
          type="text"
          value={settings.quietHours.timezone}
          disabled={!settings.quietHours.enabled || settings.unsolicitedDailyLimit === 0}
          onChange={event => setSettings(current => current ? ({
            ...current,
            quietHours: { ...current.quietHours, timezone: event.target.value },
          }) : current)}
          className="min-h-11 w-full rounded-xl border border-gray-200 px-3 font-mono text-sm font-normal disabled:bg-gray-100"
          placeholder="Africa/Cairo"
        />
      </label>

      <div className="rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
        <span className="flex items-center gap-1 font-bold"><ShieldCheck size={15} aria-hidden="true" /> حدود ثابتة</span>
        الحد اليومي لا يتجاوز رسالة واحدة، والفاصل لا يقل عن 12 ساعة، مع منع الإلحاح والتملك وتكرار نفس الموضوع
      </div>

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-wa-teal px-4 text-sm font-bold text-white disabled:opacity-60"
      >
        <Save size={16} aria-hidden="true" />
        {saving ? 'جاري الحفظ' : saved ? 'تم الحفظ' : 'حفظ الإعدادات'}
      </button>
    </section>
  );
};

export default SocialAgencySettings;
