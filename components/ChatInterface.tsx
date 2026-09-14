import React, { useEffect, useRef, useState } from 'react';
import {
  Send,
  Mic,
  Image as ImageIcon,
  Video,
  PhoneCall,
  Info,
  X,
  ArrowRight,
  Upload,
  Trash2,
  MoreVertical,
  Check,
  Brain,
  Cpu,
  Paperclip,
  Download,
  FileText,
  Code2,
  FolderOpen,
  Palette,
  WandSparkles,
  BookOpen,
  Sparkles,
  Zap,
} from 'lucide-react';
import { AppMode, BotMood, MessageRole, type ChatMessage, type ChatSession, type UserProfile } from '../types.js';
import ChatBubble from './ChatBubble.js';
import Avatar from './Avatar.js';
import LiveVoice from './LiveVoice.js';
import ProfileImageViewer from './ProfileImageViewer.js';
import ComposerAttachmentTray from './ComposerAttachmentTray.js';
import PagedMessageList from './PagedMessageList.js';
import { SkillsHubModal } from './SkillsHubModal.js';
import { matchActiveSkill } from '../services/skillMatcher.js';
import { BUILTIN_SKILLS } from '../services/skillRegistry.js';
import { useChatController } from '../hooks/useChatController.js';
import { useGroupController } from '../hooks/useGroupController.js';
import { useRafiqStore } from '../stores/useRafiqStore.js';
import { useGroupStore } from '../stores/groupStore.js';
import * as DB from '../services/db.js';
import { VISIBLE_CHAT_MODELS, THINKING_LEVELS } from '../services/geminiModels.js';
import { downloadBlob, exportChat } from '../services/chatTransfer.js';
import WhatsAppAttachmentSheet from './WhatsAppAttachmentSheet.js';
import WhatsAppContactInfoDrawer from './WhatsAppContactInfoDrawer.js';
import { triggerHaptic } from '../utils/haptics.js';
import { RandomPromptsSettings } from './RandomPromptsSettings.js';
import { listRandomPrompts, seedDefaultPromptsIfEmpty } from '../services/randomPrompts.js';

interface ChatInterfaceProps {
  chat: ChatSession;
  userProfile: UserProfile | null;
  onBack: () => void;
  onInfo: () => void;
  onDelete: () => void;
}

const EMOJI_OPTIONS = [
  '😂', '😍', '🥰', '😭', '😅', '😌', '🙄', '😏',
  '❤️', '🤍', '🔥', '✨', '🥺', '👍', '🙏', '🌚',
  '☕', '🍕', '🎧', '📸', '💃', '😴', '😑', '🤦‍♀️',
];

const ComposerEmojiIcon = ({ className = '' }: { className?: string }) => (
  <svg aria-hidden="true" className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 32 32">
    <path fill="currentColor" d="M24.5 3A4.5 4.5 0 0 1 29 7.5V17h-7a5 5 0 0 0-4.939 4.214l-.486-.01c-2.078-.07-3.518-.653-4.434-1.205a6 6 0 0 1-1.059-.798a4 4 0 0 1-.231-.241q-.028-.029-.05-.06h-.002a1 1 0 0 0-1.604 1.194l.146.178c.083.096.202.225.358.375c.313.299.778.684 1.41 1.065c1.193.719 2.961 1.408 5.395 1.491l.496.008V29H7.5A4.5 4.5 0 0 1 3 24.5v-17A4.5 4.5 0 0 1 7.5 3zM11 9a2 2 0 1 0 0 4a2 2 0 0 0 0-4m10 0a2 2 0 1 0 0 4a2 2 0 0 0 0-4m7.555 10a4.5 4.5 0 0 1-.873 1.232l-7.45 7.45c-.361.362-.78.654-1.232.872V22a3 3 0 0 1 3-3z" />
  </svg>
);

const ComposerAttachmentIcon = ({ className = '' }: { className?: string }) => (
  <svg aria-hidden="true" className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <path fill="currentColor" d="M14 0a5 5 0 0 1 5 5v12a7 7 0 1 1-14 0V9h2v8a5 5 0 0 0 10 0V5a3 3 0 1 0-6 0v12a1 1 0 1 0 2 0V6h2v11a3 3 0 1 1-6 0V5a5 5 0 0 1 5-5" />
  </svg>
);

const ComposerCameraIcon = ({ className = '' }: { className?: string }) => (
  <svg aria-hidden="true" className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <path fill="currentColor" d="M8.5 4 7.1 5.75A2 2 0 0 1 5.54 6.5H4a3 3 0 0 0-3 3V17a3 3 0 0 0 3 3h16a3 3 0 0 0 3-3V9.5a3 3 0 0 0-3-3h-1.54a2 2 0 0 1-1.56-.75L15.5 4zm3.5 5a4.5 4.5 0 1 1 0 9a4.5 4.5 0 0 1 0-9m0 2a2.5 2.5 0 1 0 0 5a2.5 2.5 0 0 0 0-5" />
  </svg>
);

