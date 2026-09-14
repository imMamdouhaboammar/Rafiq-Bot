import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { AdaptivePersonalityMutation } from './services/livingPersonaCore.js';
import { BotMood, type BotSettings, type ChatSession, type SoulMemorySeed, type UserProfile } from './types.js';
import AppDialog from './components/AppDialog.js';
import ChatInterface from './components/ChatInterface.js';
import MobileNavigationPane, { type MobileNavigationTab } from './components/MobileNavigationPane.js';
import NewChatModal from './components/NewChatModal.js';
import PasswordGate from './components/PasswordGate.js';
import ResponsiveWhatsAppShell from './components/ResponsiveWhatsAppShell.js';
import Sidebar from './components/Sidebar.js';
import ToastHost from './components/ToastHost.js';
import UserProfileModal from './components/UserProfileModal.js';
import * as DB from './services/db.js';
import { eventBus, type RafiqEventMap } from './services/eventBus.js';
import * as GeminiService from './services/geminiService.js';
import { groupEngine } from './services/groupEngine.js';
import { importChat } from './services/chatTransfer.js';
import { buildBlueprintMemoryRecords } from './services/memoryEngine.js';
import {
  continueProgressiveCloneJob,
  startProgressiveCloneJob,
  subscribeToProgressiveCloneJob,
  type ProgressiveCloneJobHandle,
} from './services/progressiveCloneJob.js';
import { useAppController } from './hooks/useAppController.js';
import { useRafiqStore } from './stores/useRafiqStore.js';
import { getTextDirection } from './services/runtimeLocale.js';

export default function App() {
  return (
    <PasswordGate>
      <RafiqApp />
    </PasswordGate>
  );
}

