import React from 'react';
import type { BotSettings } from '../types.js';

type CloneProfile = NonNullable<BotSettings['cloneProfile']>;

interface CloneAnalysisStatusProps {
  profile: CloneProfile;
  compact?: boolean;
  onResume?: () => void;
}

const statusLabel: Record<NonNullable<CloneProfile['analysis']>['status'], string> = {
  initializing: 'تجهيز أول جزء',
  analyzing: 'التحليل مستمر في الخلفية',
  ready: 'اكتمل التحليل',
  partial: 'تم حفظ نتيجة جزئية',
  error: 'توقف التحليل مؤقتًا',
};

const CloneAnalysisStatus: React.FC<CloneAnalysisStatusProps> = ({
  profile,
  compact = false,
  onResume,
}) => {
  const analysis = profile.analysis;
  if (!analysis) return null;

  const completed = Math.min(analysis.processedBatches, analysis.totalBatches);
  const progress = Math.round((completed / analysis.totalBatches) * 100);
  const canResume = Boolean(onResume && (analysis.status === 'error' || analysis.status === 'partial'));
  const editableMemories = (profile as CloneProfile & { memorySeeds?: unknown[] }).memorySeeds;
  const memoryCount = editableMemories?.length ?? analysis.capturedMemories;

  return (
    <section
      className={`rounded-2xl border border-emerald-200 bg-emerald-50/95 text-right text-[#1f2c33] ${compact ? 'mx-2 mt-2 px-3 py-2' : 'p-4'}`}
      aria-label="حالة تحليل الشخصية المستنسخة"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-emerald-800">{statusLabel[analysis.status]}</p>
          <p className="mt-0.5 text-xs text-[#54656f]" aria-live="polite">
            تم تحليل {completed} من {analysis.totalBatches} أجزاء
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-emerald-700 shadow-sm">
          {progress}%
        </span>
      </div>

      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={analysis.totalBatches}
        aria-valuenow={completed}
        aria-valuetext={`تم تحليل ${completed} من ${analysis.totalBatches} أجزاء`}
      >
        <div className="h-full rounded-full bg-[#00a884] transition-[width] motion-reduce:transition-none" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl bg-white p-2"><strong className="block text-sm text-[#008069]">{memoryCount}</strong>ذكرى</div>
        <div className="rounded-xl bg-white p-2"><strong className="block text-sm text-[#008069]">{analysis.capturedEvents}</strong>حدث</div>
        <div className="rounded-xl bg-white p-2"><strong className="block text-sm text-[#008069]">{analysis.capturedSnippets}</strong>مقطع حقيقي</div>
      </div>

      {analysis.error ? (
        <div role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          <p>{analysis.error}</p>
          {canResume ? (
            <button
              type="button"
              onClick={onResume}
              className="mt-2 min-h-11 rounded-xl bg-amber-900 px-4 py-2 font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
            >
              كمّل من آخر جزء محفوظ
            </button>
          ) : null}
        </div>
      ) : null}

      <details open={!compact} className="mt-3">
        <summary className={compact ? 'min-h-11 cursor-pointer rounded-xl bg-white px-3 py-2 text-sm font-bold text-[#008069] outline-none focus-visible:ring-2 focus-visible:ring-[#00a884]' : 'sr-only'}>
          عرض التفاصيل الملتقطة
        </summary>
        <div className="mt-4 space-y-4">
          {profile.richBio ? (
            <article className="rounded-xl bg-white p-4">
              <h5 className="font-bold text-[#111b21]">السيرة الملتقطة حتى الآن</h5>
              <p className="mt-2 whitespace-pre-line text-sm leading-7 text-[#3b4a54]">{profile.richBio}</p>
            </article>
          ) : null}

          {profile.speechStyle ? (
            <article className="rounded-xl bg-white p-4">
              <h5 className="font-bold text-[#111b21]">التون وطريقة الكلام</h5>
              <p className="mt-2 text-sm leading-6 text-[#3b4a54]">{profile.speechStyle.toneSummary}</p>
              {profile.speechStyle.signaturePhrases.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.speechStyle.signaturePhrases.slice(0, 12).map(phrase => (
                    <span key={phrase} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800">{phrase}</span>
                  ))}
                </div>
              ) : null}
            </article>
          ) : null}

          {profile.timeline && profile.timeline.length > 0 ? (
            <article className="rounded-xl bg-white p-4">
              <h5 className="font-bold text-[#111b21]">الخط الزمني والأماكن</h5>
              <ol className="mt-3 space-y-3 border-s-2 border-emerald-100 ps-4">
                {profile.timeline.slice(0, 12).map(event => (
                  <li key={event.id} className="relative text-sm">
                    <span className="absolute -start-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#00a884]" aria-hidden="true" />
                    <p className="font-bold text-[#111b21]">{event.title}</p>
                    <p className="mt-1 leading-6 text-[#54656f]">{event.details}</p>
                    <p className="mt-1 text-xs text-[#667781]">
                      {event.when ? <time dateTime={event.when}>{event.when}</time> : 'الوقت غير محدد'}
                      {event.location ? ` • ${event.location}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            </article>
          ) : null}

          {profile.chatSnippets && profile.chatSnippets.length > 0 ? (
            <article className="rounded-xl bg-white p-4">
              <h5 className="font-bold text-[#111b21]">مقاطع حقيقية من كلامه</h5>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {profile.chatSnippets.slice(0, 12).map((snippet, index) => (
                  <blockquote key={`${snippet.sourceBatch}:${index}:${snippet.text}`} className="rounded-xl border-s-4 border-[#00a884] bg-[#f0f2f5] p-3 text-sm leading-6" dir="auto">
                    “{snippet.text}”
                    {snippet.tone ? <footer className="mt-1 text-xs text-[#667781]">{snippet.tone}</footer> : null}
                  </blockquote>
                ))}
              </div>
            </article>
          ) : null}
        </div>
      </details>
    </section>
  );
};

export default CloneAnalysisStatus;