const ComposerMicIcon = ({ className = '' }: { className?: string }) => (
  <svg aria-hidden="true" className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3m5.3-3a1 1 0 1 1 2 0a7.31 7.31 0 0 1-6.3 7.23V21h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.77A7.31 7.31 0 0 1 4.7 11a1 1 0 1 1 2 0a5.3 5.3 0 0 0 10.6 0" />
  </svg>
);

const STUDIO_ASPECT_OPTIONS = [
  { value: '1:1', label: 'مربع 1:1' },
  { value: '3:4', label: 'عمودي 3:4' },
  { value: '4:3', label: 'أفقي 4:3' },
  { value: '9:16', label: 'ستوري 9:16' },
  { value: '16:9', label: 'سينمائي 16:9' },
] as const;

const STUDIO_SIZE_OPTIONS = ['1K', '2K', '4K'] as const;

const STUDIO_STYLE_OPTIONS = [
  { value: 'realistic', label: 'واقعي' },
  { value: 'cinematic', label: 'سينمائي' },
  { value: 'digital_art', label: 'رقمي' },
  { value: 'cartoon', label: 'كرتوني' },
  { value: 'anime', label: 'أنمي' },
  { value: 'oil_painting', label: 'زيتي' },
  { value: 'watercolor', label: 'مائي' },
  { value: 'sketch', label: 'رسم' },
] as const;

