import React from 'react';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Copy } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  showStack: boolean;
  copied: boolean;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /**
   * عنوان يظهر في واجهة الـ error — اختياري، بيوضح أي جزء من التطبيق انكسر
   */
  label?: string;
  /**
   * Fallback UI مخصص بدل الواجهة الافتراضية
   */
  fallback?: (props: { error: Error; reset: () => void }) => React.ReactNode;
  /**
   * Callback يتنادى لما يحصل error — مفيد للـ logging
   */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDiagnosticReport(error: Error, errorInfo: React.ErrorInfo | null): string {
  const lines: string[] = [
    `=== Rafiq Error Report ===`,
    `Time: ${new Date().toISOString()}`,
    `URL: ${typeof window !== 'undefined' ? window.location.href : 'unknown'}`,
    ``,
    `=== Error ===`,
    `Name: ${error.name}`,
    `Message: ${error.message}`,
    ``,
    `=== Stack Trace ===`,
    error.stack || '(no stack)',
    ``,
  ];

  if (errorInfo?.componentStack) {
    lines.push(`=== React Component Stack ===`);
    lines.push(errorInfo.componentStack.trim());
  }

  return lines.join('\n');
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ErrorBoundary — يمسك أي crash في React render tree ويعرض diagnostic UI واضحة
 * بدل ما الشاشة تبقى بيضاء من غير سبب.
 *
 * Usage:
 *   <ErrorBoundary label="Storyteller">
 *     <StorytellerView ... />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showStack: false,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(
      `[ErrorBoundary${this.props.label ? `:${this.props.label}` : ''}] Caught error:`,
      error,
      errorInfo,
    );

    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  private reset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showStack: false,
      copied: false,
    });
  };

  private toggleStack = (): void => {
    this.setState(prev => ({ showStack: !prev.showStack }));
  };

  private copyReport = async (): Promise<void> => {
    const { error, errorInfo } = this.state;
    if (!error) return;
    try {
      await navigator.clipboard.writeText(buildDiagnosticReport(error, errorInfo));
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      // clipboard unavailable — silently ignore
    }
  };

  override render(): React.ReactNode {
    const { hasError, error, errorInfo, showStack, copied } = this.state;
    const { children, fallback, label } = this.props;

    if (!hasError || !error) return children;

    // Custom fallback provided by caller
    if (fallback) {
      return fallback({ error, reset: this.reset });
    }

    // ── Default diagnostic UI ─────────────────────────────────────────────────
    const componentLines = errorInfo?.componentStack
      ?.split('\n')
      .map(l => l.trim())
      .filter(Boolean) ?? [];

    // First component in the stack = closest crashed component
    const crashedComponent = componentLines[0]?.replace(/^at\s+/, '') ?? 'Unknown';

    return (
      <div
        className="flex min-h-full w-full flex-col items-center justify-center bg-[#faf8f5] dark:bg-[#0c1317] p-6"
        dir="rtl"
      >
        <div className="w-full max-w-lg rounded-2xl border border-red-200 dark:border-red-900/40 bg-white dark:bg-[#1f2c34] shadow-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900/40 px-5 py-4">
            <AlertTriangle className="shrink-0 text-red-500" size={22} />
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-red-700 dark:text-red-400">
                {label ? `خطأ في ${label}` : 'حدث خطأ غير متوقع'}
              </h2>
              <p className="mt-0.5 text-xs text-red-600/70 dark:text-red-400/70">
                المكوّن المسبب:{' '}
                <code className="rounded bg-red-100 dark:bg-red-900/40 px-1 py-px font-mono text-[11px]">
                  {crashedComponent}
                </code>
              </p>
            </div>
          </div>

          {/* Error message */}
          <div className="px-5 py-4 space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#54656f] dark:text-[#8696a0] mb-1">
                رسالة الخطأ
              </p>
              <p className="rounded-lg bg-red-50 dark:bg-red-950/20 px-3 py-2 font-mono text-xs text-red-800 dark:text-red-300 break-all leading-5">
                <span className="font-bold">{error.name}:</span> {error.message}
              </p>
            </div>

            {/* Stack toggle */}
            {(error.stack || componentLines.length > 0) && (
              <div>
                <button
                  type="button"
                  onClick={this.toggleStack}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-[#008069] dark:text-[#25d366] hover:underline"
                >
                  {showStack ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  {showStack ? 'إخفاء التفاصيل التقنية' : 'عرض التفاصيل التقنية (Stack Trace)'}
                </button>

                {showStack && (
                  <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-[#1e1e1e] p-3 text-[10px] leading-[1.6] text-green-300 font-mono whitespace-pre-wrap break-all">
                    {error.stack}
                    {componentLines.length > 0 && (
                      <>
                        {'\n\n--- React Component Stack ---\n'}
                        {componentLines.join('\n')}
                      </>
                    )}
                  </pre>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 border-t border-black/5 dark:border-white/5 px-5 py-3">
            <button
              type="button"
              onClick={this.reset}
              className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-[#008069] text-xs font-bold text-white hover:bg-[#006c58] active:scale-95 transition-all"
            >
              <RefreshCw size={14} />
              حاول مرة ثانية
            </button>

            <button
              type="button"
              onClick={() => void this.copyReport()}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 text-xs font-bold text-[#54656f] dark:text-[#8696a0] hover:bg-black/10 transition-all"
              title="انسخ تقرير الخطأ"
            >
              <Copy size={13} />
              {copied ? 'تم النسخ!' : 'نسخ التقرير'}
            </button>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-[#8696a0]">
          لو المشكلة فضلت، افتح الـ Console في DevTools (F12) للمزيد من التفاصيل
        </p>
      </div>
    );
  }
}

// ─── Storyteller-specific boundary ───────────────────────────────────────────

/**
 * Boundary مخصص للـ Storyteller — بيعرض رسالة ودية بالعربي مع خيار
 * العودة للشات مباشرة.
 */
interface StorytellerErrorBoundaryProps {
  children: React.ReactNode;
  onClose: () => void;
}

export function StorytellerErrorBoundary({ children, onClose }: StorytellerErrorBoundaryProps) {
  return (
    <ErrorBoundary
      label="الراوي (Storyteller)"
      fallback={({ error, reset }) => (
        <div
          className="flex h-full w-full flex-col items-center justify-center bg-[#faf8f5] dark:bg-[#0c1317] p-6 gap-4"
          dir="rtl"
        >
          <div className="w-full max-w-md rounded-2xl border border-red-200 dark:border-red-900/40 bg-white dark:bg-[#1f2c34] shadow-lg overflow-hidden">
            <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900/40 px-5 py-4">
              <span className="text-2xl">☕</span>
              <div>
                <h2 className="text-sm font-bold text-red-700 dark:text-red-400">
                  الراوي واقف مؤقتاً
                </h2>
                <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-0.5">
                  حصل خطأ تقني خلّى الحكاية توقف
                </p>
              </div>
            </div>

            <div className="px-5 py-4">
              <p className="text-xs text-[#54656f] dark:text-[#8696a0] mb-3">
                السبب:
              </p>
              <p className="rounded-lg bg-red-50 dark:bg-red-950/20 px-3 py-2 font-mono text-xs text-red-800 dark:text-red-300 break-all leading-5">
                <span className="font-bold">{error.name}:</span> {error.message}
              </p>
            </div>

            <div className="flex items-center gap-2 border-t border-black/5 dark:border-white/5 px-5 py-3">
              <button
                type="button"
                onClick={reset}
                className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-[#008069] text-xs font-bold text-white hover:bg-[#006c58] active:scale-95 transition-all"
              >
                <RefreshCw size={14} />
                جرب تاني
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-xs font-bold text-[#54656f] hover:bg-black/10 transition-all"
              >
                ارجع للشات
              </button>
            </div>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
