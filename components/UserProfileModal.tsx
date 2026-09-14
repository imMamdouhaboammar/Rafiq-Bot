import React, { useEffect, useState } from 'react';
import {
  Activity,
  Brain,
  CalendarDays,
  Camera,
  Copy,
  Heart,
  Palette,
  Sparkles,
  Terminal,
  Trash2,
  User,
  X,
} from 'lucide-react';
import type { UserProfile } from '../types.js';
import { fileToGenAIInlineData, generateUserAvatar } from '../services/geminiService.js';
import { eventBus } from '../services/eventBus.js';
import HumanIdTimeline from './HumanIdTimeline.js';

interface UserProfileModalProps {
  profile: UserProfile | null;
  onSave: (profile: UserProfile) => void;
  onClose?: () => void;
  inline?: boolean;
}

const INTERESTS_LIST = [
  'كورة ⚽', 'برمجة 💻', 'سفر ✈️', 'مزيكا 🎵', 'طبخ 🍳',
  'أفلام 🎬', 'قراءة 📚', 'جيمنج 🎮', 'بيزنس 💼', 'تاريخ 🏛️',
  'تصوير 📸', 'فلسفة 🧠', 'تكنولوجيا 📱', 'موضة 👗', 'حيوانات 🐱',
];

type Tab = 'basic' | 'timeline' | 'appearance' | 'personality' | 'interests' | 'logs';