const ChatInterface: React.FC<ChatInterfaceProps> = ({ chat, userProfile, onBack, onInfo, onDelete }) => {
  const isGroup = Boolean(chat.isGroup);
  const chatCtrl = useChatController(chat.id);
  const groupCtrl = useGroupController(chat);
  const messages = isGroup ? groupCtrl.messages : chatCtrl.messages;
  const input = isGroup ? groupCtrl.input : chatCtrl.input;
  const setInput = isGroup ? groupCtrl.setInput : chatCtrl.setInput;
  const handleSend = isGroup ? groupCtrl.handleSend : chatCtrl.handleSend;
  const scrollRef = isGroup ? groupCtrl.scrollRef : chatCtrl.scrollRef;
  const isTyping = isGroup ? groupCtrl.typingUsers.length > 0 : chatCtrl.isTyping;
  const groupMemberSignature = [...(chat.memberIds || [])].sort().join(':');

  const [groupMembers, setGroupMembers] = useState<Record<string, ChatSession>>({});
  const typingGroupNames = groupCtrl.typingUsers.map(
    personaId => groupMembers[personaId]?.settings.botName || personaId,
  );
  const [showSkillsModal, setShowSkillsModal] = useState(false);
  const [showAttachSheet, setShowAttachSheet] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showContactInfoDrawer, setShowContactInfoDrawer] = useState(false);
  const [showProfileImage, setShowProfileImage] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [studioPrompt, setStudioPrompt] = useState('');
  const [showRandomPrompts, setShowRandomPrompts] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const activeSkillMatch = !isGroup && input.trim()
    ? matchActiveSkill(input, BUILTIN_SKILLS)
    : null;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const chatExportInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const handleExportChat = async () => {
    setIsExporting(true);
    try {
      const { blob, fileName } = await exportChat(chat.id);
      downloadBlob(blob, fileName);
      setShowSettingsMenu(false);
      const { eventBus } = await import('../services/eventBus.js');
      eventBus.emit('ui:toast', { message: 'تم تصدير المحادثة بنجاح ✅', type: 'success' });
    } catch (error) {
      console.error('Export failed:', error);
      const { eventBus } = await import('../services/eventBus.js');
      eventBus.emit('ui:toast', { message: 'فشل تصدير المحادثة', type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  const setPrompts = useRafiqStore(state => state.setRandomPrompts);
  useEffect(() => {
    if (!userProfile) return;
    seedDefaultPromptsIfEmpty()
      .then(() => listRandomPrompts())
      .then(setPrompts)
      .catch(error => console.warn('[ChatInterface] prompt load failed:', error));
  }, [userProfile?.id, setPrompts]);

  useEffect(() => {
    const closeTransientPopovers = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setShowAttachSheet(false);
      setShowSettingsMenu(false);
      setShowEmojiPicker(false);
    };
    window.addEventListener('keydown', closeTransientPopovers);
    return () => window.removeEventListener('keydown', closeTransientPopovers);
  }, []);

  useEffect(() => {
    if (isGroup && chat.memberIds) {
      void DB.getChatSessionsByIds(chat.memberIds).then(bots => {
        const map: Record<string, ChatSession> = {};
        bots.forEach(bot => { map[bot.id] = bot; });
        setGroupMembers(map);
      });
    }
    setShowAttachSheet(false);
    setShowSettingsMenu(false);
    setIsExporting(false);
    setShowEmojiPicker(false);
    setStudioPrompt('');
  }, [chat.id, isGroup, groupMemberSignature]);

  useEffect(() => () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    recorder.ondataavailable = null;
    recorder.onstop = null;
    if (recorder.state !== 'inactive') recorder.stop();
    recorder.stream.getTracks().forEach(track => track.stop());
    mediaRecorderRef.current = null;
  }, []);

  const handleTriggerSend = async (_chatId: string, text: string) => {
    if (isGroup) return;
    await chatCtrl.handleSend(text);
  };

  const insertEmoji = (emoji: string) => {
    const inputElement = messageInputRef.current;
    const selectionStart = inputElement?.selectionStart ?? input.length;
    const selectionEnd = inputElement?.selectionEnd ?? input.length;
    const nextInput = `${input.slice(0, selectionStart)}${emoji}${input.slice(selectionEnd)}`;
    const nextCursor = selectionStart + emoji.length;
    setInput(nextInput);
    window.setTimeout(() => {
      messageInputRef.current?.focus();
      messageInputRef.current?.setSelectionRange(nextCursor, nextCursor);
    }, 0);
  };

  const submitMessage = () => {
    setShowEmojiPicker(false);
    void handleSend();
  };

  const submitStudioPrompt = () => {
    if (!studioPrompt.trim()) return;
    setShowEmojiPicker(false);
    setShowAttachSheet(false);
    void chatCtrl.handleSend(studioPrompt.trim());
    setStudioPrompt('');
  };

  const updateStudioConfig = (patch: Partial<typeof chatCtrl.studioConfig>) => {
    chatCtrl.setStudioConfig(previous => ({ ...previous, ...patch }));
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    setIsDraggingFiles(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDraggingFiles(false);
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingFiles(false);
    if (event.dataTransfer.files.length > 0) {
      await (isGroup
        ? groupCtrl.handleFileDrop(event.dataTransfer.files)
        : chatCtrl.handleFileDrop(event.dataTransfer.files));
    }
  };

  const handleDeleteMessage = async (message: ChatMessage) => {
    const { removeMessage } = useRafiqStore.getState();
    if (isGroup) {
      useGroupStore.getState().removeGroupMessage(message.chatId, message.id);
    } else {
      removeMessage(message.chatId, message.id);
    }
    try {
      await DB.deleteMessage(message.id, message.chatId, isGroup);
      if (isGroup) {
        const updatedGroup = await DB.getChatSession(message.chatId);
        if (updatedGroup) useRafiqStore.getState().updateChat(updatedGroup);
      }
    } catch (error) {
      if (isGroup) useGroupStore.getState().addGroupMessage(message.chatId, message);
      console.error('Failed to delete message from DB:', error);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'voice_note.webm', { type: 'audio/webm' });
        if (isGroup) void groupCtrl.addAttachment(audioFile);
        else void chatCtrl.addAttachment(audioFile);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => setRecordingTime(previous => previous + 1), 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = (shouldSave: boolean) => {
    if (!mediaRecorderRef.current || !isRecording) return;
    if (shouldSave) {
      mediaRecorderRef.current.stop();
    } else {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}:${remainder.toString().padStart(2, '0')}`;
  };

  const getMoodColor = (mood?: BotMood) => {
    switch (mood) {
      case BotMood.ANGRY: return 'bg-red-600';
      case BotMood.SAD: return 'bg-slate-600';
      case BotMood.ROMANTIC: return 'bg-pink-600';
      case BotMood.EXCITED: return 'bg-orange-500';
      default: return 'bg-[#008069]';
    }
  };

  const visibleMessages = messages.filter(message => (
    message.role === MessageRole.USER || Boolean(message.text) || Boolean(message.attachments?.length)
  ));

  const renderMessage = (message: ChatMessage) => {
    const senderBot = isGroup && message.senderId !== 'user' ? groupMembers[message.senderId || ''] : undefined;
    return (
      <ChatBubble
        message={message}
        isUser={message.role === MessageRole.USER}
        senderName={isGroup
          ? senderBot?.settings.botName || 'Unknown'
          : message.role === MessageRole.MODEL ? chat.settings.botName : 'You'}
        senderAvatar={isGroup
          ? senderBot?.settings.avatarUrl
          : message.role === MessageRole.MODEL ? chat.settings.avatarUrl : undefined}
        isGroup={isGroup}
        onReply={!isGroup ? chatCtrl.setReplyingTo : () => {}}
        onDelete={handleDeleteMessage}
      />
    );
  };

  if (!isGroup && chatCtrl.appMode === AppMode.LIVE_VOICE) {
    return <LiveVoice onClose={() => chatCtrl.setAppMode(AppMode.CHAT)} settings={chat.settings} userProfile={userProfile} />;
  }

  const messageFooter = (
    <>
      {isTyping && !isGroup ? (
        <div className="flex w-fit animate-pulse items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-bubble">
          <Avatar name={chat.settings.botName} gender={chat.settings.botGender} size="xs" imageUrl={chat.settings.avatarUrl} />
          <span className="text-xs text-[#667781]">typing...</span>
        </div>
      ) : null}
      <div ref={scrollRef} />
    </>
  );

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden bg-[#efeae2]"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={event => { void handleDrop(event); }}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={event => { void (isGroup ? groupCtrl.handleFile(event) : chatCtrl.handleFile(event)); }}
        className="hidden"
        accept=".png,.jpg,.jpeg,.webp,.heic,.heif,image/png,image/jpeg,image/webp,image/heic,image/heif"
        multiple
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Hidden File Inputs triggered by WhatsAppAttachmentSheet */}
      <input
        type="file"
        ref={docInputRef}
        onChange={event => {
          void (isGroup ? groupCtrl.handleFile(event) : chatCtrl.handleFile(event));
          setShowAttachSheet(false);
        }}
        className="hidden"
        accept=".pdf,.txt,.md,.csv,.tsv,application/pdf,text/*"
        multiple
        aria-hidden="true"
        tabIndex={-1}
      />
      <input
        type="file"
        ref={codeInputRef}
        onChange={event => {
          void (isGroup ? groupCtrl.handleFile(event) : chatCtrl.handleFile(event));
          setShowAttachSheet(false);
        }}
        className="hidden"
        accept=".js,.jsx,.ts,.tsx,.json,.py,.java,.go,.rs,.php,.rb,.css,.html,.sql,.sh,.yaml,.yml,.xml,text/*,application/json"
        multiple
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* WhatsApp Clean Mobile Header */}
      <div className={`z-30 flex h-[calc(60px+env(safe-area-inset-top))] shrink-0 items-center justify-between px-1 pt-[env(safe-area-inset-top)] text-white shadow-sm transition-colors duration-300 sm:px-2 ${isGroup ? 'bg-[#008069]' : getMoodColor(chat.psychology?.mood)}`}>
        {/* Contact Info Header Clickable Area */}
        <div
          role="button"
          tabIndex={0}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg py-1 transition-colors hover:bg-black/10 active:bg-black/15 focus-visible:ring-2 focus-visible:ring-white"
          onClick={() => {
            triggerHaptic('light');
            setShowContactInfoDrawer(true);
          }}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setShowContactInfoDrawer(true);
            }
          }}
        >
          <button
            type="button"
            onClick={event => {
              event.stopPropagation();
              triggerHaptic('light');
              onBack();
            }}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-white/10 active:scale-90 transition-transform md:hidden"
            aria-label="رجوع"
          >
            <ArrowRight size={20} />
          </button>

          <button
            type="button"
            onClick={event => {
              if (isGroup || !chat.settings.avatarUrl) return;
              event.stopPropagation();
              triggerHaptic('light');
              setShowProfileImage(true);
            }}
            className={`shrink-0 rounded-full ${!isGroup && chat.settings.avatarUrl ? 'cursor-zoom-in' : 'cursor-pointer'} active:scale-95 transition-transform`}
            aria-label={!isGroup && chat.settings.avatarUrl ? 'عرض صورة البروفايل' : 'معلومات الدردشة'}
          >
            <Avatar
              name={isGroup ? chat.groupName || 'مجموعة' : chat.settings.botName}
              gender={chat.settings.botGender}
              imageUrl={chat.settings.avatarUrl}
              isGroup={isGroup}
              groupMembersCount={chat.memberIds?.length}
            />
          </button>

          <div className="ms-1 flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[16px] font-semibold">
              {isGroup ? chat.groupName : chat.settings.botName}
            </span>
            {isGroup || isTyping ? (
              <span className="flex items-center gap-1 text-[12px] text-[#d1fae5] font-medium">
                {isGroup
                  ? isTyping ? `${typingGroupNames.join('، ')} يكتب…` : `${chat.memberIds?.length || 0} أعضاء`
                  : 'يكتب...'}
              </span>
            ) : (
              <span className="text-[11.5px] text-white/90">متصل الآن</span>
            )}
          </div>
        </div>

        {/* Action icons: Video, Call, More */}
        <div className="relative flex shrink-0 items-center gap-0.5">
          {!isGroup ? (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                chatCtrl.setAppMode(AppMode.LIVE_VOICE);
              }}
              className="grid h-11 w-11 place-items-center rounded-full text-white/90 hover:bg-white/10 active:scale-90 transition-transform"
              aria-label="مكالمة فيديو"
            >
              <Video size={20} />
            </button>
          ) : null}

          {!isGroup ? (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                chatCtrl.setAppMode(AppMode.LIVE_VOICE);
              }}
              className="grid h-11 w-11 place-items-center rounded-full text-white/90 hover:bg-white/10 active:scale-90 transition-transform"
              aria-label="مكالمة صوت"
            >
              <PhoneCall size={18} />
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setShowAttachSheet(false);
              setShowEmojiPicker(false);
              setShowSettingsMenu(previous => !previous);
            }}
            className="grid h-11 w-11 place-items-center rounded-full text-white/90 hover:bg-white/10 active:scale-90 transition-transform"
            aria-label="الخيارات"
            aria-expanded={showSettingsMenu}
          >
            <MoreVertical size={20} />
          </button>

          {/* Clean WhatsApp Mobile 3-Dots Dropdown */}
          {showSettingsMenu ? (
            <div
              className="absolute left-0 top-12 z-50 w-56 overflow-hidden rounded-xl bg-white py-1.5 text-[#111b21] shadow-2xl ring-1 ring-black/10 animate-in fade-in zoom-in-95 duration-150"
              dir="rtl"
            >
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setShowSettingsMenu(false);
                  setShowContactInfoDrawer(true);
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#f0f2f5] active:bg-[#e9edef]"
              >
                <Info size={17} className="text-[#54656f]" />
                معلومات جهة الاتصال
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setShowSettingsMenu(false);
                  setShowContactInfoDrawer(true);
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#f0f2f5] active:bg-[#e9edef]"
              >
                <Cpu size={17} className="text-[#008069]" />
                إعدادات الذكاء الاصطناعي والموديل
              </button>

              {!isGroup ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setShowSettingsMenu(false);
                      chatCtrl.setAppMode(AppMode.STUDIO);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#f0f2f5] active:bg-[#e9edef]"
                  >
                    <Palette size={17} className="text-[#7c3aed]" />
                    استوديو توليد الصور
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setShowSettingsMenu(false);
                      setShowSkillsModal(true);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#f0f2f5] active:bg-[#e9edef]"
                  >
                    <Sparkles size={17} className="text-amber-500" />
                    شطارات ومهارات رفيق
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setShowSettingsMenu(false);
                      setShowRandomPrompts(true);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#f0f2f5] active:bg-[#e9edef]"
                  >
                    <Zap size={17} className="text-amber-600" />
                    ردود ومحفزات سريعة
                  </button>
                </>
              ) : null}

              <button
                type="button"
                disabled={isExporting}
                onClick={() => {
                  triggerHaptic('light');
                  void handleExportChat();
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#f0f2f5] active:bg-[#e9edef] disabled:opacity-50"
              >
                {isExporting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#54656f] border-t-transparent" />
                ) : (
                  <Download size={17} className="text-[#54656f]" />
                )}
                <span>{isExporting ? 'جاري التصدير...' : 'تصدير المحادثة'}</span>
              </button>

              <div className="my-1 border-t border-gray-100" />

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('warning');
                  setShowSettingsMenu(false);
                  onDelete();
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 active:bg-red-100"
              >
                <Trash2 size={17} />
                حذف الدردشة
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {!isGroup && chatCtrl.appMode === AppMode.STUDIO ? (
        <main className="flex-1 overflow-y-auto bg-[#f7f5f1] px-4 py-5 sm:px-8" dir="rtl">
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center">
            <button type="button" onClick={() => chatCtrl.setAppMode(AppMode.CHAT)} className="mb-4 flex h-11 w-fit items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-[#3b4a54] shadow-sm hover:bg-[#f0f2f5]">
              <ArrowRight size={18} />
              رجوع للمحادثة
            </button>
            <section className="rounded-2xl bg-white p-5 shadow-xl ring-1 ring-black/5 sm:p-7">
              <div className="mb-5 flex items-start gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#f3e8ff] text-[#7c3aed]"><WandSparkles size={24} /></div>
                <div className="min-w-0">
                  <h1 className="text-2xl font-extrabold text-[#111b21]">Studio توليد الصور</h1>
                  <p className="mt-1 text-sm leading-6 text-[#54656f]">اكتب وصف الصورة، اختار المقاس والأسلوب، والنتيجة هتنزل في المحادثة كصورة.</p>
                </div>
              </div>
              <label className="mb-2 block text-sm font-bold text-[#111b21]" htmlFor="studio-prompt">وصف الصورة</label>
              <textarea
                id="studio-prompt"
                value={studioPrompt}
                onChange={event => setStudioPrompt(event.target.value)}
                onKeyDown={event => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') submitStudioPrompt();
                }}
                className="min-h-36 w-full resize-y rounded-2xl border border-[#d1d7db] bg-[#fbfbfb] px-4 py-3 text-[15px] leading-7 text-[#111b21] outline-none placeholder:text-[#667781] focus:border-[#008069] focus:ring-2 focus:ring-[#008069]/20"
                placeholder="مثال: بورتريه سينمائي لشخصية عربية في شارع مطري بإضاءة ناعمة"
                dir="auto"
              />
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#54656f]">نسبة العرض</span>
                  <select value={chatCtrl.studioConfig.aspectRatio} onChange={event => updateStudioConfig({ aspectRatio: event.target.value as typeof chatCtrl.studioConfig.aspectRatio })} className="h-11 w-full rounded-xl border border-[#d1d7db] bg-white px-3 text-sm outline-none focus:border-[#008069]">
                    {STUDIO_ASPECT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#54656f]">الحجم</span>
                  <select value={chatCtrl.studioConfig.size} onChange={event => updateStudioConfig({ size: event.target.value as typeof chatCtrl.studioConfig.size })} className="h-11 w-full rounded-xl border border-[#d1d7db] bg-white px-3 text-sm outline-none focus:border-[#008069]">
                    {STUDIO_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#54656f]">الأسلوب</span>
                  <select value={chatCtrl.studioConfig.style} onChange={event => updateStudioConfig({ style: event.target.value as typeof chatCtrl.studioConfig.style })} className="h-11 w-full rounded-xl border border-[#d1d7db] bg-white px-3 text-sm outline-none focus:border-[#008069]">
                    {STUDIO_STYLE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={submitStudioPrompt} disabled={!studioPrompt.trim() || chatCtrl.isTyping} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[#008069] px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-[#006c58] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1">
                  <WandSparkles size={18} />
                  {chatCtrl.isTyping ? 'جاري التوليد...' : 'توليد الصورة'}
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-12 items-center justify-center gap-2 rounded-full border border-[#d1d7db] bg-white px-5 text-sm font-bold text-[#3b4a54] hover:bg-[#f0f2f5]">
                  <Paperclip size={18} />
                  صورة مرجعية
                </button>
              </div>
            </section>
          </div>
        </main>
      ) : (
        <>
          {isDraggingFiles ? (
            <div className="pointer-events-none absolute inset-x-4 bottom-24 top-20 z-40 grid place-items-center rounded-xl border-2 border-dashed border-[#008069] bg-white/80 text-[#008069] shadow-2xl backdrop-blur-sm">
              <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold shadow">
                <Paperclip size={18} />
                أفلت الملفات هنا
              </div>
            </div>
          ) : null}
          <PagedMessageList
            messages={visibleMessages}
            renderMessage={renderMessage}
            className="flex-1 space-y-1.5 px-2 py-3 sm:px-8 sm:py-5 wa-doodle-bg momentum-scroll"
            ariaLabel={isGroup ? 'رسائل المجموعة' : `الرسائل مع ${chat.settings.botName}`}
            footer={messageFooter}
          />
        </>
      )}

      {!isGroup && chatCtrl.appMode === AppMode.STUDIO ? null : (
        <div className="relative z-20 max-w-full overflow-visible px-2 py-1.5 pb-[max(8px,env(safe-area-inset-bottom))] bg-transparent" dir="rtl">
          {isGroup && groupCtrl.initializationError ? (
            <div role="alert" className="mx-1 mb-2 flex items-center justify-between gap-3 rounded-xl border border-red-400/30 bg-red-950/40 px-3 py-2 text-sm text-red-100 md:bg-red-50 md:text-red-800">
              <span>{groupCtrl.initializationError}</span>
              <button type="button" onClick={groupCtrl.retryInitialization} className="shrink-0 rounded-lg border border-current px-3 py-1 font-semibold hover:bg-red-500/10">إعادة المحاولة</button>
            </div>
          ) : null}

          {!isGroup && chatCtrl.replyingTo ? (
            <div className="mx-1 mb-1.5 flex min-w-0 items-center gap-2 rounded-xl border-s-4 border-[#008069] bg-white px-3 py-2 shadow-xs">
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="truncate text-[11px] font-bold leading-tight text-[#008069]">{chatCtrl.replyingTo.role === MessageRole.USER ? 'أنت' : chat.settings.botName}</p>
                <p className="line-clamp-2 text-[11px] leading-tight text-gray-500">{chatCtrl.replyingTo.text}</p>
              </div>
              <button
                type="button"
                onClick={() => chatCtrl.setReplyingTo(null)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:scale-90 transition-transform"
                aria-label="إلغاء الرد"
              >
                <X size={15} />
              </button>
            </div>
          ) : null}

          {!isGroup && chatCtrl.appMode === AppMode.SLOW_BURN_STORY ? (
            <div className="mx-1 mb-1.5 flex items-center justify-between rounded-xl border border-teal-200 bg-teal-50/90 px-3 py-1.5 text-xs text-teal-900 shadow-xs">
              <div className="flex min-w-0 items-center gap-2">
                <BookOpen size={14} className="text-teal-700 shrink-0" />
                <span className="truncate font-medium">وضع السرد المتأني (Slow Burn) مفعّل</span>
              </div>
              <button
                type="button"
                onClick={() => chatCtrl.setAppMode(AppMode.CHAT)}
                className="shrink-0 rounded-lg bg-white px-2 py-0.5 text-[11px] font-bold text-teal-800 shadow-2xs hover:bg-teal-100"
              >
                إلغاء ✕
              </button>
            </div>
          ) : null}

          {!isGroup && chatCtrl.activeStory && chatCtrl.activeStory.status === 'active' ? (
            <div className="mx-1 mb-1.5 flex items-center justify-between rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-1.5 text-xs text-amber-900 shadow-xs">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-[11px] font-bold">📖</span>
                <div className="min-w-0 truncate">
                  <span className="font-semibold">{chatCtrl.activeStory.title}</span>
                  <span className="ms-1.5 text-amber-700 font-mono text-[11px]">(الجزء {chatCtrl.activeStory.currentChapter})</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void chatCtrl.continueStory('كمل')}
                  className="rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-amber-700"
                >
                  كمل ⏩
                </button>
                <button
                  type="button"
                  onClick={() => void chatCtrl.clearActiveStory()}
                  className="rounded-lg p-1 text-amber-700 hover:bg-amber-200/60"
                  aria-label="إنهاء القصة"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ) : null}

          {/* Clean WhatsApp Mobile Input Row */}
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            {isRecording ? (
              <div className="flex min-h-[48px] flex-1 items-center rounded-full bg-white px-4 py-2 shadow-sm border border-black/5">
                <div className="ms-1 me-3 h-3 w-3 animate-ping rounded-full bg-red-500" />
                <span className="flex-1 font-mono text-sm text-[#111b21]">{formatTime(recordingTime)}</span>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('warning');
                    stopRecording(false);
                  }}
                  className="me-2 rounded-full p-2 text-red-500 hover:bg-red-50 active:scale-90 transition-transform"
                  aria-label="إلغاء التسجيل"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ) : (
              <div className="flex min-h-[48px] min-w-0 flex-1 items-center rounded-full bg-white px-2 shadow-sm border border-black/5">
                {/* Emoji toggle */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowAttachSheet(false);
                    setShowEmojiPicker(prev => !prev);
                  }}
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#54656f] hover:bg-gray-100 active:scale-90 transition-transform ${showEmojiPicker ? 'text-[#008069]' : ''}`}
                  aria-label="إيموجي"
                >
                  <ComposerEmojiIcon className="h-6 w-6" />
                </button>

                {/* Text input */}
                <input
                  ref={messageInputRef}
                  className="min-w-0 flex-1 border-none bg-transparent px-2 py-2 text-[16px] leading-6 text-[#111b21] outline-none placeholder:text-[#8696a0]"
                  placeholder={
                    !isGroup && chatCtrl.appMode === AppMode.SLOW_BURN_STORY
                      ? 'اطلب حكاية أو أرسل فكرة...'
                      : isGroup
                      ? 'رسالة للمجموعة'
                      : 'رسالة'
                  }
                  value={input}
                  onChange={event => setInput(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') submitMessage();
                  }}
                  disabled={isGroup && !groupCtrl.isReady}
                  dir="auto"
                />

                {/* Attachments inside composer if any */}
                <ComposerAttachmentTray
                  uploads={isGroup ? groupCtrl.attachmentUploads : chatCtrl.attachmentUploads}
                  attachments={isGroup ? groupCtrl.composerAttachments : chatCtrl.composerAttachments}
                  onCancelUpload={isGroup ? groupCtrl.cancelAttachmentUpload : chatCtrl.cancelAttachmentUpload}
                  onRemoveAttachment={isGroup ? groupCtrl.removeComposerAttachment : chatCtrl.removeComposerAttachment}
                />

                {/* Paperclip attachment button */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowSettingsMenu(false);
                    setShowEmojiPicker(false);
                    setShowAttachSheet(prev => !prev);
                  }}
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#54656f] hover:bg-gray-100 active:scale-90 transition-transform ${showAttachSheet ? 'text-[#008069]' : ''}`}
                  aria-label="إرفاق ملف"
                >
                  <ComposerAttachmentIcon className="h-[22px] w-[22px]" />
                </button>

                {/* Camera button (when input is empty) */}
                {!input.trim() && !isGroup ? (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setShowAttachSheet(false);
                      fileInputRef.current?.click();
                    }}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#54656f] hover:bg-gray-100 active:scale-90 transition-transform"
                    aria-label="كاميرا"
                  >
                    <ComposerCameraIcon className="h-[22px] w-[22px]" />
                  </button>
                ) : null}
              </div>
            )}

            {/* Circular Send / Mic Button */}
            {(input.trim() || (isGroup ? groupCtrl.attachments.length : chatCtrl.attachments.length)) && !isRecording ? (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('success');
                  submitMessage();
                }}
                disabled={isGroup && !groupCtrl.isReady}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#00a884] text-white shadow-md active:scale-90 transition-transform hover:bg-[#06cf9c] disabled:opacity-50"
                aria-label="إرسال"
              >
                <Send size={22} strokeWidth={2.5} className="rtl:rotate-180" />
              </button>
            ) : isRecording ? (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('success');
                  setShowEmojiPicker(false);
                  stopRecording(true);
                }}
                className="grid h-12 w-12 shrink-0 animate-pulse place-items-center rounded-full bg-[#00a884] text-white shadow-md active:scale-90 transition-transform"
                aria-label="إرسال التسجيل"
              >
                <Send size={22} strokeWidth={2.5} className="rtl:rotate-180" />
              </button>
            ) : isGroup ? (
              <button
                type="button"
                disabled
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#00a884] text-white opacity-40 shadow-sm"
                aria-label="اكتب رسالة"
              >
                <Send size={22} strokeWidth={2.5} className="rtl:rotate-180" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  void startRecording();
                }}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#00a884] text-white shadow-md active:scale-90 transition-transform hover:bg-[#06cf9c]"
                aria-label="تسجيل صوت"
              >
                <ComposerMicIcon className="h-6 w-6" />
              </button>
            )}
          </div>

          {/* Quick slash commands hints */}
          {input.startsWith('/') && input.length < 15 ? (
            <div className="absolute bottom-full start-4 z-50 mb-2 flex w-64 flex-col gap-1 rounded-2xl bg-white p-2 text-xs shadow-2xl ring-1 ring-black/10 animate-in slide-in-from-bottom-2" dir="rtl">
              <div className="px-2 py-1 font-bold text-[#667781] text-[11px] flex items-center gap-1.5">
                <Sparkles size={12} className="text-[#008069]" />
                أوامر شطارات رفيق السريعة:
              </div>
              <button
                type="button"
                onClick={() => {
                  setInput('/coach ');
                  messageInputRef.current?.focus();
                }}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[#f0f2f5] text-start"
              >
                <span className="font-mono font-bold text-[#008069]">/coach</span>
                <span className="text-[#111b21]">كوتش الجيم والدايت البلدي 💪</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setInput('/vent ');
                  messageInputRef.current?.focus();
                }}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[#f0f2f5] text-start"
              >
                <span className="font-mono font-bold text-[#008069]">/vent</span>
                <span className="text-[#111b21]">فضفضة 3 الفجر واحتواء دافئ 🌙</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setInput('/spots ');
                  messageInputRef.current?.focus();
                }}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[#f0f2f5] text-start"
              >
                <span className="font-mono font-bold text-[#008069]">/spots</span>
                <span className="text-[#111b21]">دليل الفسح والكافيهات ☕</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setInput('');
                  setShowSkillsModal(true);
                }}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 border-t border-[#f0f2f5] text-[#008069] font-medium hover:bg-[#e7f7ef]"
              >
                <Sparkles size={13} />
                فتح متجر الشطارات (Skills Hub)...
              </button>
            </div>
          ) : null}

          {/* Emoji Picker Popup */}
          {showEmojiPicker ? (
            <div className="absolute bottom-full end-2 z-50 mb-2 grid w-[min(292px,calc(100vw-48px))] animate-in grid-cols-6 gap-1 rounded-2xl bg-white p-2 shadow-2xl ring-1 ring-black/10 slide-in-from-bottom-2" dir="ltr">
              {EMOJI_OPTIONS.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  className="grid h-10 w-10 place-items-center rounded-xl text-xl transition-colors hover:bg-[#f0f2f5] focus:bg-[#e7f7ef] focus:outline-none"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* Profile Image Viewer */}
      <ProfileImageViewer
        open={showProfileImage}
        imageUrl={chat.settings.avatarUrl}
        alt={chat.settings.botName}
        onClose={() => setShowProfileImage(false)}
      />

      {/* WhatsApp Attachment Sheet */}
      <WhatsAppAttachmentSheet
        open={showAttachSheet}
        onClose={() => setShowAttachSheet(false)}
        onSelectDocument={() => docInputRef.current?.click()}
        onSelectCamera={() => fileInputRef.current?.click()}
        onSelectGallery={() => fileInputRef.current?.click()}
        onSelectAudio={() => docInputRef.current?.click()}
        onSelectStudio={() => chatCtrl.setAppMode(AppMode.STUDIO)}
        onSelectQuickPrompts={() => setShowRandomPrompts(true)}
        onSelectCode={() => codeInputRef.current?.click()}
        onSelectImportChat={() => chatExportInputRef.current?.click()}
      />

      {/* WhatsApp Contact Info Drawer */}
      <WhatsAppContactInfoDrawer
        chat={chat}
        isOpen={showContactInfoDrawer}
        onClose={() => setShowContactInfoDrawer(false)}
        selectedModel={chatCtrl.selectedModel}
        onSelectModel={chatCtrl.setSelectedModel}
        selectedThinkingLevel={chatCtrl.selectedThinkingLevel}
        onSelectThinkingLevel={chatCtrl.setSelectedThinkingLevel}
        onEditChat={() => {
          setShowContactInfoDrawer(false);
          onInfo();
        }}
        onDeleteChat={() => {
          setShowContactInfoDrawer(false);
          onDelete();
        }}
        onExportChat={() => {
          void handleExportChat();
        }}
        isExporting={isExporting}
        onOpenSkillsHub={() => {
          setShowContactInfoDrawer(false);
          setShowSkillsModal(true);
        }}
        onOpenStudio={() => {
          setShowContactInfoDrawer(false);
          chatCtrl.setAppMode(AppMode.STUDIO);
        }}
        onStartAudioCall={() => {
          setShowContactInfoDrawer(false);
          chatCtrl.setAppMode(AppMode.LIVE_VOICE);
        }}
        onStartVideoCall={() => {
          setShowContactInfoDrawer(false);
          chatCtrl.setAppMode(AppMode.LIVE_VOICE);
        }}
        isSlowBurnActive={chatCtrl.appMode === AppMode.SLOW_BURN_STORY}
        onToggleSlowBurn={() => {
          chatCtrl.setAppMode(
            chatCtrl.appMode === AppMode.SLOW_BURN_STORY ? AppMode.CHAT : AppMode.SLOW_BURN_STORY
          );
        }}
        onViewAvatar={() => {
          setShowContactInfoDrawer(false);
          setShowProfileImage(true);
        }}
      />

      <RandomPromptsSettings open={showRandomPrompts} onClose={() => setShowRandomPrompts(false)} />
      <SkillsHubModal
        isOpen={showSkillsModal}
        onClose={() => setShowSkillsModal(false)}
        onSelectSlashCommand={(cmd) => {
          setInput(cmd + ' ');
          messageInputRef.current?.focus();
        }}
      />
    </div>
  );
};

export default ChatInterface;