interface DialogState {
  open: boolean;
  title: string;
  message: string;
  tone?: 'info' | 'warning' | 'danger';
  confirmLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
  dismissible?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

function RafiqApp() {
  const { isLoading } = useAppController();
  const {
    userProfile,
    chats,
    activeChatId,
    setActiveChatId,
    setUserProfile,
    updateChat,
    addChat,
    removeChat,
  } = useRafiqStore();

  const [activeTab, setActiveTab] = useState<MobileNavigationTab>('chats');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>({
    open: false,
    title: '',
    message: '',
  });
  const progressiveCloneWatchers = useRef(new Map<string, () => void>());

  const activeChat = chats.find(chat => chat.id === activeChatId);
  const editingChat = chats.find(chat => chat.id === editingChatId);
  const browserLocale = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';
  const shellLocale = activeChat?.settings.locale || browserLocale;
  const shellDirection = activeChat?.settings.direction || getTextDirection(shellLocale);

  useEffect(() => {
    document.documentElement.lang = shellLocale;
    document.documentElement.dir = shellDirection;
  }, [shellLocale, shellDirection]);

  const openChatEditor = useCallback(async (chatId: string) => {
    const current = useRafiqStore.getState().chats.find(chat => chat.id === chatId);
    const profile = current?.settings.cloneProfile;
    if (current && profile && profile.memorySeeds === undefined) {
      const memorySeeds = await DB.getCloneMemorySeedsForChat(chatId);
      updateChat({
        ...current,
        settings: {
          ...current.settings,
          cloneProfile: { ...profile, memorySeeds },
        },
      });
    }
    setEditingChatId(chatId);
  }, [updateChat]);

  const syncProgressiveCloneChat = useCallback(async (chatId: string) => {
    const latest = await DB.getChatSession(chatId);
    if (latest) updateChat(latest);
  }, [updateChat]);

  const watchProgressiveClone = useCallback((handle: ProgressiveCloneJobHandle) => {
    progressiveCloneWatchers.current.get(handle.jobId)?.();
    const unsubscribe = subscribeToProgressiveCloneJob(handle.jobId, () => {
      void syncProgressiveCloneChat(handle.status.chatId);
    });
    progressiveCloneWatchers.current.set(handle.jobId, unsubscribe);
    void handle.completion.finally(() => {
      void syncProgressiveCloneChat(handle.status.chatId);
    });
  }, [syncProgressiveCloneChat]);

  useEffect(() => () => {
    progressiveCloneWatchers.current.forEach(unsubscribe => unsubscribe());
    progressiveCloneWatchers.current.clear();
  }, []);

  useEffect(() => {
    for (const chat of chats) {
      const analysis = chat.settings.cloneProfile?.analysis;
      if (!analysis || analysis.status === 'ready' || progressiveCloneWatchers.current.has(analysis.jobId)) continue;
      void continueProgressiveCloneJob(analysis.jobId)
        .then(watchProgressiveClone)
        .catch(error => console.warn('[App] Progressive clone resume failed:', error instanceof Error ? error.message : 'unknown error'));
    }
  }, [chats, watchProgressiveClone]);

  const closeDialog = () => {
    setDialogState(previous => ({ ...previous, open: false }));
  };

  useEffect(() => {
    const handleAdaptationUpdated = ({ chat }: { chatId: string; chat: ChatSession }) => {
      updateChat(chat);
    };
    eventBus.on('persona:adaptation_updated', handleAdaptationUpdated);
    return () => eventBus.off('persona:adaptation_updated', handleAdaptationUpdated);
  }, [updateChat]);

  useEffect(() => {
    const handleGroupPreview = (payload: RafiqEventMap['group:message_send']) => {
      useRafiqStore.getState().updateChatPreview(
        payload.groupId,
        `${payload.senderName || payload.senderId}: ${payload.text}`,
        new Date(),
      );
    };
    eventBus.on('group:message_send', handleGroupPreview);
    return () => eventBus.off('group:message_send', handleGroupPreview);
  }, []);

  useEffect(() => {
    const handleDialog = (payload: Omit<DialogState, 'open'>) => {
      setDialogState({ ...payload, open: true });
    };
    eventBus.on('ui:dialog', handleDialog);
    return () => eventBus.off('ui:dialog', handleDialog);
  }, []);

  const handleSaveProfile = async (profile: UserProfile) => {
    await DB.saveUserProfile(profile);
    setUserProfile(profile);
  };

  const handleCreateChat = async (
    settings: BotSettings | null,
    groupData?: { name: string; members: string[]; bio?: string },
  ): Promise<string> => {
    if (!settings) {
      const availableBotIds = new Set(chats.filter(chat => !chat.isGroup).map(chat => chat.id));
      const resolvedMembers = [...new Set(groupData?.members || [])]
        .filter(memberId => availableBotIds.has(memberId));
      if (!groupData?.name.trim() || resolvedMembers.length < 2) {
        eventBus.emit('ui:toast', {
          message: 'المجموعة محتاجة اسم وبوتين موجودين على الأقل',
          type: 'warning',
        });
        return '';
      }
      groupData = { ...groupData, members: resolvedMembers };
    }

    const id = crypto.randomUUID();
    const initialPsychology = {
      mood: BotMood.NEUTRAL,
      intimacyLevel: 5,
      socialMeter: 5,
      energyLevel: 8,
      emotionalLedger: 0,
      lastInteractionTime: new Date(),
      secretUnlocked: false,
      hungerLevel: 20,
      financialStress: 30,
      sleepiness: 0,
      tier: 'pro' as const,
      isPro: true,
    };

    let newChat: ChatSession;
    if (settings) {
      if (!settings.avatarUrl) {
        void GeminiService.generateProfileAvatar(
          settings.botName,
          settings.botGender,
          settings.botAge,
          settings.botBio,
          settings.visualSeed,
        ).then(url => DB.patchChatSession(id, { settings: { avatarUrl: url } }))
          .then(chat => {
            if (chat?.settings.avatarUrl) {
              eventBus.emit('persona:visual_generated', {
                personaId: id,
                imageUrl: chat.settings.avatarUrl,
              });
            }
          })
          .catch(error => console.warn('[App] Background avatar generation failed:', error));
      }
      newChat = {
        id,
        settings,
        psychology: initialPsychology,
        lastMessageTimestamp: new Date(),
        unreadCount: 0,
      };
    } else {
      newChat = {
        id,
        isGroup: true,
        groupName: groupData?.name || 'مجموعة جديدة',
        memberIds: groupData?.members || [],
        settings: {
          botName: groupData?.name || 'مجموعة جديدة',
          botGender: 'male',
          chattiness: 'balanced',
          fragmentedMessages: true,
          botBio: groupData?.bio,
        },
        psychology: initialPsychology,
        lastMessageTimestamp: new Date(),
        unreadCount: 0,
      };
    }

    await DB.saveChatSession(newChat);
    addChat(newChat);
    setActiveTab('chats');
    setActiveChatId(id);
    setShowNewChatModal(false);
    eventBus.emit('ui:toast', { message: 'تم إنشاء الدردشة', type: 'success' });
    return id;
  };

  const handleCreateClone = async (
    settings: BotSettings,
    seeds: SoulMemorySeed[],
  ): Promise<string> => {
    const id = crypto.randomUUID();
    const newChat: ChatSession = {
      id,
      settings,
      psychology: {
        mood: BotMood.NEUTRAL,
        intimacyLevel: 5,
        socialMeter: 5,
        energyLevel: 8,
        emotionalLedger: 0,
        lastInteractionTime: new Date(),
        secretUnlocked: false,
        hungerLevel: 20,
        financialStress: 30,
        sleepiness: 0,
        tier: 'pro' as const,
        isPro: true,
      },
      lastMessageTimestamp: new Date(),
      unreadCount: 0,
    };
    const { legacyEntries, memoryRecords } = buildBlueprintMemoryRecords(id, seeds);
    if (legacyEntries.length === 0 || memoryRecords.length === 0) {
      throw new Error('التحليل لم ينتج ذكريات موثوقة كفاية لإنشاء الشخصية.');
    }

    await DB.saveClonedChatSession(newChat, legacyEntries, memoryRecords);
    addChat(newChat);
    setActiveTab('chats');
    setActiveChatId(id);
    setShowNewChatModal(false);
    eventBus.emit('ui:toast', { message: `تم استنساخ ${settings.botName} وحفظ ذكرياته بنجاح`, type: 'success' });

    if (!settings.avatarUrl) {
      void GeminiService.generateProfileAvatar(
        settings.botName,
        settings.botGender,
        settings.botAge,
        settings.botBio,
        settings.visualSeed,
      ).then(url => DB.patchChatSession(id, { settings: { avatarUrl: url } }))
        .then(chat => {
          if (chat?.settings.avatarUrl) {
            eventBus.emit('persona:visual_generated', { personaId: id, imageUrl: chat.settings.avatarUrl });
          }
        })
        .catch(error => console.warn('[App] Background clone avatar generation failed:', error));
    }

    return id;
  };

  const handleStartProgressiveClone = async (
    fileContent: string,
    targetName: string,
  ): Promise<string> => {
    const id = crypto.randomUUID();
    const placeholder: ChatSession = {
      id,
      settings: {
        botName: targetName,
        botGender: 'female',
        chattiness: 'balanced',
        fragmentedMessages: true,
        soulId: 'amira_default',
        thinkingLevel: 'medium',
        boostRafiq: true,
      },
      psychology: {
        mood: BotMood.NEUTRAL,
        intimacyLevel: 5,
        socialMeter: 5,
        energyLevel: 8,
        emotionalLedger: 0,
        lastInteractionTime: new Date(),
        secretUnlocked: false,
        hungerLevel: 20,
        financialStress: 30,
        sleepiness: 0,
        tier: 'pro' as const,
        isPro: true,
      },
      lastMessageTimestamp: new Date(),
      unreadCount: 0,
    };

    await DB.saveChatSession(placeholder);
    try {
      const handle = await startProgressiveCloneJob({
        chatId: id,
        targetName,
        text: fileContent,
      });
      const created = await DB.getChatSession(id);
      if (!created?.settings.cloneProfile) {
        throw new Error('أول جزء من التحليل لم ينتج شخصية قابلة للحفظ.');
      }

      addChat(created);
      setActiveTab('chats');
      setActiveChatId(id);
      setShowNewChatModal(false);
      watchProgressiveClone(handle);
      eventBus.emit('ui:toast', {
        message: `تم إنشاء ${created.settings.botName}. التحليل التفصيلي مستمر في الخلفية.`,
        type: 'success',
      });
      return id;
    } catch (error) {
      await DB.deleteChatSession(id);
      throw error;
    }
  };

  const handleImportChat = async (file: File) => {
    try {
      const result = await importChat(file);
      addChat(result.chatSession);
      setActiveTab('chats');
      setActiveChatId(result.chatSession.id);
      const name = result.chatSession.isGroup
        ? result.chatSession.groupName
        : result.chatSession.settings.botName;
      eventBus.emit('ui:toast', {
        message: `تم استيراد محادثة ${name || ''} (${result.messageCount} رسالة)`,
        type: 'success',
      });
    } catch (error) {
      console.error('Import failed:', error);
      eventBus.emit('ui:toast', {
        message: error instanceof Error ? error.message : 'فشل استيراد الملف',
        type: 'error',
      });
    }
  };

  const handleEditChat = async (
    chatId: string,
    newSettings: BotSettings | null,
    groupData?: { name: string; members: string[]; bio?: string },
    adaptiveMutation?: AdaptivePersonalityMutation,
  ) => {
    const existingChat = chats.find(chat => chat.id === chatId);
    if (!existingChat) return;

    let updatedChat: ChatSession | undefined;
    if (existingChat.isGroup && groupData) {
      const availableBotIds = new Set(chats.filter(chat => !chat.isGroup).map(chat => chat.id));
      const resolvedMembers = [...new Set(groupData.members)]
        .filter(memberId => availableBotIds.has(memberId));
      if (!groupData.name.trim() || resolvedMembers.length < 2) {
        eventBus.emit('ui:toast', {
          message: 'المجموعة محتاجة اسم وبوتين موجودين على الأقل',
          type: 'warning',
        });
        return;
      }
      updatedChat = await DB.patchChatSession(chatId, {
        fields: { groupName: groupData.name, memberIds: resolvedMembers },
        settings: { botBio: groupData.bio },
      });
    } else if (newSettings) {
      const rawEditedCloneSeeds = newSettings.cloneProfile?.memorySeeds;
      const editedCloneSeeds = rawEditedCloneSeeds?.flatMap((seed): SoulMemorySeed[] => {
        if (!seed.text?.trim() || !seed.category || !Number.isFinite(seed.salience)) return [];
        return [{
          text: seed.text.trim(),
          category: seed.category,
          salience: Math.max(0, Math.min(1, seed.salience!)),
          ...(seed.subject ? { subject: seed.subject } : {}),
        }];
      });
      if (editedCloneSeeds) {
        const { legacyEntries, memoryRecords } = buildBlueprintMemoryRecords(chatId, editedCloneSeeds);
        updatedChat = await DB.patchChatAndReplaceCloneMemories(chatId, {
          settings: newSettings,
          adaptiveMutation,
          legacyEntries,
          memoryRecords,
        });
      } else {
        updatedChat = await DB.patchChatSession(chatId, {
          settings: newSettings,
          adaptiveMutation,
        });
      }
    }

    if (!updatedChat) return;
    updateChat(updatedChat);
    setEditingChatId(null);
    eventBus.emit('ui:toast', { message: 'تم تحديث الدردشة', type: 'success' });
  };

  const handleDeleteChat = async (id: string) => {
    const targetChat = chats.find(chat => chat.id === id);
    const targetName = targetChat?.isGroup ? targetChat.groupName : targetChat?.settings.botName;

    if (targetChat && !targetChat.isGroup) {
      const containingGroups = await DB.getGroupsForBot(id);
      if (containingGroups.length > 0) {
        setDialogState({
          open: true,
          title: 'البوت موجود في مجموعة',
          message: `شيل ${targetName || 'البوت'} الأول من: ${containingGroups.map(group => group.groupName).join('، ')}`,
          tone: 'warning',
          confirmLabel: 'تمام',
          showCancel: false,
          dismissible: true,
        });
        return;
      }
    }

    setDialogState({
      open: true,
      title: 'حذف الدردشة',
      message: `هتتحذف الدردشة بالكامل مع ${targetName || 'هذه الشخصية'}، مع كل الرسائل والذكريات المفهرسة.`,
      tone: 'danger',
      confirmLabel: 'احذف',
      cancelLabel: 'رجوع',
      showCancel: true,
      dismissible: true,
      onConfirm: async () => {
        if (targetChat?.isGroup) groupEngine.destroyGroupSession(id);
        await DB.deleteChatSession(id);
        removeChat(id);
        if (editingChatId === id) setEditingChatId(null);
        eventBus.emit('ui:toast', { message: 'تم حذف الدردشة بالكامل', type: 'success' });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  const chatSurface = activeChat && activeChatId ? (
    <ChatInterface
      key={activeChatId}
      chat={activeChat}
      userProfile={userProfile}
      onBack={() => setActiveChatId(null)}
      onInfo={() => void openChatEditor(activeChatId)}
      onDelete={() => void handleDeleteChat(activeChatId)}
    />
  ) : (
    <div className="flex flex-1 flex-col items-center justify-center border-b-[6px] border-[#25D366] bg-[#f0f2f5] text-center">
      <div className="max-w-md p-10">
        <h1 className="mb-4 text-3xl font-light text-[#41525d]">Rafiq Web</h1>
        <p className="text-sm text-[#667781]">اختار محادثة أو أنشئ شخصية جديدة للبدء</p>
        <button
          type="button"
          onClick={() => setShowNewChatModal(true)}
          className="mt-8 min-h-11 rounded-full bg-[#008069] px-6 font-bold text-white shadow hover:bg-[#006855]"
        >
          إنشاء شخصية جديدة
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] w-full justify-center overflow-hidden bg-[#d1d7db] font-sans" dir={shellDirection}>
      <div className="relative h-full w-full max-w-[1600px] bg-white shadow-xl">
        <ResponsiveWhatsAppShell
          sidebar={(
            <Sidebar
              userProfile={userProfile}
              chats={chats}
              activeChatId={activeChatId}
              isTyping={false}
              onSelectChat={setActiveChatId}
              onDeleteChat={id => void handleDeleteChat(id)}
              onEditChat={chat => void openChatEditor(chat.id)}
              onOpenProfile={() => setShowProfileModal(true)}
              onNewChat={() => setShowNewChatModal(true)}
              onImportChat={file => void handleImportChat(file)}
            />
          )}
          mobileSidebar={(
            <MobileNavigationPane
              activeTab={activeTab}
              chats={chats}
              userProfile={userProfile}
              onTabChange={setActiveTab}
              onSelectChat={chatId => {
                setActiveTab('chats');
                setActiveChatId(chatId);
              }}
              onNewChat={() => setShowNewChatModal(true)}
              onSaveProfile={handleSaveProfile}
            />
          )}
          chat={chatSurface}
          hasActiveChat={Boolean(activeChat && activeChatId)}
          mobilePane={activeChatId ? 'chat' : 'list'}
          onShowList={() => setActiveChatId(null)}
        />

        <ToastHost />

        {showNewChatModal ? (
          <NewChatModal
            onClose={() => setShowNewChatModal(false)}
            onCreate={handleCreateChat}
            onCreateClone={handleCreateClone}
            onStartProgressiveClone={handleStartProgressiveClone}
            availableBots={chats}
          />
        ) : null}

        {editingChat ? (
          <NewChatModal
            onClose={() => setEditingChatId(null)}
            onCreate={() => {}}
            onEdit={handleEditChat}
            availableBots={chats}
            chatToEdit={editingChat}
          />
        ) : null}

        {showProfileModal ? (
          <UserProfileModal
            profile={userProfile}
            onSave={profile => {
              void handleSaveProfile(profile).then(() => setShowProfileModal(false));
            }}
            onClose={() => setShowProfileModal(false)}
          />
        ) : null}

        <AppDialog
          open={dialogState.open}
          title={dialogState.title}
          message={dialogState.message}
          tone={dialogState.tone}
          confirmLabel={dialogState.confirmLabel}
          cancelLabel={dialogState.cancelLabel}
          showCancel={dialogState.showCancel}
          dismissible={dialogState.dismissible}
          onConfirm={() => {
            const action = dialogState.onConfirm;
            closeDialog();
            if (action) void action();
          }}
          onCancel={() => {
            const action = dialogState.onCancel;
            closeDialog();
            action?.();
          }}
        />
      </div>
    </div>
  );
}
