import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bell,
  BookOpen,
  BookText,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  Copy,
  Download,
  FileText,
  Film,
  Flame,
  Image as ImageIcon,
  Lightbulb,
  Maximize2,
  Mic,
  Minimize2,
  Minus,
  Paperclip,
  Play,
  Plus,
  RefreshCw,
  Send,
  Share2,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  User,
  Video,
  Wand2,
  X,
} from 'lucide-react';
import type {
  BotPersonaContext,
  StoryMediaSeed,
  StoryPacing,
  StoryStyleId,
  StorytellerChapter,
  StorytellerStory,
} from '../contracts/storyteller.js';
import { STORY_STYLES } from '../contracts/storyteller.js';
import {
  deleteStory,
  downloadStoryFile,
  exportStoryAsMarkdown,
  exportStoryAsText,
  listStories,
  saveStory,
} from '../services/storytellerRepository.js';
import {
  generateNextStoryChapter,
  regenerateCurrentChapter,
  startNewStory,
} from '../services/storytellerService.js';
import { storytellerBackground } from '../services/storytellerBackgroundWorker.js';
import { eventBus } from '../services/eventBus.js';
import { triggerHaptic } from '../utils/haptics.js';
import type { ChatSession, UserProfile } from '../types.js';
import Avatar from './Avatar.js';

interface StorytellerViewProps {
  chat: ChatSession;
  userProfile?: UserProfile | null;
  onClose: () => void;
  onSendToChat?: (text: string) => Promise<void> | void;
}



