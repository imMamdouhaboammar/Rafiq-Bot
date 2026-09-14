import React, { useRef, useState } from 'react';
import {
  Download,
  FileCheck2,
  FileLock2,
  Loader2,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Upload,
  XCircle,
} from 'lucide-react';
import { eventBus } from '../services/eventBus.js';
import {
  detectTransferFileKind,
  exportEncryptedFullTextBackup,
  importRuntimeTransfer,
  serializeStandardTransferV2,
  type TransferFileKind,
} from '../services/transferRuntime.js';
import type { TransferImportProgress } from '../services/transactionalTransferImport.js';

interface PendingImport {
  fileName: string;
  text: string;
  kind: Exclude<TransferFileKind, 'unknown'>;
}

const APP_VERSION = '0.0.0';
const MIN_PASSPHRASE_LENGTH = 12;

const downloadTextFile = (text: string, fileName: string): void => {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const today = (): string => new Date().toISOString().slice(0, 10);

const kindLabel: Record<Exclude<TransferFileKind, 'unknown'>, string> = {
  v2: 'Transfer v2',
  encrypted: 'نسخة مشفرة',
  'legacy-v1': 'ملف v1 قديم قابل للترقية',
};

const TransferV2Panel: React.FC = () => {
  const [passphrase, setPassphrase] = useState('');
  const [pendingImport, setPendingImport] = useState<PendingImport>();
  const [exporting, setExporting] = useState<'standard' | 'encrypted'>();
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<TransferImportProgress>();
  const [warnings, setWarnings] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController>();

  const normalizedPassphrase = passphrase.normalize('NFKC');
  const passphraseReady = normalizedPassphrase.length >= MIN_PASSPHRASE_LENGTH;
  const encryptedImport = pendingImport?.kind === 'encrypted';

  const exportStandard = async () => {
    setExporting('standard');
    try {
      const text = await serializeStandardTransferV2({ appVersion: APP_VERSION });
      downloadTextFile(text, `rafiq-transfer-v2-${today()}.rafiq.json`);
      eventBus.emit('ui:toast', {
        message: 'تم تصدير Transfer v2 بدون الذكريات الحساسة أو أحداث Human ID الخاصة',
        type: 'success',
      });
    } catch (error) {
      eventBus.emit('ui:toast', {
        message: error instanceof Error ? error.message : 'فشل تصدير Transfer v2',
        type: 'error',
      });
    } finally {
      setExporting(undefined);
    }
  };

  const exportEncrypted = async () => {
    if (!passphraseReady) {
      eventBus.emit('ui:toast', {
        message: `كلمة مرور النسخة المشفرة يجب أن تكون ${MIN_PASSPHRASE_LENGTH} حرفًا على الأقل`,
        type: 'warning',
      });
      return;
    }

    setExporting('encrypted');
    try {
      const text = await exportEncryptedFullTextBackup(normalizedPassphrase, {
        appVersion: APP_VERSION,
      });
      downloadTextFile(text, `rafiq-full-encrypted-${today()}.rafiq.enc.json`);
      eventBus.emit('ui:toast', {
        message: 'تم تصدير النسخة النصية الكاملة بتشفير AES-GCM',
        type: 'success',
      });
    } catch (error) {
      eventBus.emit('ui:toast', {
        message: error instanceof Error ? error.message : 'فشل إنشاء النسخة المشفرة',
        type: 'error',
      });
    } finally {
      setExporting(undefined);
    }
  };

  const selectImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('الملف ليس JSON صالحًا');
      }
      const kind = detectTransferFileKind(parsed);
      if (kind === 'unknown') throw new Error('صيغة الملف غير مدعومة');
      setPendingImport({ fileName: file.name, text, kind });
      setProgress(undefined);
      setWarnings([]);
    } catch (error) {
      setPendingImport(undefined);
      eventBus.emit('ui:toast', {
        message: error instanceof Error ? error.message : 'تعذر قراءة ملف النقل',
        type: 'error',
      });
    }
  };

  const runImport = async () => {
    if (!pendingImport || importing) return;
    if (encryptedImport && !passphraseReady) {
      eventBus.emit('ui:toast', {
        message: `الملف المشفر يحتاج كلمة مرور من ${MIN_PASSPHRASE_LENGTH} حرفًا على الأقل`,
        type: 'warning',
      });
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setImporting(true);
    setProgress({ phase: 'validate', ratio: 0, message: 'بدء فحص الملف' });
    setWarnings([]);

    try {
      const result = await importRuntimeTransfer(pendingImport.text, {
        passphrase: encryptedImport ? normalizedPassphrase : undefined,
        appVersion: APP_VERSION,
        signal: controller.signal,
        onProgress: setProgress,
      });
      setWarnings(result.prepared.warnings);
      eventBus.emit('ui:toast', {
        message: result.prepared.warnings.length > 0
          ? `تم الاستيراد مع ${result.prepared.warnings.length} تنبيه`
          : 'تم الاستيراد بنجاح مع snapshot وrollback protection',
        type: 'success',
      });
      setPendingImport(undefined);
      window.setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      const aborted = controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError');
      eventBus.emit('ui:toast', {
        message: aborted
          ? 'تم إلغاء الاستيراد واستعادة البيانات السابقة'
          : error instanceof Error ? error.message : 'فشل الاستيراد',
        type: aborted ? 'info' : 'error',
      });
    } finally {
      abortControllerRef.current = undefined;
      setImporting(false);
    }
  };

  const confirmImport = () => {
    if (!pendingImport) return;
    eventBus.emit('ui:dialog', {
      title: 'استيراد البيانات إلى رفيق',
      message: 'سيتم فحص checksums، أخذ snapshot، إعادة تعيين IDs المتعارضة، ثم commit داخل transaction. عند أي فشل سيحاول رفيق rollback تلقائيًا. هل تريد المتابعة؟',
      tone: 'warning',
      confirmLabel: 'ابدأ الاستيراد',
      cancelLabel: 'إلغاء',
      showCancel: true,
      dismissible: true,
      onConfirm: () => { void runImport(); },
    });
  };

  return (
    <section className="space-y-5 rounded-xl border border-gray-100 bg-white p-5 shadow-sm" aria-labelledby="transfer-v2-title">
      <div>
        <h2 id="transfer-v2-title" className="flex items-center gap-2 font-bold text-gray-900">
          <ShieldCheck size={19} className="text-wa-teal" aria-hidden="true" />
          نقل واستعادة البيانات v2
        </h2>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          الملفات الأصلية داخل OPFS لا تخرج من الجهاز. ملف النقل يحتوي النصوص والـ metadata فقط، وتظهر المرفقات بعد الاستيراد كـ missing أو local-only
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void exportStandard()}
          disabled={Boolean(exporting) || importing}
          className="flex min-h-28 flex-col items-center justify-center rounded-xl border border-teal-100 bg-teal-50 p-4 text-[#008069] transition-colors hover:bg-teal-100 disabled:opacity-60"
        >
          {exporting === 'standard' ? <Loader2 size={24} className="mb-2 animate-spin" aria-hidden="true" /> : <Download size={24} className="mb-2" aria-hidden="true" />}
          <span className="text-sm font-bold">تصدير Transfer v2</span>
          <span className="mt-1 text-[11px] text-teal-800/70">يستبعد الخاص والحساس</span>
        </button>

        <button
          type="button"
          onClick={() => void exportEncrypted()}
          disabled={Boolean(exporting) || importing || !passphraseReady}
          className="flex min-h-28 flex-col items-center justify-center rounded-xl border border-violet-100 bg-violet-50 p-4 text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-50"
        >
          {exporting === 'encrypted' ? <Loader2 size={24} className="mb-2 animate-spin" aria-hidden="true" /> : <FileLock2 size={24} className="mb-2" aria-hidden="true" />}
          <span className="text-sm font-bold">نسخة نصية كاملة مشفرة</span>
          <span className="mt-1 text-[11px] text-violet-800/70">تشمل الخاص والحساس</span>
        </button>
      </div>

      <label className="block space-y-2">
        <span className="flex items-center gap-2 text-xs font-bold text-gray-700">
          <LockKeyhole size={15} aria-hidden="true" />
          كلمة مرور التشفير أو فك التشفير
        </span>
        <input
          type="password"
          value={passphrase}
          onChange={event => setPassphrase(event.target.value)}
          autoComplete="new-password"
          placeholder="12 حرفًا على الأقل"
          className="min-h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#008069] focus:ring-2 focus:ring-[#008069]/15"
        />
        <p className={`text-[11px] ${passphrase.length > 0 && !passphraseReady ? 'text-amber-700' : 'text-gray-400'}`}>
          رفيق لا يحفظ كلمة المرور، ولا يمكن استعادة النسخة المشفرة بدونها
        </p>
      </label>

      <div className="border-t border-gray-100 pt-5">
        <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-blue-200 bg-blue-50/60 p-4 text-blue-700 transition-colors hover:bg-blue-50 focus-within:ring-2 focus-within:ring-blue-500">
          <Upload size={24} className="mb-2" aria-hidden="true" />
          <span className="text-sm font-bold">اختيار ملف للاستيراد</span>
          <span className="mt-1 text-[11px] text-blue-800/70">v2 أو encrypted أو legacy v1</span>
          <input
            type="file"
            accept="application/json,.json,.rafiq"
            className="sr-only"
            onChange={event => void selectImportFile(event)}
            disabled={importing}
          />
        </label>
      </div>

      {pendingImport ? (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-start gap-3">
            <FileCheck2 size={20} className="mt-0.5 shrink-0 text-[#008069]" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-gray-900">{pendingImport.fileName}</p>
              <p className="text-xs text-gray-500">{kindLabel[pendingImport.kind]}</p>
            </div>
            {!importing ? (
              <button type="button" onClick={() => setPendingImport(undefined)} className="grid min-h-11 min-w-11 place-items-center rounded-full text-gray-400 hover:bg-gray-200" aria-label="إزالة الملف">
                <XCircle size={19} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {progress ? (
            <div className="space-y-1.5" role="status" aria-live="polite">
              <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                <div className="h-full rounded-full bg-[#008069] transition-[width]" style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
              </div>
              <div className="flex justify-between gap-3 text-[11px] text-gray-500">
                <span>{progress.message}</span>
                <span>{Math.round(progress.ratio * 100)}%</span>
              </div>
            </div>
          ) : null}

          <div className="flex gap-2">
            {importing ? (
              <button
                type="button"
                onClick={() => abortControllerRef.current?.abort()}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-red-50 px-4 text-sm font-bold text-red-700 hover:bg-red-100"
              >
                <RotateCcw size={16} aria-hidden="true" />
                إلغاء واستعادة السابق
              </button>
            ) : (
              <button
                type="button"
                onClick={confirmImport}
                disabled={encryptedImport && !passphraseReady}
                className="min-h-11 flex-1 rounded-xl bg-[#008069] px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                مراجعة وبدء الاستيراد
              </button>
            )}
          </div>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          <strong className="block">تنبيهات الاستيراد</strong>
          {warnings.slice(0, 5).map(warning => <p key={warning}>{warning}</p>)}
        </div>
      ) : null}
    </section>
  );
};

export default TransferV2Panel;
