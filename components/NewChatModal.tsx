
import React, { useEffect, useState, useRef } from 'react';
import { X, Check, User, Layers, Upload, FileText, Loader2, Sparkle, Cpu, Sliders, PlayCircle, Mic2, MessageSquare, Wand2, ArrowLeft, Download, AlertCircle, BrainCircuit, RotateCcw } from 'lucide-react';
import { BotSettings, ChatSession, SoulTraits, Dialect, ChatStatistics, SynthesisProgress, SoulSynthesisResult, type SoulMemorySeed } from '../types.js';
import Avatar from './Avatar.js';
import ProfileImageViewer from './ProfileImageViewer.js';
import { fileToGenAIInlineData, generateBioFromTraits, generateProfileAvatar } from '../services/geminiService.js';
import { generateVisualSeed } from '../services/visualEngine.js';
import { eventBus } from '../services/eventBus.js';
import { getCloneRequestErrorMessage, getParticipantsFromChat, synthesizeSoulFromChat } from '../services/soulSynthesizer.js';
import { SOUL_ARCHETYPES, describeTraitProfile, getSoulById } from '../services/soulRegistry.js';
import { VISIBLE_CHAT_MODELS, ChatThinkingLevelId, DEFAULT_CHAT_MODEL, DEFAULT_THINKING_LEVEL, THINKING_LEVELS, resolveThinkingLevel, resolveChatModel } from '../services/geminiModels.js';
import { createAdaptivePersonalityState, type AdaptivePersonalityMutation } from '../services/livingPersonaCore.js';
import CloneAnalysisStatus from './CloneAnalysisStatus.js';
import CloneAnalysisEditor, { type EditableCloneProfile } from './CloneAnalysisEditor.js';

interface NewChatModalProps {
  onClose: () => void;
  onCreate: (settings: BotSettings | null, groupData?: { name: string, members: string[], bio?: string }) => Promise<string> | any;
  onCreateClone?: (settings: BotSettings, seeds: SoulMemorySeed[]) => Promise<string>;
  onStartProgressiveClone?: (fileContent: string, targetName: string) => Promise<string>;
  onEdit?: (
    chatId: string,
    settings: BotSettings | null,
    groupData?: { name: string, members: string[], bio?: string },
    adaptiveMutation?: AdaptivePersonalityMutation,
  ) => Promise<void> | void;
  availableBots?: ChatSession[];
  chatToEdit?: ChatSession;
}

