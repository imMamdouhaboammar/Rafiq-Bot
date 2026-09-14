import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  CloudLightning,
  Info,
  Smartphone,
} from 'lucide-react';
import { eventBus } from '../services/eventBus.js';
import BotStoryPanel from './BotStoryPanel.js';
import CapabilityHealthDashboard from './CapabilityHealthDashboard.js';
import MemoryInspector from './MemoryInspector.js';
import SocialAgencyControlsPanel from './SocialAgencyControlsPanel.js';
import TransferV2Panel from './TransferV2Panel.js';

interface DeferredInstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PwaToolsTab: React.FC = () => {
  const [isInstalled, setIsInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredInstallPrompt | null>(null);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as DeferredInstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      eventBus.emit('ui:toast', {
        message: 'التثبيت المباشر غير مدعوم على هذا المتصفح. استخدم تعليمات جهازك بالأسفل',
        type: 'info',
      });
      return;
    }

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      eventBus.emit('ui:toast', { message: 'تم تثبيت رفيق على الجهاز', type: 'success' });
    }
  };

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-[#f0f2f5]">
      <header className="flex h-[calc(60px+env(safe-area-inset-top))] shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 pt-[env(safe-area-inset-top)]">
        <h1 className="font-sans text-xl font-semibold text-[#111b21]">التطبيق والأدوات</h1>
        <Smartphone size={22} className="text-wa-teal" aria-hidden="true" />
      </header>

      <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto p-4">
        <section className="flex flex-col items-center rounded-xl border border-gray-100 bg-white p-5 text-center shadow-sm" aria-labelledby="install-title">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-wa-teal">
            <Smartphone size={32} aria-hidden="true" />
          </div>
          <h2 id="install-title" className="text-lg font-bold text-gray-800">رفيق على الشاشة الرئيسية</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">
            التثبيت يفتح التطبيق بدون شريط المتصفح. العمل دون اتصال يعتمد على الموارد التي سبق تحميلها
          </p>

          {isInstalled ? (
            <div className="mt-5 flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>التطبيق يعمل في وضع التثبيت</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void handleInstallClick()}
              disabled={!deferredPrompt}
              className={`mt-5 inline-flex min-h-11 items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold shadow-md transition-colors ${deferredPrompt ? 'bg-[#008069] text-white hover:bg-[#006855]' : 'cursor-not-allowed bg-gray-200 text-gray-400'}`}
            >
              <CloudLightning size={16} aria-hidden="true" />
              <span>ثبّت التطبيق</span>
            </button>
          )}
        </section>

        <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm" aria-labelledby="install-guide-title">
          <h2 id="install-guide-title" className="flex items-center gap-2 border-b border-gray-100 pb-3 font-bold text-gray-800">
            <Info size={18} className="text-wa-teal" aria-hidden="true" />
            تعليمات التثبيت اليدوي
          </h2>
          <div className="mt-4 space-y-4 text-sm leading-6 text-gray-600">
            <div className="rounded border-r-4 border-[#008069] bg-teal-50/30 py-2 pr-3">
              <strong className="block text-gray-800">iPhone وiPad عبر Safari</strong>
              افتح قائمة المشاركة، اختر إضافة إلى الشاشة الرئيسية، ثم أكد الإضافة
            </div>
            <div className="rounded border-r-4 border-sky-500 bg-sky-50/30 py-2 pr-3">
              <strong className="block text-gray-800">Android عبر Chrome</strong>
              افتح قائمة المتصفح، اختر تثبيت التطبيق أو الإضافة إلى الشاشة الرئيسية، ثم أكد
            </div>
          </div>
        </section>

        <CapabilityHealthDashboard />
        <MemoryInspector />
        <BotStoryPanel />
        <SocialAgencyControlsPanel />
        <TransferV2Panel />
      </div>
    </div>
  );
};

export default PwaToolsTab;