export const StorytellerView: React.FC<StorytellerViewProps> = ({
  chat,
  userProfile,
  onClose,
  onSendToChat,
}) => {
  const botSettings = chat.settings;
  const botName = botSettings.botName || 'رفيق';

  // Construct active bot persona context from chat settings
  const botPersona: BotPersonaContext = useMemo(() => ({
    botName,
    botBio: botSettings.botBio,
    botGender: botSettings.botGender,
    soulTraits: botSettings.soulTraits,
    dialect: botSettings.dialect || 'العامية المصرية الأصيلة',
    speechStyle: undefined,
    relationshipWithUser: botSettings.relationshipWithUser,
  }), [botSettings, botName]);

  // View Mode: 'create' | 'reading'
  const [viewMode, setViewMode] = useState<'create' | 'reading'>('create');
  const [showLibraryDrawer, setShowLibraryDrawer] = useState(false);
  const [savedStories, setSavedStories] = useState<StorytellerStory[]>([]);

  // Creation State
  const [premise, setPremise] = useState('');
  const [targetChapters, setTargetChapters] = useState(5);

  // Media Attachment State (Image / Video)
  const [mediaFile, setMediaFile] = useState<StoryMediaSeed | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  // Active Story & Studio State
  const [currentStory, setCurrentStory] = useState<StorytellerStory | null>(null);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [userDirective, setUserDirective] = useState('');
  const [showDirectiveInput, setShowDirectiveInput] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);

  // Background Auto-Generation States & Refs
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [isAutoPaused, setIsAutoPaused] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const autoGenLockRef = useRef(false);
  const isAutoPausedRef = useRef(false);
  const currentStoryRef = useRef<StorytellerStory | null>(null);

  useEffect(() => {
    currentStoryRef.current = currentStory;
  }, [currentStory]);

  // Background working notification state
  const [notificationsAllowed, setNotificationsAllowed] = useState<boolean>(() => {
    return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
  });

  // Typography state
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('base');

  // Async / Generation states
  const [isStartingStory, setIsStartingStory] = useState(false);
  const [isGeneratingNext, setIsGeneratingNext] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [sentToChatMessage, setSentToChatMessage] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const readingContainerRef = useRef<HTMLDivElement>(null);

  // Request browser notifications for background alerts
  const handleEnableNotifications = async () => {
    const granted = await storytellerBackground.requestNotificationPermission();
    setNotificationsAllowed(granted);
    if (granted) {
      eventBus.emit('ui:toast', {
        message: '🔔 تم تفعيل إشعارات الخلفية! رفيق هينبهك فور اكتمال أي جزء.',
        type: 'success',
      });
    }
  };

  // Load library stories on mount
  const refreshLibrary = useCallback(async () => {
    try {
      const list = await listStories();
      setSavedStories(list);

      // Auto-load most recent story for this chat if available
      const chatStory = list.find(s => s.chatId === chat.id);
      if (chatStory && !currentStory) {
        setCurrentStory(chatStory);
        setActiveChapterIndex(Math.max(0, chatStory.chapters.length - 1));
        setViewMode('reading');
      }
    } catch (err) {
      console.error('[StorytellerView] Failed to load library:', err);
    }
  }, [chat.id, currentStory]);

  useEffect(() => {
    void refreshLibrary();
  }, [refreshLibrary]);

  // Clean up background keep-alive on unmount
  useEffect(() => {
    return () => {
      storytellerBackground.stopKeepAlive();
    };
  }, []);

  // Handle Media File Selection (Image or Video)
  const handleMediaSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isImage && !isVideo) {
      eventBus.emit('ui:toast', {
        message: 'يرجى اختيار ملف صورة أو فيديو مدعوم.',
        type: 'warning',
      });
      return;
    }

    // Size limit guard: 40MB
    if (file.size > 40 * 1024 * 1024) {
      eventBus.emit('ui:toast', {
        message: 'حجم الملف كبير جداً (الحد الأقصى 40 ميجابايت).',
        type: 'warning',
      });
      return;
    }

    setIsUploadingMedia(true);
    triggerHaptic('light');

    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result as string;
          const dataOnly = res.split(',')[1] || '';
          resolve(dataOnly);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const previewUrl = URL.createObjectURL(file);

      setMediaFile({
        type: isVideo ? 'video' : 'image',
        mimeType: file.type,
        data: base64Data,
        previewUrl,
        name: file.name,
        size: file.size,
      });

      eventBus.emit('ui:toast', {
        message: `تم إرفاق ${isVideo ? 'الفيديو' : 'الصورة'}! رفيق هيحكيلك اللي حصل بناءً عليها.`,
        type: 'success',
      });
    } catch (err) {
      console.error('[StorytellerView] Media upload error:', err);
      eventBus.emit('ui:toast', {
        message: 'فشل تحميل الملف، يرجى المحاولة مرة أخرى.',
        type: 'error',
      });
    } finally {
      setIsUploadingMedia(false);
      if (mediaInputRef.current) mediaInputRef.current.value = '';
    }
  };

  const handleRemoveMedia = () => {
    if (mediaFile?.previewUrl) {
      URL.revokeObjectURL(mediaFile.previewUrl);
    }
    setMediaFile(null);
    triggerHaptic('light');
  };

  // Continuous Auto-Background Generation Loop
  const startAutoBackgroundGeneration = useCallback(async (initialStory?: StorytellerStory) => {
    if (autoGenLockRef.current) return;
    let target = initialStory || currentStoryRef.current;
    if (!target || target.chapters.length >= target.targetChapters) return;

    autoGenLockRef.current = true;
    isAutoPausedRef.current = false;
    setIsAutoPaused(false);
    setIsAutoGenerating(true);
    storytellerBackground.startKeepAlive();

    try {
      while (target && target.chapters.length < target.targetChapters) {
        if (isAutoPausedRef.current) {
          break;
        }

        const updatedStory = await generateNextStoryChapter(
          target,
          undefined,
          botName,
        );

        target = updatedStory;
        currentStoryRef.current = updatedStory;
        setCurrentStory(updatedStory);
        await refreshLibrary();
        triggerHaptic('success');

        // Alert user with chime and notification even if tab is in background
        storytellerBackground.notifyPartReady(
          botName,
          updatedStory.chapters.length,
          updatedStory.chapters[updatedStory.chapters.length - 1].title,
        );

        eventBus.emit('ui:toast', {
          message: `✨ ${botName} أضاف الجزء ${updatedStory.chapters.length} في الخلفية!`,
          type: 'success',
        });

        // Small breathing delay between chapters
        await new Promise(r => setTimeout(r, 600));
      }
    } catch (err: any) {
      console.error('[StorytellerView] Auto background generation error:', err);
      eventBus.emit('ui:toast', {
        message: 'توقف الحكي في الخلفية مؤقتاً، يمكنك استئنافه بضغطة زر.',
        type: 'warning',
      });
    } finally {
      autoGenLockRef.current = false;
      setIsAutoGenerating(false);
      storytellerBackground.stopKeepAlive();
    }
  }, [botName, refreshLibrary]);

  const pauseAutoGeneration = useCallback(() => {
    isAutoPausedRef.current = true;
    setIsAutoPaused(true);
    storytellerBackground.stopKeepAlive();
    triggerHaptic('light');
  }, []);

  const resumeAutoGeneration = useCallback(() => {
    isAutoPausedRef.current = false;
    setIsAutoPaused(false);
    triggerHaptic('light');
    void startAutoBackgroundGeneration();
  }, [startAutoBackgroundGeneration]);

  // Start story generation
  const handleStartStory = async () => {
    if (!premise.trim() && !mediaFile) {
      setErrorText('اكتب لـ رفيق موضوع الحكاية أو ارفع صورة/فيديو عشان يبدأ يحكي!');
      return;
    }

    setErrorText(null);
    setIsStartingStory(true);
    triggerHaptic('medium');

    // Start background keep-alive audio so tab doesn't freeze if user leaves
    storytellerBackground.startKeepAlive();

    try {
      const story = await startNewStory({
        premise: premise.trim(),
        styleId: 'rafiq_folklore',
        targetChapters,
        pacing: 'balanced',
        chatId: chat.id,
        botName,
        persona: botPersona,
        mediaSeed: mediaFile || undefined,
      });

      setCurrentStory(story);
      currentStoryRef.current = story;
      setActiveChapterIndex(0); // Immediately show part 1!
      setViewMode('reading');
      await refreshLibrary();
      triggerHaptic('success');

      // Notify user (plays audio chime + notification if tab is in background)
      storytellerBackground.notifyPartReady(botName, 1, story.chapters[0]?.title || 'البداية');

      eventBus.emit('ui:toast', {
        message: `☕ ${botName} بدأ يحكي! الجزء الأول جاهز للقراءة، وجاري توليد باقي الأجزاء في الخلفية تلقائياً.`,
        type: 'success',
      });

      // Automatically trigger background generation of the remaining chapters!
      if (story.chapters.length < story.targetChapters) {
        setTimeout(() => {
          void startAutoBackgroundGeneration(story);
        }, 500);
      }
    } catch (err: any) {
      console.error('[StorytellerView] Failed to start story:', err);
      const msg = err?.message || 'تعذر بدء الحكاية حالياً. يرجى المحاولة مرة أخرى.';
      setErrorText(msg);
      eventBus.emit('ui:toast', {
        message: msg,
        type: 'error',
      });
    } finally {
      setIsStartingStory(false);
      if (!autoGenLockRef.current) {
        storytellerBackground.stopKeepAlive();
      }
    }
  };

  // Generate next story part sequentially
  const handleGenerateNextChapter = async () => {
    if (!currentStory) return;
    if (currentStory.chapters.length >= currentStory.targetChapters) return;

    setErrorText(null);
    setIsGeneratingNext(true);
    triggerHaptic('medium');

    // Keep background alive during next part generation
    storytellerBackground.startKeepAlive();

    try {
      const updatedStory = await generateNextStoryChapter(
        currentStory,
        userDirective.trim() || undefined,
        botName,
      );

      setCurrentStory(updatedStory);
      currentStoryRef.current = updatedStory;
      setActiveChapterIndex(updatedStory.chapters.length - 1);
      setUserDirective('');
      setShowDirectiveInput(false);
      await refreshLibrary();
      triggerHaptic('success');

      // Alert user with chime and notification even if in another tab
      storytellerBackground.notifyPartReady(
        botName,
        updatedStory.chapters.length,
        updatedStory.chapters[updatedStory.chapters.length - 1].title,
      );

      eventBus.emit('ui:toast', {
        message: `✨ ${botName} نزّل الجزء ${updatedStory.chapters.length}!`,
        type: 'success',
      });

      // Scroll reader to top of new part
      if (readingContainerRef.current) {
        readingContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }

      // If auto-advance is enabled and not completed, continue in background
      if (autoAdvance && updatedStory.chapters.length < updatedStory.targetChapters) {
        setTimeout(() => {
          void startAutoBackgroundGeneration(updatedStory);
        }, 600);
      }
    } catch (err: any) {
      console.error('[StorytellerView] Failed to generate next part:', err);
      const msg = err?.message || 'تعذر توليد الجزء التالي حالياً.';
      setErrorText(msg);
      eventBus.emit('ui:toast', {
        message: msg,
        type: 'error',
      });
    } finally {
      setIsGeneratingNext(false);
      if (!isAutoGenerating) {
        storytellerBackground.stopKeepAlive();
      }
    }
  };

  // Regenerate current part
  const handleRegenerateCurrentChapter = async () => {
    if (!currentStory) return;
    const currentChapter = currentStory.chapters[activeChapterIndex];
    if (!currentChapter) return;

    setErrorText(null);
    setIsRegenerating(true);
    triggerHaptic('medium');
    storytellerBackground.startKeepAlive();

    try {
      const updatedStory = await regenerateCurrentChapter(
        currentStory,
        currentChapter.chapterNumber,
        userDirective.trim() || undefined,
        botName,
      );

      setCurrentStory(updatedStory);
      setUserDirective('');
      setShowDirectiveInput(false);
      await refreshLibrary();
      triggerHaptic('success');

      eventBus.emit('ui:toast', {
        message: `🔄 أعاد ${botName} حكي الجزء ${currentChapter.chapterNumber} بأسلوب جديد!`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('[StorytellerView] Failed to regenerate part:', err);
      const msg = err?.message || 'فشلت إعادة صياغة هذا الجزء.';
      setErrorText(msg);
    } finally {
      setIsRegenerating(false);
      storytellerBackground.stopKeepAlive();
    }
  };

  // Copy current part text
  const handleCopyChapter = async () => {
    if (!currentStory) return;
    const chapter = currentStory.chapters[activeChapterIndex];
    if (!chapter) return;

    try {
      const textToCopy = `☕ ${currentStory.title}\n[الجزء ${chapter.chapterNumber}: ${chapter.title}]\n\n${chapter.content}\n\n---\nبصوت وحكاية: ${currentStory.persona?.botName || botName}`;
      await navigator.clipboard.writeText(textToCopy);
      setCopiedMessage(true);
      triggerHaptic('light');
      setTimeout(() => setCopiedMessage(false), 2000);
    } catch {
      eventBus.emit('ui:toast', {
        message: 'تعذر نسخ النص تلقائياً.',
        type: 'warning',
      });
    }
  };

  // Send current part or entire story to chat
  const handleSendChapterToChat = async (fullStory: boolean = false) => {
    if (!currentStory || !onSendToChat) return;
    triggerHaptic('light');

    try {
      let formatted = '';
      if (fullStory) {
        formatted = `☕ **حكاية: ${currentStory.title}**\n_${currentStory.logline}_\n\n` +
          currentStory.chapters
            .map(ch => `### الجزء ${ch.chapterNumber}: ${ch.title}\n${ch.content}`)
            .join('\n\n---\n\n') +
          `\n\n_حكاها لك رفيق: ${currentStory.persona?.botName || botName}_`;
      } else {
        const chapter = currentStory.chapters[activeChapterIndex];
        if (!chapter) return;
        formatted = `☕ **${currentStory.title}**\n*الجزء ${chapter.chapterNumber}: ${chapter.title}*\n\n${chapter.content}\n\n${chapter.cliffhanger ? `✨ *${chapter.cliffhanger}*` : ''}\n\n_بصوت رفيقك: ${currentStory.persona?.botName || botName}_`;
      }

      await onSendToChat(formatted);
      setSentToChatMessage(true);
      setTimeout(() => setSentToChatMessage(false), 2000);
      eventBus.emit('ui:toast', {
        message: fullStory ? 'تم إرسال الحكاية كاملة إلى الشات.' : 'تم إرسال هذا الجزء إلى الشات.',
        type: 'success',
      });
    } catch (err) {
      console.error('[StorytellerView] Failed to send to chat:', err);
    }
  };

  // Delete a story
  const handleDeleteStory = async (storyId: string) => {
    if (!confirm('هل تريد بالتأكيد حذف هذه الحكاية من مكتبتك؟')) return;
    try {
      await deleteStory(storyId);
      if (currentStory?.id === storyId) {
        setCurrentStory(null);
        setViewMode('create');
      }
      await refreshLibrary();
      triggerHaptic('warning');
    } catch (err) {
      console.error('[StorytellerView] Failed to delete story:', err);
    }
  };

  // Reader Font Size Class
  const readerFontClass = useMemo(() => {
    switch (fontSize) {
      case 'sm':
        return 'text-[15px] sm:text-[16px] leading-[1.8] sm:leading-[1.9]';
      case 'lg':
        return 'text-[18px] sm:text-[20px] leading-[2.1] sm:leading-[2.2]';
      case 'xl':
        return 'text-[20px] sm:text-[23px] leading-[2.3] sm:leading-[2.4]';
      case 'base':
      default:
        return 'text-[16px] sm:text-[18px] leading-[1.95] sm:leading-[2.05]';
    }
  }, [fontSize]);

  const activeChapter = currentStory?.chapters[activeChapterIndex];
  const isFinalChapterReached = currentStory && currentStory.chapters.length >= currentStory.targetChapters;

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden bg-[#faf8f5] dark:bg-[#0c1317] text-[#111b21] dark:text-[#e9edef] select-text"
      dir="rtl"
    >
      {/* Hidden file input for Image / Video Upload */}
      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleMediaSelected}
      />

      {/* Top Application Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-black/5 dark:border-white/10 bg-[#f0f2f5] dark:bg-[#202c33] px-3 sm:px-6 shadow-2xs z-20">
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 items-center gap-1.5 rounded-full px-2.5 sm:px-3 text-xs sm:text-sm font-bold text-[#008069] dark:text-[#25d366] hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"
            title="رجوع للمحادثة"
          >
            <ArrowRight size={18} />
            <span className="hidden sm:inline">رجوع للشات</span>
          </button>

          <div className="h-5 w-px bg-black/10 dark:bg-white/10" />

          {/* Bot Avatar & Info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <Avatar
                name={botName}
                gender={botSettings.botGender || 'male'}
                size="sm"
                imageUrl={botSettings.avatarUrl}
              />
              <span className="absolute -bottom-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] text-white shadow-xs">
                ☕
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm sm:text-base font-bold text-[#111b21] dark:text-white">
                  حكايات وسوالف {botName}
                </h1>
                <span className="hidden xs:inline-flex items-center rounded-md bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                  عامية مصرية حية 🇪🇬
                </span>
              </div>
              <p className="truncate text-[11px] text-[#54656f] dark:text-[#8696a0]">
                {viewMode === 'reading' && currentStory
                  ? `«${currentStory.title}» • الجزء ${activeChapterIndex + 1} من ${currentStory.targetChapters}`
                  : `بيحكيلك مواقف يومه كأنه قاعد معاك على القهوة!`}
              </p>
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Background notifications toggle */}
          {!notificationsAllowed && (
            <button
              type="button"
              onClick={handleEnableNotifications}
              className="hidden sm:flex h-9 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/40 px-2.5 text-[11px] font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100"
              title="تفعيل إشعارات الخلفية عند اكتمال أجزاء الحكاية"
            >
              <Bell size={13} />
              <span>إشعار في الخلفية</span>
            </button>
          )}

          {viewMode === 'reading' && (
            <>
              {/* Font Size Adjuster */}
              <div className="hidden xs:flex items-center rounded-lg bg-black/5 dark:bg-white/5 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setFontSize(prev => (prev === 'xl' ? 'lg' : prev === 'lg' ? 'base' : 'sm'))}
                  disabled={fontSize === 'sm'}
                  className="rounded px-2 py-1 font-bold disabled:opacity-40 hover:bg-black/5 dark:hover:bg-white/10"
                  title="تصغير الخط"
                >
                  A-
                </button>
                <button
                  type="button"
                  onClick={() => setFontSize(prev => (prev === 'sm' ? 'base' : prev === 'base' ? 'lg' : 'xl'))}
                  disabled={fontSize === 'xl'}
                  className="rounded px-2 py-1 font-bold disabled:opacity-40 hover:bg-black/5 dark:hover:bg-white/10"
                  title="تكبير الخط"
                >
                  A+
                </button>
              </div>

              {/* Send to chat */}
              <button
                type="button"
                onClick={() => void handleSendChapterToChat(false)}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-[#008069] px-2.5 sm:px-3 text-xs font-bold text-white shadow-2xs hover:bg-[#006c58] active:scale-95 transition-all"
                title="إرسال هذا الجزء للشات"
              >
                <Send size={14} />
                <span className="hidden sm:inline">{sentToChatMessage ? 'تم الإرسال!' : 'للشات'}</span>
              </button>
            </>
          )}

          {/* New Story Button */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setViewMode('create');
            }}
            className={`flex h-9 items-center gap-1.5 rounded-lg px-2.5 sm:px-3 text-xs font-bold transition-all ${
              viewMode === 'create'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-black/5 dark:bg-white/5 text-[#111b21] dark:text-[#e9edef] hover:bg-black/10 dark:hover:bg-white/10'
            }`}
            title="سالفة / حكاية جديدة"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">سالفة جديدة</span>
          </button>

          {/* Library Button */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setShowLibraryDrawer(prev => !prev);
            }}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-black/5 dark:bg-white/5 px-2.5 sm:px-3 text-xs font-bold text-[#111b21] dark:text-[#e9edef] hover:bg-black/10 dark:hover:bg-white/10 transition-all"
            title="حكاياتي المحفوظة"
          >
            <BookText size={15} />
            <span className="hidden md:inline">حكاياتي</span>
            {savedStories.length > 0 && (
              <span className="grid h-4 min-w-[16px] place-items-center rounded-full bg-amber-600 px-1 text-[10px] font-bold text-white">
                {savedStories.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="relative flex-1 overflow-hidden flex">
        {/* VIEW 1: CREATION FORM */}
        {viewMode === 'create' ? (
          <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <div className="mx-auto max-w-2xl">
              {/* Persona Narrator Banner */}
              <div className="mb-6 rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-teal-500/10 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200/60 dark:border-amber-800/40 p-4 sm:p-5 shadow-xs">
                <div className="flex items-start gap-3.5">
                  <div className="relative shrink-0">
                    <Avatar
                      name={botName}
                      gender={botSettings.botGender || 'male'}
                      size="md"
                      imageUrl={botSettings.avatarUrl}
                    />
                    <span className="absolute -bottom-1 -right-1 text-sm">☕</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-bold text-amber-950 dark:text-amber-200">
                        {botName} بيحكيلك اللي حصل معاه!
                      </h2>
                      <span className="rounded-full bg-amber-200/70 dark:bg-amber-900/60 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:text-amber-200">
                        مش روايات.. سوالف ومواقف يومية حقيقية!
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-amber-900/80 dark:text-amber-300/80">
                      قول له يتكلم عن أي موضوع أو ارفع له صورة/فيديو.. وهيقعد معاك زي صاحبك يحكيلك الموقف بالعامية المصرية وبنفس شخصيته ولزماته وخفة دمه جزء بجزء فوراً!
                    </p>
                    <div className="mt-2.5 flex items-center gap-2 flex-wrap text-[11px] text-[#54656f] dark:text-[#8696a0]">
                      <span className="inline-flex items-center gap-1 rounded bg-white/70 dark:bg-black/30 px-2 py-0.5 border border-black/5 dark:border-white/5 font-medium">
                        🗣️ عامية مصرية عفوية
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-white/70 dark:bg-black/30 px-2 py-0.5 border border-black/5 dark:border-white/5 font-medium">
                        ⚡ الجزء الأول يظهر فوراً
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-white/70 dark:bg-black/30 px-2 py-0.5 border border-black/5 dark:border-white/5 font-medium">
                        🛡️ شغال في الخلفية لو غيرت التاب
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Image / Video Attachment Card */}
              <section className="mb-6 rounded-2xl bg-white dark:bg-[#1f2c34] p-5 sm:p-6 shadow-sm border border-stone-200 dark:border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📸</span>
                    <h3 className="text-sm font-bold text-[#111b21] dark:text-white">
                      ارفع صورة أو فيديو يحكي عنه رفيق (اختياري)
                    </h3>
                  </div>
                  <span className="text-[11px] text-[#667781]">صورة أو فيديو</span>
                </div>
                <p className="text-xs text-[#54656f] dark:text-[#8696a0] mb-3">
                  لو رفعت صورة أو فيديو، رفيق هيتأمل اللي فيه ويحكيلك الكواليس والموقف اللي حصل معاه كأنه كان في قلب الحدث!
                </p>

                {mediaFile ? (
                  /* Media Preview Card */
                  <div className="relative rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20 p-3 flex items-center gap-3">
                    <div className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-lg overflow-hidden bg-black/10 flex items-center justify-center border border-black/5">
                      {mediaFile.type === 'video' ? (
                        <video
                          src={mediaFile.previewUrl}
                          className="h-full w-full object-cover"
                          muted
                          playsInline
                        />
                      ) : (
                        <img
                          src={mediaFile.previewUrl}
                          alt="مرفق القصة"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-amber-200 dark:bg-amber-900/60 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 dark:text-amber-200">
                          {mediaFile.type === 'video' ? 'مقطع فيديو' : 'صورة مرجعية'}
                        </span>
                        <span className="text-xs font-bold truncate text-[#111b21] dark:text-white">
                          {mediaFile.name}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-[#54656f] dark:text-[#8696a0]">
                        جاهز! رفيق هيعتمد على اللقطة دي لبناء الحكاية بالكامل.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveMedia}
                      className="rounded-full p-1.5 text-stone-400 hover:text-red-500 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      title="إزالة المرفق"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  /* Media Picker Trigger */
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isUploadingMedia || isStartingStory}
                      onClick={() => mediaInputRef.current?.click()}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 dark:border-white/10 bg-[#faf8f5] dark:bg-[#121b22] px-4 py-3 text-xs font-bold text-[#54656f] dark:text-[#8696a0] hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                    >
                      <Camera size={16} />
                      <span>اختر صورة لبناء الحكاية عليها</span>
                    </button>
                    <button
                      type="button"
                      disabled={isUploadingMedia || isStartingStory}
                      onClick={() => mediaInputRef.current?.click()}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 dark:border-white/10 bg-[#faf8f5] dark:bg-[#121b22] px-4 py-3 text-xs font-bold text-[#54656f] dark:text-[#8696a0] hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                    >
                      <Video size={16} />
                      <span>اختر مقطع فيديو</span>
                    </button>
                  </div>
                )}
              </section>

              {/* Story Premise / Topic Input */}
              <section className="mb-6 rounded-2xl bg-white dark:bg-[#1f2c34] p-5 sm:p-6 shadow-sm border border-stone-200 dark:border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="story-premise" className="block text-sm font-bold text-[#111b21] dark:text-white">
                    عايز {botName} يتكلم أو يحكي عن إيه؟
                  </label>
                  <span className="text-[11px] text-[#667781]">
                    {mediaFile ? 'اختياري لو رفعت صورة/فيديو' : 'مطلوب'}
                  </span>
                </div>

                <textarea
                  id="story-premise"
                  value={premise}
                  onChange={e => setPremise(e.target.value)}
                  disabled={isStartingStory}
                  rows={3}
                  className="w-full resize-y rounded-xl border border-stone-300 dark:border-white/10 bg-[#faf8f5] dark:bg-[#121b22] px-4 py-3 text-sm leading-6 text-[#111b21] dark:text-white outline-none placeholder:text-[#667781] focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50"
                  placeholder="قول لـ رفيق اتكلم عن كذا.. مثلاً: اتكلم عن موقف غريب حصل معاك في الشارع، أو مشوار ميكروباص، أو سيبه يرتجل ويحكي بناءً على الصورة/الفيديو اللي رفعتها!"
                  dir="auto"
                />
              </section>

              {/* Story Length (Number of Parts / Stories) - Zero Presets */}
              <section className="mb-6 rounded-2xl bg-white dark:bg-[#1f2c34] p-5 sm:p-6 shadow-sm border border-stone-200 dark:border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#111b21] dark:text-white">
                      طول الحكاية (عدد الفصول)
                    </h3>
                    <p className="text-[11px] text-[#667781]">
                      حدد عدد الفصول اللي تحبها (من 2 لـ 20 فصل)، ورفيق هيولدهم ورا بعض في الخلفية!
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={targetChapters <= 2}
                      onClick={() => {
                        setTargetChapters(prev => Math.max(2, prev - 1));
                        triggerHaptic('light');
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 dark:bg-white/10 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-white/20 disabled:opacity-30 active:scale-95 transition-all"
                      title="تقليل عدد الفصول"
                    >
                      <Minus size={15} />
                    </button>
                    <div className="flex items-center gap-1 rounded-lg bg-amber-100 dark:bg-amber-900/50 px-2 py-1 border border-amber-300 dark:border-amber-700">
                      <input
                        type="number"
                        min={2}
                        max={20}
                        value={targetChapters}
                        onChange={e => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) {
                            setTargetChapters(Math.min(25, Math.max(2, val)));
                          }
                        }}
                        className="w-8 bg-transparent text-center text-xs font-black text-amber-950 dark:text-amber-200 outline-none"
                      />
                      <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300">أجزاء</span>
                    </div>
                    <button
                      type="button"
                      disabled={targetChapters >= 20}
                      onClick={() => {
                        setTargetChapters(prev => Math.min(20, prev + 1));
                        triggerHaptic('light');
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 dark:bg-white/10 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-white/20 disabled:opacity-30 active:scale-95 transition-all"
                      title="زيادة عدد الفصول"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>

                {/* Range Slider & Quick Part Chips */}
                <div className="space-y-3">
                  <input
                    type="range"
                    min={2}
                    max={20}
                    value={targetChapters}
                    onChange={e => setTargetChapters(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <div className="grid grid-cols-6 gap-1.5 pt-1">
                    {[3, 5, 8, 10, 15, 20].map(count => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => {
                          setTargetChapters(count);
                          triggerHaptic('light');
                        }}
                        className={`rounded-lg py-1.5 text-xs font-bold transition-all border ${
                          targetChapters === count
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
                            : 'border-stone-200 dark:border-white/10 bg-[#faf8f5] dark:bg-[#121b22] text-[#54656f] dark:text-[#8696a0] hover:border-stone-300'
                        }`}
                      >
                        {count} فصول
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-[#667781] px-1">
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                      📏 كل فصل مش أقل من 300 كلمة من السرد والتفاصيل
                    </span>
                    <span>
                      ⏳ قراءة تقريبية: {targetChapters * 2} دقيقة
                    </span>
                  </div>
                </div>
              </section>

              {/* Error Alert */}
              {errorText && (
                <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/40 p-3.5 text-xs text-red-700 dark:text-red-300">
                  {errorText}
                </div>
              )}

              {/* Primary Start Button */}
              <div className="sticky bottom-4 z-10 pt-2 pb-2">
                <button
                  type="button"
                  onClick={() => void handleStartStory()}
                  disabled={isStartingStory || (!premise.trim() && !mediaFile)}
                  className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-6 py-3.5 text-sm sm:text-base font-extrabold text-white shadow-lg shadow-amber-500/25 transition-all hover:from-amber-600 hover:to-orange-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isStartingStory ? (
                    <>
                      <RefreshCw size={20} className="animate-spin" />
                      <span>{botName} بيجهز القعدة وبيحكي الفصل الأول دلوقتي...</span>
                    </>
                  ) : (
                    <>
                      <Coffee size={20} />
                      <span>احكيلي يا {botName} (اسمع أول جزء فوراً) 🎙️✨</span>
                    </>
                  )}
                </button>
                <div className="mt-2 flex items-center justify-center gap-3 text-[11px] text-[#667781]">
                  <span>⚡ أول جزء بيظهرلك فوراً</span>
                  <span>•</span>
                  <span>🔄 باقي الفصول بتتولد تلقائياً في الخلفية</span>
                  <span>•</span>
                  <span>💾 محفوظة للأبد</span>
                </div>
              </div>

              {/* Permanent Saved Stories Section directly on Creation Page */}
              {savedStories.length > 0 && (
                <section className="mt-8 mb-8 pt-6 border-t border-stone-200 dark:border-white/10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <BookOpen size={18} className="text-amber-600" />
                      <h3 className="text-sm sm:text-base font-extrabold text-[#111b21] dark:text-white">
                        حكاياتك وسوالفك السابقة المحفوظة ({savedStories.length})
                      </h3>
                    </div>
                    <span className="text-[11px] text-[#667781]">
                      محفوظة للأبد وتقدر ترجعلها في أي وقت
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {savedStories.map(story => {
                      const isCompleted = story.chapters.length >= story.targetChapters;
                      return (
                        <div
                          key={story.id}
                          onClick={() => {
                            setCurrentStory(story);
                            setActiveChapterIndex(Math.max(0, story.chapters.length - 1));
                            setViewMode('reading');
                            triggerHaptic('light');
                          }}
                          className="group relative flex flex-col justify-between rounded-2xl bg-white dark:bg-[#1f2c34] p-4 border border-stone-200 dark:border-white/5 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <h4 className="text-sm font-bold text-[#111b21] dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate">
                                {story.title}
                              </h4>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  isCompleted
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                }`}
                              >
                                {isCompleted ? 'مكتملة ✅' : `${story.chapters.length} من ${story.targetChapters} أجزاء ⏳`}
                              </span>
                            </div>
                            <p className="text-xs text-[#54656f] dark:text-[#8696a0] line-clamp-2 leading-relaxed">
                              {story.logline || story.premise}
                            </p>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-stone-100 dark:border-white/5 flex items-center justify-between text-[11px] text-[#8696a0]">
                            <span>{new Date(story.updatedAt).toLocaleDateString('ar-EG')}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-amber-600 dark:text-amber-400 group-hover:underline">
                                فتح الحكاية 📖 ←
                              </span>
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  void handleDeleteStory(story.id);
                                }}
                                className="text-stone-400 hover:text-red-500 p-1 transition-colors"
                                title="حذف الحكاية"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          </main>
        ) : (
          /* VIEW 2: ACTIVE STORY READER & CHAT CONTINUATION */
          <main
            ref={readingContainerRef}
            className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6"
          >
            {currentStory && activeChapter ? (
              <div className="mx-auto max-w-3xl">
                {/* Real-time Background Auto-Generation Status Banner */}
                {isAutoGenerating && (
                  <div className="mb-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-300 dark:border-amber-700/60 p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-xs animate-pulse">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white shadow-xs">
                        <RefreshCw size={15} className="animate-spin" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-extrabold text-amber-950 dark:text-amber-200">
                            {botName} بيحكي الجزء {currentStory.chapters.length + 1} في الخلفية الآن...
                          </span>
                          <span className="rounded-md bg-amber-200/80 dark:bg-amber-900/70 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 dark:text-amber-200">
                            {currentStory.chapters.length} من {currentStory.targetChapters} أجزاء جاهزة
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80 truncate">
                          شغال حتى لو رحت تاب تانية أو قفلت الشاشة! أول ما يخلص هينزل هنا ويسمعك إشعار.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={pauseAutoGeneration}
                      className="shrink-0 rounded-xl bg-white dark:bg-[#1f2c34] border border-amber-200 dark:border-white/10 px-3 py-1.5 text-xs font-bold text-amber-900 dark:text-amber-200 hover:bg-amber-50 active:scale-95 transition-all"
                    >
                      إيقاف مؤقت ⏸️
                    </button>
                  </div>
                )}

                {/* Auto-Generation Paused or Ready to Resume Banner */}
                {!isAutoGenerating && !isFinalChapterReached && (
                  <div className="mb-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 p-3 sm:p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base shrink-0">☕</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-200">
                            متبقي {currentStory.targetChapters - currentStory.chapters.length} أجزاء لتكتمل الحكاية
                          </span>
                          <span className="rounded bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.2 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                            {currentStory.chapters.length}/{currentStory.targetChapters}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#667781] truncate">
                          كل جزء مش أقل من 300 كلمة.. تقدر تخليه يكملهم ورا بعض في الخلفية
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={resumeAutoGeneration}
                      className="shrink-0 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:from-amber-600 hover:to-orange-600 active:scale-95 transition-all"
                    >
                      كمّل في الخلفية تلقائياً ▶️
                    </button>
                  </div>
                )}

                {/* Story Top Info Banner */}
                <div className="mb-4 rounded-2xl bg-white dark:bg-[#1f2c34] p-4 sm:p-5 shadow-xs border border-stone-200 dark:border-white/5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="rounded-md bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                          حكاية وسالفة من يومه ☕
                        </span>
                        <span className="text-[11px] text-[#667781]">
                          بصوت وحكاية: {currentStory.persona?.botName || botName}
                        </span>
                      </div>
                      <h2 className="text-lg sm:text-xl font-extrabold text-[#111b21] dark:text-white">
                        {currentStory.title}
                      </h2>
                      <p className="mt-1 text-xs text-[#54656f] dark:text-[#8696a0] italic">
                        «{currentStory.logline}»
                      </p>
                    </div>

                    {/* Quick Chapter Action Menu */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleCopyChapter()}
                        className="flex h-8 items-center gap-1 rounded-lg border border-stone-200 dark:border-white/10 bg-[#faf8f5] dark:bg-[#121b22] px-2.5 text-[11px] font-bold text-[#54656f] dark:text-[#8696a0] hover:bg-stone-100"
                        title="نسخ نص هذا الجزء"
                      >
                        {copiedMessage ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                        <span className="hidden sm:inline">{copiedMessage ? 'تم النسخ!' : 'نسخ'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => downloadStoryFile(exportStoryAsMarkdown(currentStory), `${currentStory.title}.md`, 'text/markdown')}
                        className="flex h-8 items-center gap-1 rounded-lg border border-stone-200 dark:border-white/10 bg-[#faf8f5] dark:bg-[#121b22] px-2.5 text-[11px] font-bold text-[#54656f] dark:text-[#8696a0] hover:bg-stone-100"
                        title="تحميل الحكاية بصيغة Markdown"
                      >
                        <Download size={13} />
                        <span className="hidden sm:inline">MD</span>
                      </button>
                    </div>
                  </div>

                  {/* Seed Media Banner (if uploaded) */}
                  {currentStory.mediaSeed && (
                    <div className="mt-3 pt-3 border-t border-stone-100 dark:border-white/5 flex items-center gap-2.5 text-xs text-[#54656f] dark:text-[#8696a0]">
                      <span className="rounded bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-200">
                        {currentStory.mediaSeed.type === 'video' ? '🎥 فيديو ملهم' : '📸 صورة ملهمة'}
                      </span>
                      <span className="truncate">{currentStory.mediaSeed.name || 'مرفق الحكاية الأصلي'}</span>
                    </div>
                  )}

                  {/* Horizontal Scrollable Parts Pills */}
                  <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 pt-2 border-t border-stone-100 dark:border-white/5 scrollbar-thin">
                    {currentStory.plannedChapters.map((planned, idx) => {
                      const isGenerated = idx < currentStory.chapters.length;
                      const isCurrentActive = idx === activeChapterIndex;

                      return (
                        <button
                          key={planned.chapterNumber}
                          type="button"
                          disabled={!isGenerated}
                          onClick={() => {
                            if (isGenerated) {
                              setActiveChapterIndex(idx);
                              triggerHaptic('light');
                            }
                          }}
                          className={`flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1 text-xs font-bold transition-all ${
                            isCurrentActive
                              ? 'bg-amber-600 text-white shadow-2xs'
                              : isGenerated
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 hover:bg-amber-200'
                              : 'bg-stone-100 dark:bg-white/5 text-[#8696a0] opacity-60 cursor-not-allowed'
                          }`}
                        >
                          <span>الجزء {planned.chapterNumber}</span>
                          {isGenerated && <Check size={11} />}
                          {!isGenerated && <Clock size={11} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Chapter Story Canvas */}
                <article className="rounded-2xl bg-white dark:bg-[#1f2c34] p-6 sm:p-10 shadow-sm border border-stone-200 dark:border-white/5 transition-all">
                  {/* Chapter Header */}
                  <div className="mb-6 pb-4 border-b border-stone-100 dark:border-white/5 text-center">
                    <span className="inline-block rounded-full bg-amber-100 dark:bg-amber-900/40 px-3 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-300 mb-2">
                      الجزء {activeChapter.chapterNumber} من {currentStory.targetChapters}
                    </span>
                    <h1 className="text-xl sm:text-2xl font-extrabold text-[#111b21] dark:text-white">
                      {activeChapter.title}
                    </h1>
                    <div className="mt-2 flex items-center justify-center gap-2.5 text-xs text-[#667781] flex-wrap">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                        {activeChapter.wordCount} كلمة {activeChapter.wordCount >= 300 ? '✓ (مش أقل من 300 كلمة)' : ''}
                      </span>
                      <span>•</span>
                      <span>سالفة {Math.max(1, Math.ceil(activeChapter.wordCount / 160))} دقيقة قراءة</span>
                    </div>
                  </div>

                  {/* Chapter Body Text (Colloquial First-Person Voice) */}
                  <div className={`text-[#202c33] dark:text-[#d1d7db] font-sans ${readerFontClass} space-y-5 text-right`}>
                    {activeChapter.content.split('\n\n').map((paragraph, pIdx) => {
                      const trimmed = paragraph.trim();
                      if (!trimmed) return null;
                      return (
                        <p key={pIdx} className="leading-relaxed">
                          {trimmed}
                        </p>
                      );
                    })}
                  </div>

                  {/* Conversational Cliffhanger Hook */}
                  {activeChapter.cliffhanger && (
                    <div className="mt-8 rounded-xl bg-gradient-to-r from-amber-50 via-orange-50 to-stone-50 dark:from-amber-950/30 dark:to-orange-950/20 p-4 border border-amber-200 dark:border-amber-800/40">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-300 mb-1">
                        <Coffee size={14} className="text-amber-600" />
                        {botName} بيقولك:
                      </div>
                      <p className="text-xs sm:text-sm font-medium italic text-amber-950 dark:text-amber-200">
                        "{activeChapter.cliffhanger}"
                      </p>
                    </div>
                  )}

                  {/* Chapter Actions */}
                  <div className="mt-6 pt-4 border-t border-stone-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleSendChapterToChat(false)}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
                      >
                        <Send size={13} />
                        إرسال هذا الجزء للشات
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowDirectiveInput(!showDirectiveInput)}
                        className="flex items-center gap-1 rounded-lg border border-stone-200 dark:border-white/10 px-2.5 py-1.5 font-semibold text-[#54656f] dark:text-[#8696a0] hover:bg-stone-50"
                      >
                        <Wand2 size={13} />
                        علّق على كلامه
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleRegenerateCurrentChapter()}
                      disabled={isRegenerating || isGeneratingNext}
                      className="flex items-center gap-1.5 text-xs text-[#667781] hover:text-amber-600 disabled:opacity-50"
                    >
                      <RefreshCw size={12} className={isRegenerating ? 'animate-spin' : ''} />
                      احكي الجزء ده بطريقة تانية
                    </button>
                  </div>

                  {/* Comment / Directive Drawer */}
                  {showDirectiveInput && (
                    <div className="mt-3 rounded-xl bg-stone-50 dark:bg-[#121b22] p-3 border border-stone-200 dark:border-white/10">
                      <label className="block text-xs font-bold text-[#111b21] dark:text-white mb-1">
                        عايز تقوله حاجة في كلامه أو توجهه في الجزء القادم؟
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={userDirective}
                          onChange={e => setUserDirective(e.target.value)}
                          placeholder="مثلاً: ماقولتليش عملت إيه مع السواق؟ أو زوّد التفاصيل المضحكة..."
                          className="flex-1 rounded-lg border border-stone-300 dark:border-white/10 bg-white dark:bg-[#1f2c34] px-3 py-1.5 text-xs text-[#111b21] dark:text-white outline-none focus:border-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => void handleRegenerateCurrentChapter()}
                          disabled={isRegenerating || !userDirective.trim()}
                          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                        >
                          تطبيق
                        </button>
                      </div>
                    </div>
                  )}
                </article>

                {/* Next Part Progression Control Bar */}
                <div className="mt-5 mb-8">
                  {!isFinalChapterReached ? (
                    <div className="rounded-2xl bg-white dark:bg-[#1f2c34] p-5 shadow-sm border border-stone-200 dark:border-white/5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <div>
                          <h3 className="text-sm font-bold text-[#111b21] dark:text-white">
                            متابعة الحكاية: الجزء {currentStory.chapters.length + 1} من {currentStory.targetChapters}
                          </h3>
                          <p className="text-[11px] text-[#667781]">
                            {botName} هيكمل السالفة بالعامية من النقطة اللي وقف عندها بالضبط مع الحفاظ على نفس السياق!
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {isAutoGenerating ? (
                            <button
                              type="button"
                              onClick={pauseAutoGeneration}
                              className="rounded-lg bg-stone-100 dark:bg-white/10 px-3 py-1.5 text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-200"
                            >
                              إيقاف مؤقت ⏸️
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={resumeAutoGeneration}
                              className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 px-3 py-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100"
                            >
                              توليد تلقائي في الخلفية ⚡
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          onClick={() => void handleGenerateNextChapter()}
                          disabled={isGeneratingNext || isRegenerating || isAutoGenerating}
                          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-5 text-xs sm:text-sm font-bold text-white shadow-md shadow-amber-500/20 hover:from-amber-600 hover:to-orange-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 transition-all"
                        >
                          {isGeneratingNext ? (
                            <>
                              <RefreshCw size={17} className="animate-spin" />
                              <span>{botName} بيحكي الجزء {currentStory.chapters.length + 1} دلوقتي... (شغال في الخلفية)</span>
                            </>
                          ) : (
                            <>
                              <ChevronLeft size={17} />
                              <span>احكيلي الجزء التالي يدوياً ({currentStory.chapters.length + 1} من {currentStory.targetChapters}) ⏩</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Final Part Celebratory Card */
                    <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 p-6 border border-emerald-200 dark:border-emerald-800/40 text-center">
                      <span className="text-3xl">☕🎉</span>
                      <h3 className="mt-2 text-base font-extrabold text-emerald-900 dark:text-emerald-200">
                        ودي كانت الحكاية كلها يا سيدي!
                      </h3>
                      <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-300/80 max-w-md mx-auto">
                        {botName} خلص حكايته في الـ {currentStory.targetChapters} أجزاء بالكامل بدون أي نقصان، ومحفوظة في مكتبتك للأبد!
                      </p>

                      <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => void handleSendChapterToChat(true)}
                          className="flex items-center gap-2 rounded-xl bg-[#008069] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#006c58] shadow-xs"
                        >
                          <Send size={14} />
                          إرسال الحكاية كاملة للشات
                        </button>

                        <button
                          type="button"
                          onClick={() => downloadStoryFile(exportStoryAsMarkdown(currentStory), `${currentStory.title}.md`, 'text/markdown')}
                          className="flex items-center gap-2 rounded-xl bg-white dark:bg-[#1f2c34] px-4 py-2.5 text-xs font-bold text-[#111b21] dark:text-white border border-stone-200 dark:border-white/10 hover:bg-stone-50"
                        >
                          <Download size={14} />
                          تنزيل كملف Markdown
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setViewMode('create');
                            triggerHaptic('light');
                          }}
                          className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-700"
                        >
                          <Plus size={14} />
                          احكيلي سالفة جديدة
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </main>
        )}

        {/* LIBRARY SIDE DRAWER */}
        {showLibraryDrawer && (
          <aside className="absolute inset-y-0 left-0 z-30 w-full sm:w-80 bg-white dark:bg-[#1f2c34] border-r border-stone-200 dark:border-white/10 shadow-xl flex flex-col animate-in slide-in-from-left duration-200">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-stone-100 dark:border-white/5 px-4">
              <div className="flex items-center gap-2 font-bold text-sm text-[#111b21] dark:text-white">
                <Coffee size={16} className="text-amber-600" />
                <span>حكايات وسوالف محفوظة ({savedStories.length})</span>
              </div>
              <button
                type="button"
                onClick={() => setShowLibraryDrawer(false)}
                className="rounded-lg p-1 text-[#667781] hover:bg-black/5 dark:hover:bg-white/5"
              >
                <X size={18} />
              </button>
            </div>

            {/* Library Search Input */}
            <div className="p-3 border-b border-stone-100 dark:border-white/5">
              <input
                type="text"
                value={librarySearch}
                onChange={e => setLibrarySearch(e.target.value)}
                placeholder="ابحث في حكاياتك المحفوظة..."
                className="w-full rounded-xl border border-stone-200 dark:border-white/10 bg-[#faf8f5] dark:bg-[#121b22] px-3 py-2 text-xs text-[#111b21] dark:text-white outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {savedStories.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#8696a0]">
                  لا توجد حكايات محفوظة بعد. اطلب أول سالفة من {botName}!
                </div>
              ) : (
                savedStories
                  .filter(s => {
                    if (!librarySearch.trim()) return true;
                    const q = librarySearch.trim().toLowerCase();
                    return (
                      s.title.toLowerCase().includes(q) ||
                      (s.logline || '').toLowerCase().includes(q) ||
                      (s.premise || '').toLowerCase().includes(q)
                    );
                  })
                  .map(story => {
                    const isActive = currentStory?.id === story.id;
                    const isCompleted = story.chapters.length >= story.targetChapters;
                    return (
                      <div
                        key={story.id}
                        onClick={() => {
                          setCurrentStory(story);
                          setActiveChapterIndex(Math.max(0, story.chapters.length - 1));
                          setViewMode('reading');
                          setShowLibraryDrawer(false);
                          triggerHaptic('light');
                        }}
                        className={`group relative rounded-xl p-3 border cursor-pointer transition-all ${
                          isActive
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40'
                            : 'border-stone-200 dark:border-white/5 hover:border-amber-300 bg-[#faf8f5] dark:bg-[#121b22]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-bold text-[#111b21] dark:text-white truncate">
                            {story.title}
                          </h4>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDeleteStory(story.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-500 p-1 transition-opacity"
                            title="حذف الحكاية"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <p className="mt-1 text-[11px] leading-4 text-[#54656f] dark:text-[#8696a0] line-clamp-2">
                          {story.logline || story.premise}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-[10px] text-[#8696a0]">
                          <span className={isCompleted ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-amber-600 font-semibold'}>
                            {isCompleted ? 'مكتملة ✅' : `${story.chapters.length} من ${story.targetChapters} أجزاء`}
                          </span>
                          <span>{new Date(story.updatedAt).toLocaleDateString('ar-EG')}</span>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default StorytellerView;