const NewChatModal: React.FC<NewChatModalProps> = ({ onClose, onCreate, onCreateClone, onStartProgressiveClone, onEdit, availableBots, chatToEdit }) => {
  const isEditMode = !!chatToEdit;
  const [mode, setMode] = useState<'single' | 'group' | 'import'>(isEditMode && chatToEdit.isGroup ? 'group' : 'single');
  const [isGeneratingBio, setIsGeneratingBio] = useState(false);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showProfileImage, setShowProfileImage] = useState(false);
  
  // Basic Identity
  const [name, setName] = useState(chatToEdit?.settings.botName || '');
  const [gender, setGender] = useState<'male' | 'female'>(chatToEdit?.settings.botGender || 'female');
  const [age, setAge] = useState(chatToEdit?.settings.botAge?.toString() || '24');
  const [bio, setBio] = useState(chatToEdit?.settings.botBio || '');
  const [uploadedAvatar, setUploadedAvatar] = useState<string | undefined>(chatToEdit?.settings.avatarUrl);
  const [visualSeed] = useState(() => chatToEdit?.settings.visualSeed || generateVisualSeed());
  
  // Soul & Traits
  const [selectedSoulId, setSelectedSoulId] = useState<string>(chatToEdit?.settings.soulId || 'amira_default');
  const [traits, setTraits] = useState<SoulTraits>(chatToEdit?.settings.soulTraits || SOUL_ARCHETYPES[0].baseTraits);
  const [adaptivePersonality, setAdaptivePersonality] = useState(() => (
    chatToEdit?.settings.adaptivePersonality || createAdaptivePersonalityState()
  ));
  const [adaptiveMutation, setAdaptiveMutation] = useState<AdaptivePersonalityMutation | undefined>();
  const [activeTab, setActiveTab] = useState<'identity' | 'soul' | 'voice' | 'clone_analysis'>('identity');
  const [cloneProfileDraft, setCloneProfileDraft] = useState<EditableCloneProfile | undefined>(
    () => chatToEdit?.settings.cloneProfile,
  );
  const [cloneProfileDirty, setCloneProfileDirty] = useState(false);
  const [cloneProfileError, setCloneProfileError] = useState('');

  // Voice & Dialect
  const [dialect, setDialect] = useState<Dialect>(chatToEdit?.settings.dialect || Dialect.CAIRO_MODERN);
  const [voicePitch, setVoicePitch] = useState(chatToEdit?.settings.voiceConfig?.pitch || 1.0);
  const [voiceSpeed, setVoiceSpeed] = useState(chatToEdit?.settings.voiceConfig?.speed || 1.0);

  // Model
  const [selectedModel, setSelectedModel] = useState<string>(chatToEdit?.settings.model ? resolveChatModel(chatToEdit.settings.model) : DEFAULT_CHAT_MODEL);
  const [selectedThinkingLevel, setSelectedThinkingLevel] = useState<ChatThinkingLevelId>(resolveThinkingLevel(chatToEdit?.settings.thinkingLevel || DEFAULT_THINKING_LEVEL));
  const [boostRafiq, setBoostRafiq] = useState<boolean>(chatToEdit?.settings.boostRafiq || false);
  const soulProfile = describeTraitProfile(traits);
  const selectedSoul = getSoulById(selectedSoulId) || SOUL_ARCHETYPES[0];

  // Group State
  const [groupName, setGroupName] = useState(chatToEdit?.groupName || '');
  const [groupBio, setGroupBio] = useState(chatToEdit?.settings.botBio || '');
  const [selectedBots, setSelectedBots] = useState<string[]>(chatToEdit?.memberIds || []);

  // Import Wizard State
  const [importStep, setImportStep] = useState<'upload' | 'participant' | 'analyzing' | 'preview'>('upload');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importFileContent, setImportFileContent] = useState<string>('');
  const [importStatistics, setImportStatistics] = useState<ChatStatistics | null>(null);
  const [importTargetName, setImportTargetName] = useState<string>('');
  const [importProgress, setImportProgress] = useState<SynthesisProgress>({ stage: 'parsing', progress: 0, message: '' });
  const [importResult, setImportResult] = useState<SoulSynthesisResult | null>(null);
  const [importError, setImportError] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const existingBots = availableBots?.filter(b => !b.isGroup && b.id !== chatToEdit?.id) || [];
  const selectedBotIds = new Set(selectedBots);
  const selectedBotCount = selectedBotIds.size;

  useEffect(() => {
    if (!cloneProfileDirty) {
      setCloneProfileDraft(chatToEdit?.settings.cloneProfile);
    }
  }, [chatToEdit?.settings.cloneProfile, cloneProfileDirty]);

  const handleCloneProfileChange = (nextProfile: EditableCloneProfile) => {
    if (nextProfile.analysis?.status !== 'ready') return;
    setCloneProfileDraft(nextProfile);
    setCloneProfileDirty(true);
    setCloneProfileError('');
    setBio(nextProfile.richBio || '');
  };

  const formatCloneSpeechStyle = (profile?: EditableCloneProfile): string | undefined => {
    if (!profile?.speechStyle) return chatToEdit?.settings.impersonationProfile;
    const style = profile.speechStyle;
    return [
      style.toneSummary,
      style.signaturePhrases.length > 0 ? `عبارات مميزة: ${style.signaturePhrases.filter(Boolean).join('، ')}` : '',
      style.responsePatterns.length > 0 ? `أنماط الرد: ${style.responsePatterns.filter(Boolean).join('، ')}` : '',
      style.emojiPatterns.length > 0 ? `استخدام الإيموجي: ${style.emojiPatterns.filter(Boolean).join('، ')}` : '',
    ].filter(Boolean).join('\n') || undefined;
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      const { mimeType, data } = await fileToGenAIInlineData(file);
      // Save as pure base64 data URI to persist in IndexedDB
      setUploadedAvatar(`data:${mimeType};base64,${data}`);
    }
  };

  const handleGenerateAvatar = async () => {
      if (!bio && !name) {
          eventBus.emit('ui:toast', { message: 'اكتب اسم أو نبذة عشان أتخيل الشكل!', type: 'warning' });
          return;
      }
      setIsGeneratingAvatar(true);
      try {
          // This calls avatarEngine.generateRealisticAvatar via geminiService
          // It now uses the unrestricted creative prompt
          const url = await generateProfileAvatar(name, gender, parseInt(age), bio, visualSeed);
          if (url) {
              setUploadedAvatar(url); // url is a data:image/png;base64 string
              eventBus.emit('ui:toast', { message: 'تم توليد الصورة بنجاح!', type: 'success' });
          } else {
              eventBus.emit('ui:toast', { message: 'لم أتمكن من توليد صورة.', type: 'error' });
          }
      } catch (e) {
          eventBus.emit('ui:toast', { message: 'حدث خطأ في التوليد', type: 'error' });
      } finally {
          setIsGeneratingAvatar(false);
      }
  };

  const handleGenerateBio = async () => {
      setIsGeneratingBio(true);
      try {
          const targetName = name.trim() || 'الشخصية';
          const effectiveAge = parseInt(age) || 24;
          const generatedBio = await generateBioFromTraits(targetName, gender, effectiveAge, traits, selectedSoulId);
          setBio(generatedBio);
          if (generatedBio) {
              eventBus.emit('ui:toast', { message: 'تم تأليف القصة بنجاح!', type: 'success' });
          }
      } catch (e) {
          console.error("Bio generation error", e);
          eventBus.emit('ui:toast', { message: 'حدث خطأ في التوليد', type: 'error' });
      } finally {
          setIsGeneratingBio(false);
      }
  };

  const handleSoulSelect = (soulId: string) => {
      const soul = getSoulById(soulId);
      if (!soul) return;
      setSelectedSoulId(soulId);
      setTraits(soul.baseTraits);
  };

  const handleResetAdaptation = () => {
      if (!window.confirm('تمسح أسلوب التواصل اللي الشخصية اتعلمته؟ الهوية والذكريات مش هيتغيروا.')) return;
      setAdaptivePersonality(previous => ({
        ...createAdaptivePersonalityState(previous.enabled),
        version: previous.version + 1,
        processedMessageIds: previous.processedMessageIds,
        lastObservedUserAt: previous.lastObservedUserAt,
        currentSessionKey: previous.currentSessionKey,
        observeAfter: new Date(),
      }));
      setAdaptiveMutation(previous => ({
        type: 'reset',
        enabled: previous?.enabled ?? adaptivePersonality.enabled,
      }));
      eventBus.emit('ui:toast', { message: 'إعادة الضبط هتتطبق لما تحفظ التعديلات', type: 'info' });
  };

  const handleToggleAdaptation = () => {
      const enabled = !adaptivePersonality.enabled;
      setAdaptivePersonality(previous => ({
          ...previous,
          enabled,
          version: previous.version + 1,
          ...(enabled ? { observeAfter: new Date() } : {}),
      }));
      setAdaptiveMutation(previous => previous?.type === 'reset'
        ? { ...previous, enabled }
        : { type: 'set_enabled', enabled });
  };

  // --- IMPORT HANDLERS ---

  const detectImportParticipants = async (text: string) => {
    setIsImporting(true);
    setImportError('');
    try {
      const stats = await getParticipantsFromChat(text);
      setImportStatistics(stats);
      if (stats.participants.length === 0) {
        setImportError('مقدرش اقرا اي رسائل. تأكد ان الملف من Export Chat في واتساب');
        return;
      }
      setImportTargetName('');
      setImportStep('participant');
    } catch (error) {
      setImportError(getCloneRequestErrorMessage(error, 'participants'));
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportFileSelect = async (file: File) => {
    setImportError('');
    if (!file.name.endsWith('.txt')) {
      setImportError('الملف لازم يكون .txt (من Export Chat في واتساب)');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setImportError('الملف كبير اوي (الحد الاقصى 20MB)');
      return;
    }
    setImportFile(file);
    try {
      const text = await file.text();
      setImportFileContent(text);
      await detectImportParticipants(text);
    } catch (e) {
      setIsImporting(false);
      setImportError(getCloneRequestErrorMessage(e, 'participants'));
    }
  };

  const handleImportFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImportFileSelect(file);
  };

  const handleStartAnalysis = async () => {
    if (!importFileContent || !importTargetName) return;
    setImportStep('analyzing');
    setImportError('');
    setIsImporting(true);
    
    try {
      if (onStartProgressiveClone) {
        setImportProgress({
          stage: 'synthesis',
          progress: 0,
          message: 'بنحلل أول جزء موثوق عشان تقدر تبدأ الشات، والباقي هيكمل في الخلفية…',
        });
        await onStartProgressiveClone(importFileContent, importTargetName);
        return;
      }

      const result = await synthesizeSoulFromChat(
        importFileContent,
        importTargetName,
        (progress) => setImportProgress(progress)
      );
      setImportResult(result);
      
      // Pre-fill the edit fields from the result
      setName(result.settings.botName);
      setGender(result.settings.botGender);
      setAge(String(result.settings.botAge || 24));
      setBio(result.settings.botBio || '');
      setTraits(result.settings.soulTraits || { chaos: 50, empathy: 50, slang: 50, intellect: 50, positivity: 50 });
      setSelectedSoulId(result.settings.soulId || 'custom_clone');
      if (result.settings.dialect) setDialect(result.settings.dialect);
      
      setImportStep('preview');
    } catch (e) {
      setImportError(getCloneRequestErrorMessage(e, 'analysis'));
      setImportStep('participant');
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportCreate = async () => {
    if (!importResult || isSaving) return;
    setIsSaving(true);
    try {
    
    // Build settings from the (possibly edited) state
    const settings: BotSettings = {
      ...importResult.settings,
      botName: name,
      botGender: gender,
      botAge: parseInt(age) || 24,
      botBio: bio,
      avatarUrl: uploadedAvatar,
      chattiness: importResult.settings.chattiness || 'balanced',
      fragmentedMessages: importResult.settings.fragmentedMessages ?? true,
      impersonationProfile: importResult.settings.impersonationProfile,
      soulId: selectedSoulId,
      soulTraits: traits,
      adaptivePersonality,
      model: importResult.settings.model || 'gemini-3.1-pro-preview',
      thinkingLevel: 'medium',
      boostRafiq: true,
      visualSeed,
      dialect: dialect,
      voiceConfig: importResult.settings.voiceConfig || { pitch: 1.0, speed: 1.0, tone: 'energetic' },
      relationshipWithUser: importResult.settings.relationshipWithUser,
    };
    
    if (!onCreateClone) {
      throw new Error('إنشاء الشخصية المستنسخة غير متاح حاليًا. حدّث الصفحة وجرّب تاني.');
    }
    await onCreateClone(settings, importResult.memorySeeds);
    } catch (error) {
      eventBus.emitError('NewChatModal', error, 'IMPORTED_CHAT_SAVE_FAILED');
      eventBus.emit('ui:toast', {
        message: error instanceof Error ? error.message : 'مقدرناش نحفظ الشخصية المستنسخة.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getStageEmoji = (stage: string) => {
    const emojis: Record<string, string> = {
      parsing: '📖', participants: '🎯', linguistic: '🗣️',
      psychological: '🧠', synthesis: '🧬', creating: '✨',
      done: '🎉', error: '⚠️'
    };
    return emojis[stage] || '⚙️';
  };

  const handleSave = async () => {
    if (isSaving) return;
    if (mode === 'single' && !name.trim()) return;
    if (mode === 'group' && (!groupName.trim() || selectedBotCount < 2)) return;

    let savedCloneProfile = cloneProfileDraft || chatToEdit?.settings.cloneProfile;
    if (savedCloneProfile?.analysis?.status === 'ready') {
      const invalidTimelineEvent = savedCloneProfile.timeline?.find(event => (
        (event.title.trim() && !event.details.trim()) || (!event.title.trim() && event.details.trim())
      ));
      if (invalidTimelineEvent) {
        setCloneProfileError('كمّل عنوان وتفاصيل الحدث، أو امسح الحدث الفاضي قبل الحفظ.');
        setActiveTab('clone_analysis');
        return;
      }
      if (savedCloneProfile.speechStyle && !savedCloneProfile.speechStyle.toneSummary.trim()) {
        setCloneProfileError('اكتب وصف واضح لنبرة الكلام قبل الحفظ.');
        setActiveTab('clone_analysis');
        return;
      }

      const editableProfile = savedCloneProfile as EditableCloneProfile;
      savedCloneProfile = {
        ...editableProfile,
        richBio: editableProfile.richBio?.trim(),
        timeline: editableProfile.timeline
          ?.filter(event => event.title.trim() && event.details.trim())
          .map(event => ({ ...event, title: event.title.trim(), details: event.details.trim() })),
        chatSnippets: editableProfile.chatSnippets
          ?.filter(snippet => snippet.text.trim())
          .map(snippet => ({ ...snippet, text: snippet.text.trim() })),
        speechStyle: editableProfile.speechStyle ? {
          ...editableProfile.speechStyle,
          toneSummary: editableProfile.speechStyle.toneSummary.trim(),
          signaturePhrases: editableProfile.speechStyle.signaturePhrases.map(value => value.trim()).filter(Boolean),
          responsePatterns: editableProfile.speechStyle.responsePatterns.map(value => value.trim()).filter(Boolean),
          emojiPatterns: editableProfile.speechStyle.emojiPatterns.map(value => value.trim()).filter(Boolean),
        } : undefined,
        memorySeeds: editableProfile.memorySeeds
          ?.filter(memory => memory.text.trim())
          .map(memory => ({ ...memory, text: memory.text.trim() })),
      };
    }

    const settings: BotSettings = {
        ...(chatToEdit?.settings || {}),
        botName: name,
        botGender: gender,
        botAge: parseInt(age) || 24,
        botBio: savedCloneProfile?.analysis?.status === 'ready' ? savedCloneProfile.richBio || '' : bio,
        avatarUrl: uploadedAvatar, // This is the Base64 string
        chattiness: 'balanced', 
        fragmentedMessages: true,
        soulId: selectedSoulId,
        soulTraits: traits,
        adaptivePersonality,
        model: selectedModel,
        thinkingLevel: selectedThinkingLevel,
        boostRafiq,
        visualSeed,
        dialect: dialect,
        voiceConfig: {
            pitch: voicePitch,
            speed: voiceSpeed,
            tone: 'energetic'
        },
        cloneProfile: savedCloneProfile,
        impersonationProfile: formatCloneSpeechStyle(savedCloneProfile),
    };

    setIsSaving(true);
    try {
      if (isEditMode && chatToEdit && onEdit) {
          if (mode === 'single') await onEdit(chatToEdit.id, settings, undefined, adaptiveMutation);
          else await onEdit(chatToEdit.id, null, { name: groupName, members: selectedBots, bio: groupBio });
      } else {
          if (mode === 'single') await onCreate(settings);
          else await onCreate(null, { name: groupName, members: selectedBots, bio: groupBio });
      }
    } catch (error) {
      eventBus.emitError('NewChatModal', error, 'CHAT_SAVE_FAILED');
    } finally {
      setIsSaving(false);
    }
  };

  // --- UI COMPONENTS ---

  const renderSoulCard = (soul: any) => {
      const isSelected = selectedSoulId === soul.id;
      return (
          <button 
            key={soul.id}
            type="button"
            onClick={() => handleSoulSelect(soul.id)}
            aria-pressed={isSelected}
            className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all w-28 h-28 shrink-0 ${isSelected ? 'border-wa-teal bg-green-50 shadow-md transform scale-105' : 'border-transparent bg-gray-50 hover:bg-gray-100'}`}
          >
              <div className="text-3xl mb-2">{soul.emoji}</div>
              <span className={`text-xs font-bold text-center ${isSelected ? 'text-wa-teal' : 'text-gray-600'}`}>{soul.name}</span>
          </button>
      );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm font-sans">
      <div role="dialog" aria-modal="true" aria-labelledby="new-chat-title" className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in duration-200 flex flex-col max-h-[calc(100dvh-2rem)]">
        
        {/* Header */}
        <div className="p-5 border-b bg-white flex justify-between items-center shrink-0">
           <div>
               <h3 id="new-chat-title" className="font-bold text-xl text-gray-800">{isEditMode ? 'تعديل الكيان' : 'تشكيل روح جديدة'}</h3>
               <p className="text-xs text-gray-400">Living Persona — شخصية ثابتة بتتعلم أسلوب العلاقة بهدوء</p>
           </div>
           <button type="button" onClick={onClose} aria-label="إغلاق" className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={24} className="text-gray-500"/></button>
        </div>

        {/* Mode Tabs */}
        {!isEditMode && (
            <div className="flex p-2 bg-gray-50 shrink-0 gap-2 border-b">
                <button onClick={() => setMode('single')} className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${mode === 'single' ? 'bg-white text-wa-teal shadow-md' : 'text-gray-400 hover:bg-gray-100'}`}><User size={18}/> شخصية</button>
                <button onClick={() => setMode('group')} className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${mode === 'group' ? 'bg-white text-wa-teal shadow-md' : 'text-gray-400 hover:bg-gray-100'}`}><Layers size={18}/> مجموعة</button>
                <button onClick={() => setMode('import')} className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${mode === 'import' ? 'bg-white text-wa-teal shadow-md' : 'text-gray-400 hover:bg-gray-100'}`}><Download size={18}/> استنساخ</button>
            </div>
        )}

        <div className="flex-1 overflow-y-auto bg-[#F9FAFB]" dir="rtl">
            {mode === 'single' && (
                <div className="flex flex-col h-full">
                    {/* Inner Tabs for Single Mode */}
                    <div className="flex px-6 pt-4 gap-4 border-b border-gray-200 bg-white sticky top-0 z-10 overflow-x-auto no-scrollbar">
                        <button type="button" onClick={() => setActiveTab('identity')} className={`pb-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'identity' ? 'border-wa-teal text-wa-teal' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>الهوية والسيرة</button>
                        <button type="button" onClick={() => setActiveTab('soul')} className={`pb-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'soul' ? 'border-wa-teal text-wa-teal' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>الطابع والتطور</button>
                        <button type="button" onClick={() => setActiveTab('voice')} className={`pb-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'voice' ? 'border-wa-teal text-wa-teal' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>الصوت واللهجة</button>
                        {chatToEdit?.settings.cloneProfile ? (
                          <button type="button" onClick={() => setActiveTab('clone_analysis')} className={`pb-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'clone_analysis' ? 'border-wa-teal text-wa-teal' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>تحليل الاستنساخ</button>
                        ) : null}
                    </div>

                    <div className="p-6 space-y-8">
                        {activeTab === 'clone_analysis' && chatToEdit?.settings.cloneProfile ? (
                          <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4">
                            {cloneProfileDraft?.analysis?.status === 'ready' ? (
                              <>
                                <CloneAnalysisStatus profile={cloneProfileDraft} compact />
                                <CloneAnalysisEditor profile={cloneProfileDraft} onChange={handleCloneProfileChange} error={cloneProfileError} />
                              </>
                            ) : (
                              <>
                                <CloneAnalysisStatus profile={chatToEdit.settings.cloneProfile} />
                                <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900" role="status">
                                  التعديل هيتاح أول ما التحليل يكتمل، عشان النتيجة اللي شغالة في الخلفية ماتكتبش فوق تعديلاتك.
                                </p>
                              </>
                            )}
                          </div>
                        ) : null}
                        {activeTab === 'soul' && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                {/* Soul Archetypes Carousel */}
                                <div className="mb-8">
                                    <p className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><Sparkle size={16} className="text-purple-500"/> الطابع الأساسي</p>
                                    <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
                                        {SOUL_ARCHETYPES.map(renderSoulCard)}
                                    </div>
                                    <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <div className="text-sm font-bold text-gray-800">{selectedSoul.name}</div>
                                                <p className="text-xs text-blue-700 mt-1 leading-6">{selectedSoul.description}</p>
                                                <p className="text-xs text-gray-600 mt-2 leading-6">{selectedSoul.vibe}</p>
                                            </div>
                                            <div className="text-3xl shrink-0">{selectedSoul.emoji}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
                                                <BrainCircuit size={18} className="text-wa-teal" />
                                                التطور التلقائي
                                                <span className={`rounded-full px-2 py-0.5 text-[10px] ${adaptivePersonality.enabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                    {adaptivePersonality.enabled ? 'شغّال' : 'متوقف'}
                                                </span>
                                            </div>
                                            <p className="mt-2 text-xs leading-6 text-gray-600">
                                                {adaptivePersonality.summary} اسمه وقصته وحدوده مش بيتغيروا تلقائيًا؛ اللي بيتعلمه بس هو إيقاع الرد، المزاح، المباشرة والاحتواء.
                                            </p>
                                            <p className="mt-2 text-[11px] leading-5 text-gray-500">
                                                وهو شغّال، بيحلل دفعات صغيرة من المحادثة على Gemini في الخلفية. رسائل الجروبات لا تعلّم الملف الخاص.
                                            </p>
                                            <p className="mt-2 text-[11px] text-gray-400">
                                                مبني على {adaptivePersonality.observationCount} رسالة مستخدم
                                                {adaptivePersonality.updatedAt ? ` • آخر تحديث ${new Date(adaptivePersonality.updatedAt).toLocaleDateString()}` : ''}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleToggleAdaptation}
                                            aria-pressed={adaptivePersonality.enabled}
                                            aria-label={adaptivePersonality.enabled ? 'إيقاف التطور التلقائي' : 'تشغيل التطور التلقائي'}
                                            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-wa-teal focus-visible:ring-offset-2 ${adaptivePersonality.enabled ? 'bg-wa-teal' : 'bg-gray-300'}`}
                                        >
                                            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${adaptivePersonality.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                    {isEditMode && adaptivePersonality.observationCount > 0 && (
                                        <button type="button" onClick={handleResetAdaptation} className="mt-4 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-wa-teal">
                                            <RotateCcw size={14} /> إعادة ضبط اللي اتعلمه
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'identity' && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                                <div className="flex items-start gap-5">
                                    <div className="relative group shrink-0">
                                        <div
                                            className={`w-28 h-28 rounded-full bg-gray-200 border-4 border-white shadow-lg overflow-hidden flex items-center justify-center text-5xl ${uploadedAvatar ? 'cursor-zoom-in' : ''}`}
                                            onClick={() => {
                                                if (uploadedAvatar) setShowProfileImage(true);
                                            }}
                                            title={uploadedAvatar ? 'عرض صورة البروفايل' : undefined}
                                        >
                                            {uploadedAvatar ? <img src={uploadedAvatar} className="w-full h-full object-cover" alt={name || 'صورة البروفايل'} /> : (gender === 'male' ? '🧔🏻‍♂️' : '👩🏻‍🦱')}
                                        </div>
                                        <div className="absolute -bottom-2 -right-2 flex gap-1">
                                            <button 
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    handleGenerateAvatar();
                                                }}
                                                disabled={isGeneratingAvatar}
                                                className="p-2 bg-purple-600 text-white rounded-full cursor-pointer hover:bg-purple-700 shadow-lg transition-transform hover:scale-110 disabled:opacity-50"
                                                title="تخيل الشكل بالذكاء الاصطناعي"
                                            >
                                                {isGeneratingAvatar ? <Loader2 size={16} className="animate-spin"/> : <Sparkle size={16} />}
                                            </button>
                                            <label
                                                className="p-2 bg-wa-teal text-white rounded-full cursor-pointer hover:bg-[#006855] shadow-lg transition-transform hover:scale-110"
                                                onClick={(event) => event.stopPropagation()}
                                            >
                                                <Upload size={16} />
                                                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                                            </label>
                                        </div>
                                    </div>
                                    <div className="flex-1 space-y-3">
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 mb-1 block">الاسم</label>
                                            <input type="text" value={name} onChange={e=>setName(e.target.value)} className="w-full p-2.5 bg-white border rounded-xl focus:border-wa-teal outline-none text-sm" placeholder="اسم الشخصية..."/>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="w-1/3">
                                                <label className="text-xs font-bold text-gray-500 mb-1 block">السن</label>
                                                <input type="number" value={age} onChange={e=>setAge(e.target.value)} className="w-full p-2.5 bg-white border rounded-xl focus:border-wa-teal outline-none text-sm"/>
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-xs font-bold text-gray-500 mb-1 block">النوع</label>
                                                <div className="flex bg-gray-100 rounded-xl p-1">
                                                    <button type="button" onClick={()=>setGender('male')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${gender==='male'?'bg-white shadow text-blue-600':'text-gray-500'}`}>ذكر</button>
                                                    <button type="button" onClick={()=>setGender('female')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${gender==='female'?'bg-white shadow text-pink-600':'text-gray-500'}`}>أنثى</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-gray-200">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-bold text-gray-500 flex items-center gap-1"><FileText size={14}/> قصة الحياة (Bio)</label>
                                        <button 
                                            type="button"
                                            onClick={handleGenerateBio}
                                            disabled={isGeneratingBio}
                                            className="text-[10px] bg-purple-100 text-purple-700 px-2 py-1 rounded-lg hover:bg-purple-200 transition-colors flex items-center gap-1 disabled:opacity-50"
                                        >
                                            {isGeneratingBio ? <Loader2 size={10} className="animate-spin"/> : <Wand2 size={10}/>}
                                            تأليف تلقائي من الطباع
                                        </button>
                                    </div>
                                    <textarea value={bio} onChange={e=>setBio(e.target.value)} className="w-full p-3 bg-gray-50 border rounded-xl h-32 text-sm focus:border-wa-teal outline-none resize-none" placeholder="اكتب نبذة عن الشخصية أو اضغط تأليف تلقائي..."/>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-gray-200">
                                    <label className="text-xs font-bold text-gray-500 mb-3 flex items-center gap-1"><Cpu size={14}/> موديل الرد الافتراضي</label>
                                    <div className="grid grid-cols-2 gap-2" dir="ltr">
                                        {VISIBLE_CHAT_MODELS.map(model => (
                                            <button
                                                key={model.id}
                                                type="button"
                                                onClick={() => setSelectedModel(model.id)}
                                                className={`p-3 rounded-xl border text-left transition-all ${selectedModel === model.id ? 'border-wa-teal bg-green-50' : 'border-gray-200 hover:bg-gray-50'}`}
                                            >
                                                <div className={`font-bold text-sm ${selectedModel === model.id ? 'text-wa-teal' : 'text-gray-700'}`}>{model.label}</div>
                                                <div className="text-[10px] text-gray-400">{model.description}</div>
                                            </button>
                                        ))}
                                    </div>
                                    <label className="text-xs font-bold text-gray-500 mt-4 mb-3 flex items-center gap-1"><Sliders size={14}/> مستوى التفكير الافتراضي</label>
                                    <div className="grid grid-cols-3 gap-2" dir="ltr">
                                        {THINKING_LEVELS.map(level => (
                                            <button
                                                key={level.id}
                                                type="button"
                                                onClick={() => setSelectedThinkingLevel(level.id)}
                                                className={`p-3 rounded-xl border text-left transition-all ${selectedThinkingLevel === level.id ? 'border-wa-teal bg-green-50' : 'border-gray-200 hover:bg-gray-50'}`}
                                            >
                                                <div className={`font-bold text-sm ${selectedThinkingLevel === level.id ? 'text-wa-teal' : 'text-gray-700'}`}>{level.label}</div>
                                                <div className="text-[10px] text-gray-400">{level.description}</div>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3 flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="text-sm font-bold text-gray-800">Boost Rafiq</div>
                                            <p className="text-[11px] text-gray-500 leading-5">يفهرس الذكريات محليًا ويسترجعها بذكاء، ويستخدم Google Search فقط للأسئلة الحالية أو المعرفية.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setBoostRafiq(prev => !prev)}
                                            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${boostRafiq ? 'bg-wa-teal' : 'bg-gray-300'}`}
                                            aria-pressed={boostRafiq}
                                            title="Boost Rafiq"
                                        >
                                            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${boostRafiq ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'voice' && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                                {/* Dialect Selector */}
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-gray-700 flex items-center gap-2"><MessageSquare size={16} className="text-blue-500"/> اللهجة والأسلوب</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            {id: Dialect.CAIRO_MODERN, label: 'قاهري مودرن', sub: 'ده العادي يا زميلي'},
                                            {id: Dialect.ALEXANDRIAN, label: 'إسكندراني', sub: 'أيوة يا مرسي'},
                                            {id: Dialect.SAIDI, label: 'صعيدي', sub: 'لهجة القوة والهيبة'},
                                            {id: Dialect.FRANKO_ARAB, label: 'فرانكو / روش', sub: 'Ya3ni keda'}
                                        ].map(d => (
                                            <button 
                                                key={d.id}
                                                type="button"
                                                onClick={() => setDialect(d.id)}
                                                className={`p-3 rounded-xl border text-right transition-all ${dialect === d.id ? 'border-wa-teal bg-green-50' : 'border-gray-200 hover:bg-gray-50'}`}
                                            >
                                                <div className={`font-bold text-sm ${dialect === d.id ? 'text-wa-teal' : 'text-gray-700'}`}>{d.label}</div>
                                                <div className="text-[10px] text-gray-400">{d.sub}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Voice Tuner */}
                                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                                    <label className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-4"><Mic2 size={16} className="text-red-500"/> هندسة الصوت (Voice DNA)</label>
                                    
                                    <div className="mb-4">
                                        <div className="flex justify-between text-xs font-bold text-gray-500 mb-1.5">
                                            <span>نبرة الصوت (Pitch)</span>
                                            <span>{voicePitch.toFixed(1)}x</span>
                                        </div>
                                        <input 
                                            type="range" min="0.5" max="1.5" step="0.1" value={voicePitch} 
                                            onChange={(e) => setVoicePitch(parseFloat(e.target.value))}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-500"
                                        />
                                        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                                            <span>عميق/خشن</span>
                                            <span>حاد/ناعم</span>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between text-xs font-bold text-gray-500 mb-1.5">
                                            <span>سرعة الكلام (Speed)</span>
                                            <span>{voiceSpeed.toFixed(1)}x</span>
                                        </div>
                                        <input 
                                            type="range" min="0.7" max="1.3" step="0.1" value={voiceSpeed} 
                                            onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-500"
                                        />
                                        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                                            <span>هادي/راسي</span>
                                            <span>سريع/مهايبر</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* GROUP MODE (Simplistic for now) */}
            {mode === 'group' && (
               <div className="p-6 space-y-6">
                   <div>
                        <label htmlFor="group-name" className="text-xs font-bold text-gray-500 mb-1 block">اسم الشلة</label>
                        <input id="group-name" type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-wa-teal text-right font-bold text-lg"/>
                   </div>
                   <div>
                        <label htmlFor="group-bio" className="text-xs font-bold text-gray-500 mb-1 block">قصة وسيناريو الجروب (Bio)</label>
                        <textarea id="group-bio" value={groupBio} onChange={(e) => setGroupBio(e.target.value)} placeholder="اكتب موضوع النقاش أو قصة الجروب.. مثلاً: 'شلة أصحاب بيخططوا لخروجة يوم الجمعة وكل واحد بيقترح مكان' أو 'نقاش هادي عن الذكاء الاصطناعي ومستقبل الشغل'" rows={3} className="w-full bg-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-wa-teal text-right text-sm font-medium"/>
                   </div>
                   <div>
                        <p className="text-xs font-bold text-gray-500 mb-2">الأعضاء (اختار بوتين على الأقل)</p>
                        {existingBots.length < 2 && (
                            <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800" role="status">
                                أنشئ بوتين على الأقل الأول علشان يقدروا يتكلموا مع بعض.
                            </p>
                        )}
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {existingBots.map(bot => (
                                <button 
                                    key={bot.id} 
                                    type="button"
                                    onClick={() => setSelectedBots(prev => {
                                        const next = new Set(prev);
                                        if (next.has(bot.id)) next.delete(bot.id);
                                        else next.add(bot.id);
                                        return [...next];
                                    })}
                                    aria-pressed={selectedBotIds.has(bot.id)}
                                    className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer border transition-all text-right w-full focus-visible:ring-2 focus-visible:ring-wa-teal focus-visible:outline-none ${selectedBotIds.has(bot.id) ? 'bg-green-50 border-green-200' : 'bg-white border-transparent hover:bg-gray-50'}`}
                                >
                                    <Avatar name={bot.settings.botName} gender={bot.settings.botGender} size="sm" imageUrl={bot.settings.avatarUrl} />
                                    <span className="min-w-0 truncate text-sm font-bold text-gray-700">{bot.settings.botName}</span>
                                    {selectedBotIds.has(bot.id) && <Check size={14} className="text-wa-teal mr-auto"/>}
                                </button>
                            ))}
                        </div>
                   </div>
               </div>
            )}

            {mode === 'import' && (
              <div className="p-6">
                {/* Step 1: Upload */}
                {importStep === 'upload' && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div
                      className={`w-full border-2 border-dashed rounded-2xl p-10 transition-all cursor-pointer flex flex-col items-center gap-4 ${importFile ? 'border-wa-teal bg-green-50' : 'border-gray-300 hover:border-wa-teal hover:bg-green-50/30'}`}
                      onDrop={handleImportFileDrop}
                      onDragOver={(e) => e.preventDefault()}
                      onClick={() => importFileRef.current?.click()}
                    >
                      {isImporting ? (
                        <Loader2 size={48} className="text-wa-teal animate-spin" />
                      ) : importFile ? (
                        <FileText size={48} className="text-wa-teal" />
                      ) : (
                        <Upload size={48} className="text-gray-400" />
                      )}
                      <div className="text-center">
                        {importFile ? (
                          <>
                            <p className="font-bold text-wa-teal">{importFile.name}</p>
                            <p className="text-xs text-gray-400 mt-1">{(importFile.size / 1024).toFixed(0)} KB</p>
                          </>
                        ) : (
                          <>
                            <p className="font-bold text-gray-700">اسحب ملف المحادثة هنا</p>
                            <p className="text-xs text-gray-400 mt-1">أو اضغط لاختيار الملف</p>
                            <p className="text-[10px] text-gray-300 mt-3">يدعم: .txt من WhatsApp Export Chat</p>
                          </>
                        )}
                      </div>
                      <input
                        ref={importFileRef}
                        type="file"
                        accept=".txt"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleImportFileSelect(e.target.files[0])}
                      />
                    </div>

                    {importError && (
                      <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                        <div className="flex items-start gap-2">
                          <AlertCircle size={16} className="mt-0.5 shrink-0" />
                          <span>{importError}</span>
                        </div>
                        {importFileContent ? (
                          <button
                            type="button"
                            onClick={() => void detectImportParticipants(importFileContent)}
                            disabled={isImporting}
                            className="mt-3 min-h-11 rounded-xl bg-red-700 px-4 py-2 font-bold text-white disabled:opacity-60"
                          >
                            {isImporting ? 'جاري إعادة القراءة…' : 'أعد قراءة نفس الملف'}
                          </button>
                        ) : null}
                      </div>
                    )}

                    <div className="mt-6 bg-blue-50 rounded-xl p-4 text-xs text-blue-700">
                      <p className="font-bold mb-2">🤔 ازاي أصدر المحادثة من واتساب؟</p>
                      <ol className="list-decimal list-inside space-y-1 leading-6">
                        <li>افتح المحادثة في واتساب</li>
                        <li>اضغط ⋮ (القائمة) → More → Export Chat</li>
                        <li>اختار &quot;Without Media&quot;</li>
                        <li>ارفع الملف .txt هنا</li>
                      </ol>
                    </div>
                  </div>
                )}

                {/* Step 2: Participant Selection */}
                {importStep === 'participant' && importStatistics && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4">
                    {importError ? (
                      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
                        {importError}
                      </div>
                    ) : null}
                    <div className="flex items-center gap-3 mb-2">
                      <button onClick={() => { setImportStep('upload'); setImportFile(null); setImportFileContent(''); setImportStatistics(null); }} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                        <ArrowLeft size={18} className="text-gray-400" />
                      </button>
                      <div>
                        <h4 className="font-bold text-gray-700">🎯 مين عايز تعمله Clone؟</h4>
                        <p className="text-xs text-gray-400">{importStatistics.totalMessages} رسالة • {importStatistics.participants.length} مشاركين</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {importStatistics.participants.map(p => (
                        <button
                          key={p.name}
                          onClick={() => setImportTargetName(p.name)}
                          className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 text-right ${importTargetName === p.name ? 'border-wa-teal bg-green-50 shadow-md' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-wa-teal/20 to-green-200 flex items-center justify-center text-xl shrink-0">
                            {p.name === 'You' ? '👤' : '🧬'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-gray-800 truncate">{p.name}</div>
                            <div className="text-xs text-gray-400 mt-1">
                              {p.messageCount} رسالة • متوسط {Math.round(p.averageMessageLength)} حرف/رسالة
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {p.emojiFrequency > 0.5 && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">كتير إيموجي</span>}
                              {p.fragmentedMessageRatio > 0.3 && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">رسائل متقطعة</span>}
                              {p.questionFrequency > 15 && <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">كتير أسئلة</span>}
                              {p.averageMessageLength > 80 && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">رسائل طويلة</span>}
                            </div>
                          </div>
                          {importTargetName === p.name && <Check size={20} className="text-wa-teal shrink-0" />}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={handleStartAnalysis}
                      disabled={!importTargetName}
                      className="w-full mt-4 py-3 bg-gradient-to-r from-[#008069] to-[#00a884] text-white rounded-xl font-bold text-sm hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                      <Sparkle size={18} /> ابدأ التحليل
                    </button>
                  </div>
                )}

                {/* Step 3: Analysis Progress */}
                {importStep === 'analyzing' && (
                  <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center justify-center min-h-[350px] py-8">
                    <div className="relative w-24 h-24 mb-8">
                      <div className="absolute inset-0 rounded-full border-4 border-wa-teal/20 animate-pulse" />
                      <div className="absolute inset-2 rounded-full border-4 border-dashed border-wa-teal/40 animate-spin" style={{ animationDuration: '3s' }} />
                      <div className="absolute inset-4 rounded-full bg-gradient-to-br from-wa-teal to-green-400 flex items-center justify-center shadow-lg">
                        <span className="text-3xl">{getStageEmoji(importProgress.stage)}</span>
                      </div>
                    </div>

                    <p className="text-lg font-bold text-gray-800 mb-2 text-center">{importProgress.message || 'جاري التحليل...'}</p>
                    
                    <div
                      className="w-full max-w-xs bg-gray-200 rounded-full h-2.5 mt-4 overflow-hidden"
                      role="progressbar"
                      aria-label="تحليل المحادثة"
                      aria-valuetext="جاري تجهيز أول جزء من الشخصية"
                    >
                      <div
                        className="bg-gradient-to-r from-wa-teal to-green-400 h-full w-1/2 rounded-full animate-pulse"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-3 text-center max-w-xs leading-5">
                      هنحفظ أول نتيجة مفيدة وندخلك الشات؛ باقي أجزاء الملف هتتحلل وتتحفظ في الخلفية من غير ما تستنى.
                    </p>
                  </div>
                )}

                {/* Step 4: Preview & Edit */}
                {importStep === 'preview' && importResult && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-5">
                    {importResult.settings.cloneProfile?.analysis ? (
                      <CloneAnalysisStatus profile={importResult.settings.cloneProfile} />
                    ) : null}
                    {/* Confidence Banner */}
                    <div className={`rounded-xl p-3 flex items-center gap-3 ${
                      importResult.confidence.overall > 70 ? 'bg-green-50 border border-green-200' :
                      importResult.confidence.overall > 40 ? 'bg-yellow-50 border border-yellow-200' :
                      'bg-red-50 border border-red-200'
                    }`}>
                      <span className="text-2xl">{importResult.confidence.overall > 70 ? '🎯' : importResult.confidence.overall > 40 ? '🤔' : '⚠️'}</span>
                      <div>
                        <p className="text-sm font-bold text-gray-800">دقة التحليل: {importResult.confidence.overall}%</p>
                        <p className="text-[10px] text-gray-500">لغوي: {importResult.confidence.linguistic}% • نفسي: {importResult.confidence.psychological}%</p>
                      </div>
                    </div>

                    {/* Identity Card */}
                    <div className="bg-white rounded-2xl border p-5 flex items-start gap-4">
                      <div className="relative group shrink-0">
                        <div className={`w-16 h-16 rounded-full bg-gradient-to-br from-wa-teal to-green-400 flex items-center justify-center text-3xl overflow-hidden ${uploadedAvatar ? '' : ''}`}>
                          {uploadedAvatar ? <img src={uploadedAvatar} className="w-full h-full object-cover" alt={name} /> : '🧬'}
                        </div>
                        <button
                          onClick={handleGenerateAvatar}
                          disabled={isGeneratingAvatar}
                          className="absolute -bottom-1 -right-1 p-1.5 bg-purple-600 text-white rounded-full hover:bg-purple-700 shadow-lg transition-all"
                          title="توليد صورة بالذكاء الاصطناعي"
                        >
                          {isGeneratingAvatar ? <Loader2 size={12} className="animate-spin" /> : <Sparkle size={12} />}
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <input
                          value={name}
                          onChange={e => setName(e.target.value)}
                          className="font-bold text-lg border-b border-transparent hover:border-gray-200 focus:border-wa-teal outline-none w-full bg-transparent"
                        />
                        <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-400">
                          <button onClick={() => setGender(g => g === 'male' ? 'female' : 'male')} className="hover:text-wa-teal transition-colors">
                            {gender === 'male' ? '♂️ ذكر' : '♀️ أنثى'}
                          </button>
                          <span>📅 ~{age} سنة</span>
                          <span>💬 {importResult.blueprint.config.chattiness === 'high' ? 'ثرثار' : importResult.blueprint.config.chattiness === 'low' ? 'هادي' : 'متزن'}</span>
                        </div>
                      </div>
                    </div>

                      {/* Inferred behavioral baseline */}
                      <div className="bg-white rounded-2xl border p-5">
                      <h5 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2"><BrainCircuit size={14} className="text-wa-teal" /> البصمة المبدئية</h5>
                      <div className="mt-4 rounded-xl border border-green-100 bg-green-50 p-3">
                        <div className="text-xs font-bold text-green-700 mb-1">نقطة بداية، مش تشخيص ثابت</div>
                        <div className="text-sm font-bold text-gray-800">{soulProfile.title}</div>
                        <p className="text-xs text-gray-600 mt-1 leading-5">{soulProfile.summary}</p>
                        <p className="text-[11px] text-gray-500 mt-2 leading-5">الأسلوب هيتأقلم تدريجيًا مع الكلام الحقيقي من غير ما يغيّر الهوية أو الذكريات.</p>
                      </div>
                    </div>

                    {/* Bio */}
                    <div className="bg-white rounded-2xl border p-5">
                      <h5 className="font-bold text-sm text-gray-700 mb-2 flex items-center gap-2"><FileText size={14} /> السيرة الذاتية</h5>
                      <textarea
                        value={bio}
                        onChange={e => setBio(e.target.value)}
                        className="w-full h-28 bg-gray-50 rounded-xl p-3 text-sm resize-none border border-gray-200 focus:border-wa-teal outline-none"
                      />
                    </div>

                    {/* Memory Seeds */}
                    {importResult.memorySeeds && importResult.memorySeeds.length > 0 && (
                      <div className="bg-white rounded-2xl border p-5">
                        <h5 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2">
                          <Cpu size={14} className="text-purple-500" /> الذكريات المزروعة ({importResult.memorySeeds.length})
                        </h5>
                        <div className="space-y-2 max-h-36 overflow-y-auto">
                          {importResult.memorySeeds.map((seed, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                              <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] shrink-0 mt-0.5">{seed.category}</span>
                              <span className="text-gray-600 leading-5">{seed.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
        </div>

        {/* Footer */}
        {!(mode === 'import' && (importStep === 'analyzing' || importStep === 'upload')) && (
        <div className="p-5 border-t bg-white shrink-0 shadow-lg z-20">
            <button 
            type="button"
            onClick={mode === 'import' ? handleImportCreate : handleSave}
            disabled={isSaving || (mode === 'single' ? !name.trim() : mode === 'group' ? (!groupName.trim() || selectedBotCount < 2) : (mode === 'import' && (!importResult || !name.trim())))}
            className="w-full py-3.5 bg-gradient-to-r from-[#008069] to-[#00a884] text-white rounded-xl font-bold text-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-[0.99] flex items-center justify-center gap-2"
            >
            {isSaving ? <><Loader2 size={20} className="animate-spin"/> جاري الحفظ…</> : isEditMode ? 'حفظ التعديلات' : mode === 'import' ? <><Sparkle size={20}/> استنسخ الرفيق</> : <><PlayCircle size={20}/> {mode === 'single' ? 'بعث الروح' : 'إنشاء المجموعة'}</>}
            </button>
        </div>
        )}

      </div>
      <ProfileImageViewer
        open={showProfileImage}
        imageUrl={uploadedAvatar}
        alt={name || 'صورة البروفايل'}
        onClose={() => setShowProfileImage(false)}
      />
    </div>
  );
};

export default NewChatModal;