const UserProfileModal: React.FC<UserProfileModalProps> = ({
  profile,
  onSave,
  onClose,
  inline = false,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('basic');
  const [name, setName] = useState(profile?.name || '');
  const [gender, setGender] = useState<'male' | 'female'>(profile?.gender || 'male');
  const [age, setAge] = useState(profile?.age?.toString() || '25');
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatarBase64, setAvatarBase64] = useState<string | undefined>(profile?.avatarBase64);
  const [visualDescription, setVisualDescription] = useState(profile?.visualDescription || '');
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [personalityType, setPersonalityType] = useState<'introvert' | 'extrovert' | 'balanced'>(profile?.personalityType || 'balanced');
  const [communicationStyle, setCommunicationStyle] = useState<'direct' | 'expressive' | 'humorous'>(profile?.communicationStyle || 'expressive');
  const [moodBaseline, setMoodBaseline] = useState<'calm' | 'energetic' | 'serious'>(profile?.moodBaseline || 'calm');
  const [interests, setInterests] = useState<string[]>(profile?.interests || []);
  const [showFloatingHelper, setShowFloatingHelper] = useState(() => (
    localStorage.getItem('rafiq:show-floating-helper') !== 'false'
  ));
  const [errorLogs, setErrorLogs] = useState(() => eventBus.getErrorLogs());

  useEffect(() => {
    const handleErrorsUpdated = () => setErrorLogs(eventBus.getErrorLogs());
    window.addEventListener('rafiq:errors-updated', handleErrorsUpdated);
    return () => window.removeEventListener('rafiq:errors-updated', handleErrorsUpdated);
  }, []);

  const handleSave = () => {
    onSave({
      name: name.trim(),
      gender,
      age: Number.parseInt(age, 10) || 25,
      bio: bio.trim(),
      avatarBase64,
      visualDescription: visualDescription.trim(),
      personalityType,
      communicationStyle,
      moodBaseline,
      interests,
    });
    eventBus.emit('ui:toast', { message: 'تم تحديث بياناتك بنجاح', type: 'success' });
  };

  const handleGenerateAvatar = async () => {
    const context = visualDescription.trim() || bio.trim();
    if (!context) {
      eventBus.emit('ui:toast', { message: 'اكتب وصف شكلك الأول', type: 'warning' });
      return;
    }

    setIsGeneratingAvatar(true);
    try {
      const imageData = await generateUserAvatar(context, gender, Number.parseInt(age, 10) || 25);
      setAvatarBase64(imageData);
      eventBus.emit('ui:toast', { message: 'تم توليد الصورة', type: 'success' });
    } catch {
      eventBus.emit('ui:toast', { message: 'فشل توليد الصورة', type: 'error' });
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const { mimeType, data } = await fileToGenAIInlineData(file);
    setAvatarBase64(`data:${mimeType};base64,${data}`);
    event.target.value = '';
  };

  const toggleInterest = (interest: string) => {
    setInterests(current => current.includes(interest)
      ? current.filter(item => item !== interest)
      : [...current, interest]);
  };

  const tabButton = (tab: Tab, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => setActiveTab(tab)}
      className={`inline-flex min-h-11 min-w-fit flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all sm:text-sm ${activeTab === tab ? 'bg-white text-[#008069] shadow' : 'text-gray-500 hover:bg-white/60'}`}
      aria-pressed={activeTab === tab}
    >
      {icon}
      {label}
    </button>
  );

  const content = (
    <>
      <header className={`flex shrink-0 items-center justify-between border-b bg-[#008069] text-white ${inline ? 'px-5 pb-4 pt-[calc(1.25rem+env(safe-area-inset-top))]' : 'p-5'}`}>
        <div>
          <h2 className="text-xl font-bold">هويتي (Human ID)</h2>
          <p className="text-xs text-white/80">بياناتك وخط حياتك في مكان واحد</p>
        </div>
        {!inline && onClose ? (
          <button type="button" onClick={onClose} className="grid min-h-11 min-w-11 place-items-center rounded-full hover:bg-white/10" aria-label="إغلاق الملف الشخصي">
            <X size={24} aria-hidden="true" />
          </button>
        ) : null}
      </header>

      <nav className="custom-scrollbar flex shrink-0 gap-1 overflow-x-auto bg-gray-100 p-1" aria-label="أقسام الهوية">
        {tabButton('basic', 'الأساسي', <User size={16} aria-hidden="true" />)}
        {tabButton('timeline', 'خط حياتي', <CalendarDays size={16} aria-hidden="true" />)}
        {tabButton('appearance', 'المظهر', <Palette size={16} aria-hidden="true" />)}
        {tabButton('personality', 'الشخصية', <Brain size={16} aria-hidden="true" />)}
        {tabButton('interests', 'الاهتمامات', <Heart size={16} aria-hidden="true" />)}
        {tabButton('logs', 'الأخطاء', <Terminal size={16} aria-hidden="true" />)}
      </nav>

      <div className="flex-1 overflow-y-auto bg-[#f7f9fc] p-4 sm:p-6" dir="rtl">
        {activeTab === 'basic' ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="grid gap-4 sm:grid-cols-[150px_1fr_110px]">
              <fieldset>
                <legend className="mb-1 block text-xs font-bold text-gray-500">النوع</legend>
                <div className="flex rounded-xl bg-gray-200 p-1">
                  <button type="button" onClick={() => setGender('male')} className={`min-h-11 flex-1 rounded-lg text-sm font-bold ${gender === 'male' ? 'bg-blue-500 text-white shadow' : 'text-gray-600'}`}>ذكر</button>
                  <button type="button" onClick={() => setGender('female')} className={`min-h-11 flex-1 rounded-lg text-sm font-bold ${gender === 'female' ? 'bg-pink-500 text-white shadow' : 'text-gray-600'}`}>أنثى</button>
                </div>
              </fieldset>
              <label className="text-xs font-bold text-gray-500">
                الاسم
                <input type="text" value={name} onChange={event => setName(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border p-2.5 text-sm font-normal text-gray-900 outline-none focus:border-[#008069]" placeholder="اسمك الحقيقي" />
              </label>
              <label className="text-xs font-bold text-gray-500">
                السن
                <input type="number" min="1" max="120" value={age} onChange={event => setAge(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border p-2.5 text-sm font-normal text-gray-900 outline-none focus:border-[#008069]" />
              </label>
            </div>
            <label className="block text-xs font-bold text-gray-500">
              نبذة سريعة
              <textarea value={bio} onChange={event => setBio(event.target.value)} className="mt-1 h-32 w-full resize-y rounded-xl border p-3 text-sm font-normal leading-6 text-gray-900 outline-none focus:border-[#008069]" placeholder="أنا مين؟ بشتغل إيه؟ وحياتي عاملة إزاي؟" />
              <span className="mt-1 block text-[10px] font-normal text-gray-400">اكتب المعلومات الثابتة هنا، وسجل الأحداث في خط حياتي</span>
            </label>
          </div>
        ) : null}

        {activeTab === 'timeline' ? (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <HumanIdTimeline />
          </div>
        ) : null}

        {activeTab === 'appearance' ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex flex-col items-center gap-4">
              <div className="group relative">
                <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-gray-200 text-6xl shadow-lg">
                  {avatarBase64 ? <img src={avatarBase64} className="h-full w-full object-cover" alt="صورتك الشخصية" /> : <span>{gender === 'male' ? '🧔🏻‍♂️' : '👩🏻‍🦱'}</span>}
                </div>
                <label className="absolute bottom-1 right-1 grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-full bg-[#008069] text-white shadow-lg hover:bg-[#006855]">
                  <Camera size={20} aria-hidden="true" />
                  <span className="sr-only">رفع صورة شخصية</span>
                  <input type="file" className="sr-only" accept="image/*" onChange={event => void handleFileUpload(event)} />
                </label>
              </div>

              <div className="w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <label className="mb-2 flex items-center gap-1 text-xs font-bold text-gray-500">
                  <Sparkles size={14} className="text-amber-500" aria-hidden="true" />
                  أوصف شكلك للذكاء الاصطناعي
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input type="text" value={visualDescription} onChange={event => setVisualDescription(event.target.value)} placeholder="مثلاً: شعر أسود قصير، نظارة، ودقن خفيفة" className="min-h-11 flex-1 rounded-xl border bg-gray-50 p-2.5 text-sm outline-none focus:border-[#008069]" />
                  <button type="button" onClick={() => void handleGenerateAvatar()} disabled={isGeneratingAvatar} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                    {isGeneratingAvatar ? <Activity className="animate-spin" size={16} aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
                    توليد
                  </button>
                </div>
              </div>

              <label className="flex w-full items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <span className="flex flex-col text-right">
                  <span className="text-sm font-bold text-gray-700">المساعد العائم</span>
                  <span className="text-xs text-gray-500">إظهار الردود الجاهزة والمحفزات داخل المحادثة</span>
                </span>
                <input
                  type="checkbox"
                  checked={showFloatingHelper}
                  onChange={event => {
                    const nextValue = event.target.checked;
                    setShowFloatingHelper(nextValue);
                    localStorage.setItem('rafiq:show-floating-helper', nextValue ? 'true' : 'false');
                    window.dispatchEvent(new Event('rafiq:floating-helper-changed'));
                  }}
                  className="h-5 w-5 cursor-pointer accent-emerald-600"
                />
              </label>
            </div>
          </div>
        ) : null}

        {activeTab === 'personality' ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="font-bold text-gray-700">معايرة أسلوب التواصل</h3>
              <fieldset>
                <legend className="mb-2 text-xs font-bold text-gray-500">بتحب الهدوء ولا اللمة؟</legend>
                <div className="grid grid-cols-3 gap-2">
                  {(['introvert', 'balanced', 'extrovert'] as const).map(value => (
                    <button key={value} type="button" onClick={() => setPersonalityType(value)} className={`min-h-11 rounded-lg border text-sm ${personalityType === value ? 'border-blue-500 bg-blue-100 font-bold text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                      {value === 'introvert' ? 'انطوائي' : value === 'balanced' ? 'متوازن' : 'اجتماعي'}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-xs font-bold text-gray-500">أسلوبك في الكلام</legend>
                <div className="grid grid-cols-3 gap-2">
                  {(['direct', 'expressive', 'humorous'] as const).map(value => (
                    <button key={value} type="button" onClick={() => setCommunicationStyle(value)} className={`min-h-11 rounded-lg border text-sm ${communicationStyle === value ? 'border-purple-500 bg-purple-100 font-bold text-purple-700' : 'border-gray-200 text-gray-600'}`}>
                      {value === 'direct' ? 'مباشر' : value === 'expressive' ? 'عاطفي' : 'هزار'}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-xs font-bold text-gray-500">مودك العام</legend>
                <div className="grid grid-cols-3 gap-2">
                  {(['calm', 'energetic', 'serious'] as const).map(value => (
                    <button key={value} type="button" onClick={() => setMoodBaseline(value)} className={`min-h-11 rounded-lg border text-sm ${moodBaseline === value ? 'border-green-500 bg-green-100 font-bold text-green-700' : 'border-gray-200 text-gray-600'}`}>
                      {value === 'calm' ? 'هادي' : value === 'energetic' ? 'نشيط' : 'جاد'}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          </div>
        ) : null}

        {activeTab === 'interests' ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="font-bold text-gray-700">إيه اللي بتحبه؟</h3>
              <p className="mb-4 mt-1 text-xs text-gray-500">اختار الحاجات اللي تهمك عشان البوتات تفتح معاك مواضيع مناسبة</p>
              <div className="flex flex-wrap gap-2">
                {INTERESTS_LIST.map(interest => (
                  <button key={interest} type="button" onClick={() => toggleInterest(interest)} className={`min-h-11 rounded-full px-4 py-2 text-sm ${interests.includes(interest) ? 'bg-[#008069] text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {interest}
                  </button>
                ))}
              </div>
              <div className="mt-4 border-t border-gray-100 pt-4">
                <label className="mb-2 block text-xs font-bold text-gray-500">حاجة تانية؟ اكتب واضغط Enter</label>
                <input
                  type="text"
                  placeholder="اكتب هواية وضيفها"
                  className="min-h-11 w-full rounded-xl border bg-gray-50 p-3 outline-none focus:border-[#008069]"
                  onKeyDown={event => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    const value = event.currentTarget.value.trim();
                    if (value && !interests.includes(value)) {
                      setInterests(current => [...current, value]);
                      event.currentTarget.value = '';
                    }
                  }}
                />
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'logs' ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex flex-col justify-between gap-3 border-b border-gray-100 pb-3 sm:flex-row sm:items-center">
                <div className="flex flex-col text-right">
                  <h3 className="font-bold text-gray-700">سجل الأخطاء الفنية</h3>
                  <p className="text-xs text-gray-500">المشاكل البرمجية والشبكية التي سجلها التطبيق على هذا الجهاز</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={errorLogs.length === 0}
                    onClick={() => {
                      const fullText = errorLogs.map(log => (
                        `[${log.timestamp}] Origin: ${log.origin}\nCode: ${log.code}\nMessage: ${log.message}\n${log.stack ? `Stack: ${log.stack}\n` : ''}`
                      )).join('\n---\n\n');
                      void navigator.clipboard.writeText(fullText).then(() => {
                        eventBus.emit('ui:toast', { message: 'تم نسخ السجل بالكامل', type: 'success' });
                      });
                    }}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-gray-100 px-3 text-xs font-bold text-gray-600 hover:bg-gray-200 disabled:opacity-40"
                  >
                    <Copy size={13} aria-hidden="true" />
                    نسخ بالكامل
                  </button>
                  <button
                    type="button"
                    disabled={errorLogs.length === 0}
                    onClick={() => {
                      eventBus.clearErrorLogs();
                      eventBus.emit('ui:toast', { message: 'تم مسح سجل الأخطاء', type: 'success' });
                    }}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-red-50 px-3 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-40"
                  >
                    <Trash2 size={13} aria-hidden="true" />
                    مسح السجل
                  </button>
                </div>
              </div>

              <div className="max-h-[380px] space-y-2 overflow-y-auto">
                {errorLogs.length === 0 ? (
                  <p className="py-10 text-center text-xs text-gray-500">لا توجد أخطاء مسجلة حاليًا</p>
                ) : errorLogs.map(log => (
                  <article key={log.id} className="space-y-1.5 rounded-xl border border-red-100 bg-red-50/30 p-3 text-right">
                    <div className="flex items-center justify-between gap-2">
                      <time className="text-[10px] text-gray-400">{new Date(log.timestamp).toLocaleString('ar-EG')}</time>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">{log.origin}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const singleText = `[${log.timestamp}] Origin: ${log.origin}\nCode: ${log.code}\nMessage: ${log.message}\n${log.stack ? `Stack: ${log.stack}` : ''}`;
                            void navigator.clipboard.writeText(singleText).then(() => {
                              eventBus.emit('ui:toast', { message: 'تم نسخ تفاصيل الخطأ', type: 'success' });
                            });
                          }}
                          className="grid min-h-9 min-w-9 place-items-center rounded bg-white text-gray-500 hover:bg-gray-100"
                          aria-label="نسخ تفاصيل الخطأ"
                        >
                          <Copy size={12} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs font-bold text-red-900">{log.message}</p>
                    {log.stack ? (
                      <details>
                        <summary className="cursor-pointer text-[10px] text-gray-400">عرض Stack trace</summary>
                        <pre className="mt-1 max-h-24 overflow-x-auto whitespace-pre rounded border border-gray-200 bg-gray-50 p-2 text-left font-mono text-[10px]">{log.stack}</pre>
                      </details>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {activeTab !== 'timeline' ? (
        <footer className="shrink-0 border-t bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button type="button" onClick={handleSave} disabled={!name.trim()} className="min-h-12 w-full rounded-xl bg-[#008069] py-3 text-lg font-bold text-white shadow-lg hover:bg-[#006855] disabled:cursor-not-allowed disabled:opacity-50">
            حفظ الهوية
          </button>
        </footer>
      ) : null}
    </>
  );

  if (inline) {
    return <div className="flex h-full w-full flex-col overflow-hidden bg-white">{content}</div>;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 font-sans backdrop-blur-md">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in duration-200">
        {content}
      </div>
    </div>
  );
};

export default UserProfileModal;
