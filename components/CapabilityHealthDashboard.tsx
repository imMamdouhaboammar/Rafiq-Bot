import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  RefreshCw,
  Settings2,
  Stethoscope,
} from 'lucide-react';
import type { CapabilityHealth } from '../contracts/rafiqV6.js';
import {
  capabilityHealthRepository,
  type CapabilityProbe,
} from '../services/capabilityHealthRepository.js';
import { createDefaultCapabilityProbes } from '../services/browserCapabilityProbes.js';

const capabilityLabels: Record<CapabilityHealth['capability'], string> = {
  gemini: 'Gemini',
  groups: 'المجموعات',
  web_reader: 'قراءة الروابط',
  web_search: 'البحث',
  import_export: 'الاستيراد والتصدير',
  attachments: 'المرفقات الكبيرة',
  selfie: 'السيلفي',
};

const statusLabels: Record<CapabilityHealth['status'], string> = {
  healthy: 'يعمل',
  degraded: 'يعمل جزئيًا',
  unavailable: 'غير متاح',
  misconfigured: 'إعداداته ناقصة',
};

const statusConfig: Record<CapabilityHealth['status'], {
  className: string;
  icon: React.ReactNode;
}> = {
  healthy: {
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    icon: <CheckCircle2 size={17} aria-hidden="true" />,
  },
  degraded: {
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    icon: <AlertTriangle size={17} aria-hidden="true" />,
  },
  unavailable: {
    className: 'border-gray-200 bg-gray-50 text-gray-700',
    icon: <CircleOff size={17} aria-hidden="true" />,
  },
  misconfigured: {
    className: 'border-rose-200 bg-rose-50 text-rose-800',
    icon: <Settings2 size={17} aria-hidden="true" />,
  },
};

const formatDate = (value?: Date): string => {
  if (!value) return 'لا يوجد نجاح مسجل';
  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
};

interface CapabilityHealthDashboardProps {
  probes?: CapabilityProbe[];
}

const CapabilityHealthDashboard: React.FC<CapabilityHealthDashboardProps> = ({ probes }) => {
  const availableProbes = useMemo(() => probes || createDefaultCapabilityProbes(), [probes]);
  const [records, setRecords] = useState<CapabilityHealth[]>([]);
  const [testing, setTesting] = useState<CapabilityHealth['capability'] | null>(null);

  const refresh = async () => {
    const existing = await capabilityHealthRepository.list();
    const existingCapabilities = new Set(existing.map(record => record.capability));
    for (const probe of availableProbes) {
      if (!existingCapabilities.has(probe.capability)) {
        await capabilityHealthRepository.evaluateConfiguration(
          probe.capability,
          probe.requirements(),
        );
      }
    }
    setRecords(await capabilityHealthRepository.list());
  };

  useEffect(() => {
    void refresh().catch(error => {
      console.error('[CapabilityHealthDashboard] Failed to load capability records:', error);
    });
  }, [availableProbes]);

  const handleTest = async (probe: CapabilityProbe) => {
    setTesting(probe.capability);
    try {
      await capabilityHealthRepository.runProbe(probe);
      setRecords(await capabilityHealthRepository.list());
    } finally {
      setTesting(null);
    }
  };

  const recordByCapability = new Map<CapabilityHealth['capability'], CapabilityHealth>(
    records.map(record => [record.capability, record] as const),
  );

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm" aria-labelledby="capability-health-title">
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
        <div>
          <h3 id="capability-health-title" className="flex items-center gap-2 text-base font-bold text-gray-800">
            <Stethoscope size={19} className="text-wa-teal" aria-hidden="true" />
            حالة الأدوات
          </h3>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            الحالة هنا مبنية على إعدادات واضحة أو اختبار فعلي، وليست افتراضًا من الواجهة
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="grid min-h-11 min-w-11 place-items-center rounded-full text-gray-500 hover:bg-gray-100"
          aria-label="تحديث حالات الأدوات"
        >
          <RefreshCw size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-3">
        {availableProbes.map(probe => {
          const record = recordByCapability.get(probe.capability);
          const status = record?.status || 'unavailable';
          const config = statusConfig[status];
          const isTesting = testing === probe.capability;

          return (
            <article key={probe.capability} className="rounded-xl border border-gray-100 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold text-gray-900">{capabilityLabels[probe.capability]}</h4>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${config.className}`}>
                      {config.icon}
                      {statusLabels[status]}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-gray-600">
                    {record?.reason || 'لم يتم اختبار هذه الأداة بعد'}
                  </p>
                  <p className="mt-1 text-[11px] text-gray-400">
                    آخر نجاح: {formatDate(record?.lastSuccessAt)}
                  </p>
                  {record?.missingRequirements.length ? (
                    <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-[11px] leading-5 text-rose-700">
                      الناقص: {record.missingRequirements.join('، ')}
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => void handleTest(probe)}
                  disabled={isTesting}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60"
                >
                  <RefreshCw size={15} className={isTesting ? 'animate-spin' : ''} aria-hidden="true" />
                  {isTesting ? 'جاري الاختبار' : 'اختبار فعلي'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default CapabilityHealthDashboard;
