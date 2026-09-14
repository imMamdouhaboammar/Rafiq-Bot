import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useRafiqStore } from '../stores/useRafiqStore.js';
import { useComposerAttachmentUiStore } from '../stores/composerAttachmentUiStore.js';
import * as GeminiService from '../services/geminiService.js';
import * as DB from '../services/db.js';
import { evolvePsychology } from '../services/dynamicEngines.js';
import {
  AppMode,
  BotMood,
  MessageRole,
  type Attachment,
  type ChatMessage,
  type ChatSession,
  type PsychologicalState,
  type StudioConfig,
} from '../types.js';
import { eventBus } from '../services/eventBus.js';
import {
  resolveChatModel,
  resolveThinkingLevel,
  type ChatModelId,
  type ChatThinkingLevelId,
} from '../services/geminiModels.js';
import {
  ensureBoostMemoryIndex,
  indexBoostMemoryMessage,
  retrieveBoostContext,
} from '../services/memoryEngine.js';
import {
  classifyConversationRoute,
  compileConversationRouteInstruction,
} from '../services/conversationRouter.js';
import { collectLatestUserBurst } from '../services/messageBurst.js';
import {
  createConfirmedSelfieRequest,
  type ConfirmedSelfieAction,
} from '../services/imageRequestRouter.js';
import { personalityEvolutionCoordinator } from '../services/personalityEvolution.js';
import { removeRepeatedAssistantBubbles, sanitizePersonaReply } from '../services/conversationShapedPersona.js';
import {
  finalizeComposerAttachments,
  releaseComposerAttachments,
  stageComposerAttachment,
  type StagedComposerAttachment,
} from '../services/attachmentComposer.js';
import { attachmentRepository } from '../services/attachmentRepository.js';
import {
  describeSkippedAiAttachments,
  prepareAttachmentsForAi,
} from '../services/aiAttachmentPayload.js';
import {
  AsyncGenerationGuard,
  isAbortLikeError,
  type GenerationLease,
} from '../services/asyncGenerationGuard.js';
import {
  advanceStoryState,
  compileSlowBurnStoryInstruction,
  createInitialStoryState,
  detectSlowBurnStoryIntent,
} from '../services/slowBurnStoryEngine.js';
import { createContinuityCoordinator } from '../services/continuityCoordinator.js';
import { selectContinuityContext, type ContinuityContextItem } from '../services/companionContinuity.js';
import { compileContinuityContextInstruction } from '../services/continuityPrompt.js';
import { resolveConversationDynamics } from '../services/conversationDynamics/index.js';

const continuityCoordinator = createContinuityCoordinator({
  saveChat: DB.saveChatSession,
  reflect: async input => GeminiService.runReflectionConsolidation(input),
});

const RESPONSE_HISTORY_LIMIT = 60;
const DEFAULT_STUDIO_CONFIG: StudioConfig = {
  aspectRatio: '1:1',
  size: '2K',
  style: 'realistic',
  enhancePrompt: true,
};
const IMAGE_EXECUTION_TAGS = /\[\[(?:GENERATE_IMAGE|GENERATE_SELFIE)(?::[\s\S]*?)?\]\]/gi;

export interface ComposerAttachmentUpload {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  progress: number;
}

const normalizeAssistantReply = (rawText: string): string => (
  rawText
    .replace(IMAGE_EXECUTION_TAGS, '')
    .replace(/\s*\|\|\|\s*/g, ' ||| ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
);

const collapseFragmentedReply = (rawText: string): string => {
  const normalized = normalizeAssistantReply(rawText);
  if (!normalized.includes('|||')) return normalized;
  const parts = normalized.split('|||').map(part => part.trim()).filter(Boolean);
  if (parts.length <= 1) return normalized.replace(/\s*\|\|\|\s*/g, ' ').trim();
  const totalChars = parts.reduce((sum, part) => sum + part.length, 0);
  const tinyParts = parts.filter(part => part.length < 18).length;
  if (!(parts.length > 3 || (tinyParts >= 2 && totalChars < 180))) return parts.join(' ||| ');

  const merged: string[] = [];
  for (const part of parts) {
    const previous = merged[merged.length - 1];
    if (!previous) {
      merged.push(part);
      continue;
    }
    const previousQuestion = /[؟?!]$/.test(previous);
    if ((previous.length < 35 || part.length < 35) && !previousQuestion) {
      merged[merged.length - 1] = `${previous} ${part}`.replace(/\s+/g, ' ').trim();
    } else {
      merged.push(part);
    }
  }
  return merged.join(' ||| ');
};

const delay = (milliseconds: number, lease: GenerationLease): Promise<void> => (
  new Promise((resolve, reject) => {
    let timer: number;
    const handleAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    timer = window.setTimeout(() => {
      lease.signal.removeEventListener('abort', handleAbort);
      resolve();
    }, milliseconds);
    lease.signal.addEventListener('abort', handleAbort, { once: true });
  })
);

export const useChatController = (chatId: string) => {
  const {
    chats,
    updateChat,
    addMessage,
    setMessages,
    messagesByChat,
    typingByChat,
    setChatTyping,
    removeMessage,
  } = useRafiqStore();
  const chat = chats.find(candidate => candidate.id === chatId);
  const messages = messagesByChat[chatId] || [];

  const [input, setInput] = useState('');
  const [appMode, setAppMode] = useState<AppMode>(AppMode.CHAT);
  const [studioConfig, setStudioConfig] = useState<StudioConfig>(DEFAULT_STUDIO_CONFIG);
  const [stagedAttachments, setStagedAttachments] = useState<StagedComposerAttachment[]>([]);
  const [attachmentUploads, setAttachmentUploads] = useState<ComposerAttachmentUpload[]>([]);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const attachments = useMemo(
    () => stagedAttachments.map(attachment => attachment.draft),
    [stagedAttachments],
  );
  const composerAttachments = useMemo(
    () => stagedAttachments.map(attachment => ({ id: attachment.attachmentId, attachment: attachment.draft })),
    [stagedAttachments],
  );
  const isTyping = Boolean(typingByChat[chatId]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const appModeRef = useRef<AppMode>(appMode);
  const studioConfigRef = useRef<StudioConfig>(studioConfig);
  const generationGuardRef = useRef(new AsyncGenerationGuard());
  const responseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamThrottleRef = useRef<number | null>(null);
  const scrollTimerRef = useRef<number | null>(null);
  const stagedAttachmentsRef = useRef<StagedComposerAttachment[]>([]);
  const attachmentUploadsRef = useRef<ComposerAttachmentUpload[]>([]);
  const attachmentUploadControllersRef = useRef(new Map<string, AbortController>());
  const pendingSelfiesRef = useRef(new Set<string>());
  const completedSelfiesRef = useRef(new Set<string>());
  const continuityContextRef = useRef<ContinuityContextItem[]>([]);

  const replaceAttachmentUploads = (
    updater: (current: ComposerAttachmentUpload[]) => ComposerAttachmentUpload[],
  ) => {
    const next = updater(attachmentUploadsRef.current);
    attachmentUploadsRef.current = next;
    setAttachmentUploads(next);
  };

  useEffect(() => {
    appModeRef.current = appMode;
  }, [appMode]);

  useEffect(() => {
    studioConfigRef.current = studioConfig;
  }, [studioConfig]);

  useEffect(() => {
    stagedAttachmentsRef.current = stagedAttachments;
  }, [stagedAttachments]);

  useEffect(() => () => {
    generationGuardRef.current.cancel('component_unmounted');
    if (responseTimerRef.current) clearTimeout(responseTimerRef.current);
    if (streamThrottleRef.current) window.clearTimeout(streamThrottleRef.current);
    if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
  }, []);

  useEffect(() => {
    setStagedAttachments([]);
    setAttachmentUploads([]);

    return () => {
      for (const controller of attachmentUploadControllersRef.current.values()) controller.abort();
      for (const upload of attachmentUploadsRef.current) {
        void attachmentRepository.remove(upload.id);
      }
      attachmentUploadControllersRef.current.clear();
      attachmentUploadsRef.current = [];
      const unsentAttachments = stagedAttachmentsRef.current;
      stagedAttachmentsRef.current = [];
      releaseComposerAttachments(unsentAttachments);
      for (const attachment of unsentAttachments) {
        void attachmentRepository.remove(attachment.attachmentId);
      }
    };
  }, [chatId]);

  useEffect(() => {
    generationGuardRef.current.advance('chat_changed');
    const lease = generationGuardRef.current.begin();

    const loadMessages = async () => {
      if (!chatId) return;
      await DB.updateChatUnreadCount(chatId, true);
      lease.throwIfStale();
      const currentChat = await DB.getChatSession(chatId)
        || useRafiqStore.getState().chats.find(candidate => candidate.id === chatId);
      if (currentChat) updateChat({ ...currentChat, unreadCount: 0 });
      const loadedMessages = await DB.getMessagesForChat(chatId, 100);
      lease.throwIfStale();
      setMessages(chatId, loadedMessages);
      const loadedStory = await DB.getActiveStory(chatId);
      lease.throwIfStale();
      useRafiqStore.getState().setActiveStory(chatId, loadedStory || null);
      if (currentChat?.settings.boostRafiq) {
        await ensureBoostMemoryIndex(currentChat, loadedMessages);
        lease.throwIfStale();
      }
      if (currentChat && !currentChat.isGroup) {
        const resumeResult = await continuityCoordinator.onSessionResume({ chat: currentChat });
        lease.throwIfStale();
        if (resumeResult.changed) {
          updateChat(resumeResult.chat);
        }
        continuityContextRef.current = resumeResult.context;
      }
      scrollTimerRef.current = window.setTimeout(() => {
        if (lease.isCurrent()) scrollRef.current?.scrollIntoView({ behavior: 'auto' });
        scrollTimerRef.current = null;
      }, 100);
    };

    void loadMessages().catch(error => {
      if (!isAbortLikeError(error)) console.error('[ChatController] Message load failed:', error);
    });

    return () => {
      generationGuardRef.current.advance('chat_effect_cleanup');
      if (scrollTimerRef.current) {
        window.clearTimeout(scrollTimerRef.current);
        scrollTimerRef.current = null;
      }
    };
  }, [chatId, chat?.settings.boostRafiq, setMessages, updateChat]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isTyping]);

  const selectedModel = resolveChatModel(chat?.settings.model);
  const selectedThinkingLevel = resolveThinkingLevel(chat?.settings.thinkingLevel);

  const setSelectedModel = async (model: ChatModelId) => {
    const currentChat = useRafiqStore.getState().chats.find(candidate => candidate.id === chatId);
    if (!currentChat || currentChat.isGroup) return;
    const updatedChat = await DB.patchChatSession(currentChat.id, { settings: { model } });
    if (updatedChat) updateChat(updatedChat);
  };

  const setSelectedThinkingLevel = async (thinkingLevel: ChatThinkingLevelId) => {
    const currentChat = useRafiqStore.getState().chats.find(candidate => candidate.id === chatId);
    if (!currentChat || currentChat.isGroup) return;
    const updatedChat = await DB.patchChatSession(currentChat.id, { settings: { thinkingLevel } });
    if (updatedChat) updateChat(updatedChat);
  };

  const showToast = (message: string, type: 'success' | 'error' = 'error') => {
    eventBus.emit('ui:toast', { message, type });
  };

  const addBotMessage = async (
    text: string,
    urls?: any[],
    atts?: Attachment[],
    currentPsych?: PsychologicalState,
    targetChat?: ChatSession,
    toolsUsed?: any[],
    lease?: GenerationLease,
  ) => {
    lease?.throwIfStale();
    const activeChat = targetChat || chat;
    if (!activeChat) return;
    let cleanText = text ? sanitizePersonaReply(text, { botBio: activeChat.settings.botBio }) : '';
    cleanText = cleanText
      .replace(IMAGE_EXECUTION_TAGS, '')
      .replace(/!{2,}/g, '!')
      .replace(/\?{2,}/g, '?')
      .replace(/؟{2,}/g, '؟')
      .replace(/[!?؟]{2,}/g, match => match.includes('؟') ? '؟' : match.includes('?') ? '?' : '!')
      .split('|||')
      .map(part => part.trim().replace(/(?<!\.)\.(?!\.)(?=\s|$|(?!\d)[\p{Emoji}\p{Extended_Pictographic}\u200d\uFE0F])/gu, ''))
      .join(' ||| ')
      .trim();
    if (!cleanText && (!atts || atts.length === 0)) return;

    const botMessage: ChatMessage = {
      id: crypto.randomUUID(),
      chatId: activeChat.id,
      role: MessageRole.MODEL,
      senderId: activeChat.id,
      text: cleanText,
      groundingUrls: urls,
      attachments: atts,
      toolsUsed,
      timestamp: new Date(),
    };
    await DB.saveMessage(botMessage);
    lease?.throwIfStale();
    await indexBoostMemoryMessage(activeChat, botMessage);
    lease?.throwIfStale();
    addMessage(botMessage);

    if (currentPsych) {
      const updatedChat = await DB.patchChatSession(activeChat.id, {
        fields: {
          psychology: currentPsych,
          lastMessage: cleanText || (atts?.length ? 'Sent attachment' : '...'),
          lastMessageTimestamp: new Date(),
        },
      });
      lease?.throwIfStale();
      if (updatedChat) updateChat(updatedChat);
      personalityEvolutionCoordinator.observeTurn(activeChat.id);
    }
  };

  const processBotResponse = async () => {
    const lease = generationGuardRef.current.begin();
    const currentChat = useRafiqStore.getState().chats.find(candidate => candidate.id === chatId);
    const currentUserProfile = useRafiqStore.getState().userProfile;
    if (!currentChat) return;

    useRafiqStore.getState().setChatTyping(currentChat.id, true);
    let evolvedPsych: PsychologicalState = currentChat.psychology || {
      mood: BotMood.NEUTRAL,
      energyLevel: 7,
      socialMeter: 5,
      emotionalLedger: 0,
      currentScenario: 'Routine',
      intimacyLevel: 5,
      secretUnlocked: false,
    };

    try {
      const allMessages = await DB.getMessagesForChat(chatId, RESPONSE_HISTORY_LIMIT);
      lease.throwIfStale();
      const burst = collectLatestUserBurst(allMessages);
      const lastMessage = burst.latestMessage;
      if (!lastMessage || lastMessage.role !== MessageRole.USER) return;
      const conversationText = burst.burstMessages
        .map(message => message.text)
        .filter(Boolean)
        .join('\n') || lastMessage.text || '';

      const routeClassification = classifyConversationRoute(conversationText, lastMessage.replyTo?.text);
      const currentPsych = { ...evolvedPsych };
      const growthFactor = currentPsych.socialMeter > 3 ? 0.2 : 0.05;
      currentPsych.intimacyLevel = Math.min(100, (currentPsych.intimacyLevel || 5) + growthFactor);
      currentPsych.socialMeter = Math.min(10, currentPsych.socialMeter + 0.5);
      currentPsych.emotionalLedger = Math.min(100, currentPsych.emotionalLedger + 1);
      evolvedPsych = evolvePsychology(currentPsych, conversationText, routeClassification.id);
      lease.throwIfStale();
      useRafiqStore.getState().updateChat({ ...currentChat, psychology: evolvedPsych });

      const boostContext = await retrieveBoostContext(currentChat, conversationText);
      lease.throwIfStale();
      const activeStory = useRafiqStore.getState().activeStories[currentChat.id] || null;
      const burstAttachments = burst.burstMessages.flatMap(message => message.attachments || []);

      const storyIntent = detectSlowBurnStoryIntent({
        text: conversationText,
        attachments: burstAttachments,
        appMode: appModeRef.current,
        activeStory,
      });

      let finalExternalContext = boostContext.externalContext;
      let finalRouteInstruction = compileConversationRouteInstruction(routeClassification);
      let dynamicsInstruction: string | undefined;

      if (storyIntent.isStory) {
        const slowBurnInstruction = compileSlowBurnStoryInstruction({
          intent: storyIntent,
          activeStory,
          botName: currentChat.settings.botName,
        });
        finalExternalContext = finalExternalContext
          ? `${finalExternalContext}\n\n${slowBurnInstruction}`
          : slowBurnInstruction;
        finalRouteInstruction = compileConversationRouteInstruction({
          id: 'slow-burn-story',
          label: 'Slow Burn Story',
          summary: 'The user wants a deep, atmospheric story or is engaging with an active narrative.',
          firstPriority: 'Build the scene with rich sensory detail, realistic pacing, and gradual suspense.',
          secondPriority: 'Stay in authentic character voice and deliver through engaging WhatsApp bursts (|||).',
          avoid: 'Do not rush the plot, give superficial summaries, or end prematurely.',
        });
      } else if (appModeRef.current === AppMode.CHAT && !currentChat.isGroup) {
        const continuityCues = currentChat.continuityState
          ? selectContinuityContext(currentChat.continuityState, new Date())
          : continuityContextRef.current;
        const continuityInstruction = compileContinuityContextInstruction(continuityCues);
        if (continuityInstruction) {
          finalExternalContext = finalExternalContext
            ? `${finalExternalContext}\n\n${continuityInstruction}`
            : continuityInstruction;
        }

        // Deterministic conversation-dynamics layer: decides relational move and reply shape
        // before the LLM generates wording. Fail-safe — never blocks generation.
        try {
          const historyForDynamics = burst.historyMessages.map(message => ({
            role: message.role === MessageRole.USER ? 'user' : 'model',
            parts: [{ text: message.text }],
          }));
          const dynamicsResult = resolveConversationDynamics({
            messageText: conversationText,
            routeId: routeClassification.id,
            replyContextText: lastMessage.replyTo?.text,
            recentHistory: historyForDynamics,
            continuityState: currentChat.continuityState ?? null,
            psychology: evolvedPsych,
            settings: currentChat.settings,
            callbackBudgetAvailable: true,
          });
          if (dynamicsResult.dynamicsInstruction) {
            dynamicsInstruction = dynamicsResult.dynamicsInstruction;
          }
        } catch (err) {
          console.warn('[ChatController] Dynamics resolution skipped:', err);
        }
      }

      const history = burst.historyMessages.map(message => ({
        role: message.role === MessageRole.USER ? 'user' : 'model',
        parts: [{ text: message.text }],
      }));
      const recentAssistantReplies = burst.historyMessages
        .filter(message => message.role === MessageRole.MODEL)
        .slice(-6)
        .map(message => message.text);

      if (appModeRef.current === AppMode.STUDIO) {
        const result = await GeminiService.generateStudioImage(
          lastMessage.text || '',
          studioConfigRef.current,
          undefined,
          { visualSeed: currentChat.settings.visualSeed, mood: evolvedPsych.mood },
        );
        lease.throwIfStale();
        await addBotMessage(result.description, undefined, [{
          file: new File([], 'studio-image.png'),
          mimeType: 'image/png',
          previewUrl: result.imageUrl,
          base64: result.imageUrl.split(',')[1],
          fileName: 'studio-image.png',
          category: 'image',
        }], evolvedPsych, currentChat, undefined, lease);
        return;
      }

      const preparedAttachments = await prepareAttachmentsForAi(burstAttachments, {
        chatId: currentChat.id,
        signal: lease.signal,
      });
      lease.throwIfStale();
      const skippedAttachmentNotice = describeSkippedAiAttachments(preparedAttachments.skipped);
      const combinedPrompt = [burst.combinedText, skippedAttachmentNotice].filter(Boolean).join('\n\n');

      const botMessageId = crypto.randomUUID();
      addMessage({
        id: botMessageId,
        chatId: currentChat.id,
        role: MessageRole.MODEL,
        senderId: currentChat.id,
        text: '',
        timestamp: new Date(),
      });

      let accumulatedText = '';
      let hasFirstToken = false;
      let streamResult: { text: string; urls: any[]; toolsUsed?: any[] } = {
        text: '',
        urls: [],
        toolsUsed: [],
      };

      try {
        streamResult = await GeminiService.sendMessageToGeminiStream(
          (chunk: string) => {
            if (!lease.isCurrent()) return;
            accumulatedText += chunk;
            if (!hasFirstToken) {
              hasFirstToken = true;
              setChatTyping(currentChat.id, false);
            }
            if (!streamThrottleRef.current) {
              streamThrottleRef.current = window.setTimeout(() => {
                streamThrottleRef.current = null;
                if (!lease.isCurrent()) return;
                const sanitized = sanitizePersonaReply(accumulatedText, {
                  botBio: currentChat.settings.botBio,
                });
                const guarded = removeRepeatedAssistantBubbles(sanitized, recentAssistantReplies);
                const previewText = guarded === 'قولّي أكتر' && guarded !== accumulatedText ? '' : guarded;
                const currentMessages = useRafiqStore.getState().messagesByChat[currentChat.id] || [];
                setMessages(currentChat.id, currentMessages.map(message => (
                  message.id === botMessageId ? { ...message, text: previewText } : message
                )));
              }, 80);
            }
          },
          history,
          combinedPrompt,
          preparedAttachments.attachments,
          true,
          currentChat.settings,
          currentUserProfile,
          evolvedPsych,
          undefined,
          finalExternalContext,
          undefined,
          boostContext.allowSearch,
          finalRouteInstruction,
          currentChat.id,
          dynamicsInstruction,
          GeminiService.createGeminiStreamRequestOptions(lease.signal),
        );
        lease.throwIfStale();
      } catch (error) {
        if (isAbortLikeError(error)) throw error;
        console.error('[ChatController] Streaming failed:', error);
        accumulatedText ||= 'معلش الشبكة وقفت لحظة، ابعت الرسالة تاني';
      } finally {
        if (streamThrottleRef.current) {
          window.clearTimeout(streamThrottleRef.current);
          streamThrottleRef.current = null;
        }
        if (lease.isCurrent()) removeMessage(currentChat.id, botMessageId);
      }

      const text = removeRepeatedAssistantBubbles(
        collapseFragmentedReply(accumulatedText || streamResult.text),
        recentAssistantReplies,
      ) || 'قولّي أكتر';
      const parts = text.includes('|||')
        ? text.split('|||').map(part => part.trim()).filter(Boolean)
        : [text];

      for (let index = 0; index < parts.length; index++) {
        lease.throwIfStale();
        const isLast = index === parts.length - 1;
        if (index > 0) {
          const wordsCount = parts[index].split(/\s+/).length;
          await delay(Math.min(Math.max(wordsCount * 80, 1000), 3000), lease);
        }
        await addBotMessage(
          parts[index],
          isLast ? streamResult.urls : undefined,
          undefined,
          evolvedPsych,
          currentChat,
          isLast ? streamResult.toolsUsed : undefined,
          lease,
        );
      }

      if (storyIntent.isStory && (accumulatedText || streamResult.text)) {
        const storyOutput = accumulatedText || streamResult.text;
        if (storyIntent.isContinuation && activeStory) {
          const advanced = advanceStoryState(activeStory, storyOutput.slice(0, 300));
          void DB.saveActiveStory(advanced);
          useRafiqStore.getState().setActiveStory(currentChat.id, advanced);
        } else {
          const initial = createInitialStoryState({
            chatId: currentChat.id,
            title: lastMessage.text || (storyIntent.hasMediaInspiration ? 'حكاية مستوحاة من المشهد' : 'قصة متأنية'),
            genre: storyIntent.genre,
            premise: storyOutput.slice(0, 300),
            mediaTriggerSummary: storyIntent.hasMediaInspiration ? 'مستوحاة من وسائط بصرية' : undefined,
          });
          void DB.saveActiveStory(initial);
          useRafiqStore.getState().setActiveStory(currentChat.id, initial);
        }
      } else if (!storyIntent.isStory && appModeRef.current === AppMode.CHAT && !currentChat.isGroup) {
        try {
          const liveChat = useRafiqStore.getState().chats.find(c => c.id === currentChat.id);
          const dbChat = await DB.getChatSession(currentChat.id);
          const settledChat = dbChat
            ? { ...dbChat, psychology: liveChat?.psychology ?? dbChat.psychology }
            : liveChat;
          if (settledChat) {
            const settledMessages = await DB.getMessagesForChat(settledChat.id, 30);
            const settledResult = await continuityCoordinator.onConversationSettled({
              chat: settledChat,
              messages: settledMessages,
            });
            if (settledResult.changed) {
              const live = useRafiqStore.getState().chats.find(c => c.id === settledChat.id);
              useRafiqStore.getState().updateChat({
                ...(live ?? settledResult.chat),
                continuityState: settledResult.chat.continuityState,
              });
            }
            continuityContextRef.current = settledResult.context;
          }
        } catch (error) {
          console.warn('[ChatController] Settled continuity reflection failed:', error);
        }
      }
    } catch (error) {
      if (!isAbortLikeError(error) && lease.isCurrent()) {
        console.error('[ChatController] Bot response failed:', error);
        await addBotMessage(
          'معلش الاتصال وقف، جرّب تبعت الرسالة تاني',
          undefined,
          undefined,
          evolvedPsych,
          currentChat,
          undefined,
          lease,
        );
      }
    } finally {
      if (lease.isCurrent()) {
        useRafiqStore.getState().setChatTyping(currentChat.id, false);
        if (appModeRef.current !== AppMode.STUDIO) setAppMode(AppMode.CHAT);
      }
    }
  };

  const handleSend = async (overrideText?: string) => {
    const messageText = overrideText ?? input;
    if (attachmentUploadsRef.current.length > 0) {
      showToast('استنى لحد ما رفع المرفقات يكتمل', 'error');
      return;
    }
    if ((!messageText.trim() && stagedAttachments.length === 0) || !chat) return;

    const messageId = crypto.randomUUID();
    let persistentAttachments: Attachment[] = [];
    try {
      persistentAttachments = await finalizeComposerAttachments({
        staged: stagedAttachments,
        messageId,
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'تعذر تجهيز المرفقات');
      return;
    }

    const userMessage: ChatMessage = {
      id: messageId,
      chatId: chat.id,
      role: MessageRole.USER,
      text: messageText,
      attachments: persistentAttachments,
      timestamp: new Date(),
      replyTo: replyingTo ? {
        id: replyingTo.id,
        text: replyingTo.text,
        senderName: replyingTo.role === MessageRole.USER ? 'You' : chat.settings.botName,
        senderId: replyingTo.senderId || 'user',
      } : undefined,
    };

    addMessage(userMessage);
    setInput('');
    setReplyingTo(null);
    setStagedAttachments([]);
    stagedAttachmentsRef.current = [];
    releaseComposerAttachments(stagedAttachments);
    setChatTyping(chat.id, true);

    await DB.saveMessage(userMessage);
    await indexBoostMemoryMessage(chat, userMessage);

    if (responseTimerRef.current) clearTimeout(responseTimerRef.current);
    const lease = generationGuardRef.current.begin();
    responseTimerRef.current = setTimeout(() => {
      responseTimerRef.current = null;
      if (lease.isCurrent()) void processBotResponse();
    }, 1500);
  };

  const requestSelfie = async (action: ConfirmedSelfieAction) => {
    if (!chat) return;
    const request = createConfirmedSelfieRequest(action);
    const key = request.idempotencyKey!;
    if (pendingSelfiesRef.current.has(key) || completedSelfiesRef.current.has(key)) return;

    pendingSelfiesRef.current.add(key);
    const lease = generationGuardRef.current.begin();
    try {
      const history = (await DB.getMessagesForChat(chat.id, RESPONSE_HISTORY_LIMIT)).map(message => ({
        role: message.role === MessageRole.USER ? 'user' : 'model',
        parts: [{ text: message.text }],
      }));
      lease.throwIfStale();
      const plan = await GeminiService.buildAvatarImagePrompt(
        chat.settings,
        history,
        request.prompt,
        chat.psychology?.mood || BotMood.NEUTRAL,
        request.subIntent,
      );
      lease.throwIfStale();
      const imageData = await GeminiService.generateSelfie(
        chat.settings.avatarUrl,
        plan.finalPrompt,
        { visualSeed: chat.settings.visualSeed, mood: chat.psychology?.mood || BotMood.NEUTRAL },
      );
      lease.throwIfStale();
      await addBotMessage(plan.shortCaption || '', undefined, [{
        file: new File([], 'selfie.png'),
        mimeType: 'image/png',
        previewUrl: imageData,
        base64: imageData.split(',')[1],
        fileName: 'selfie.png',
        category: 'image',
      }], chat.psychology, chat, undefined, lease);
      completedSelfiesRef.current.add(key);
    } catch (error) {
      if (!isAbortLikeError(error)) {
        console.error('[ChatController] Explicit selfie failed:', error);
        showToast('الصورة ما اكتملتش، جرّب مرة تانية');
      }
    } finally {
      pendingSelfiesRef.current.delete(key);
    }
  };

  const addAttachment = async (file: File) => {
    if (!chat) return;
    const attachmentId = crypto.randomUUID();
    const controller = new AbortController();
    attachmentUploadControllersRef.current.set(attachmentId, controller);
    replaceAttachmentUploads(current => [...current, {
      id: attachmentId,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      fileSize: file.size,
      progress: 0,
    }]);

    try {
      const staged = await stageComposerAttachment({
        chatId: chat.id,
        file,
        attachmentId,
        currentCount: stagedAttachmentsRef.current.length + attachmentUploadsRef.current.length - 1,
        signal: controller.signal,
        onProgress: progress => {
          replaceAttachmentUploads(current => current.map(upload => (
            upload.id === attachmentId ? { ...upload, progress } : upload
          )));
        },
      });
      if (controller.signal.aborted) {
        staged.revokePreview();
        await attachmentRepository.remove(attachmentId);
        return;
      }
      const next = [...stagedAttachmentsRef.current, staged];
      stagedAttachmentsRef.current = next;
      setStagedAttachments(next);
    } catch (error) {
      await attachmentRepository.remove(attachmentId);
      if (!isAbortLikeError(error)) {
        showToast(error instanceof Error ? error.message : 'تعذر حفظ الملف محليًا');
      }
    } finally {
      attachmentUploadControllersRef.current.delete(attachmentId);
      replaceAttachmentUploads(current => current.filter(upload => upload.id !== attachmentId));
    }
  };

  const cancelAttachmentUpload = (attachmentId: string) => {
    attachmentUploadControllersRef.current.get(attachmentId)?.abort();
  };

  const removeComposerAttachment = async (attachmentId: string) => {
    const current = stagedAttachmentsRef.current.find(attachment => attachment.attachmentId === attachmentId);
    if (!current) return;
    const next = stagedAttachmentsRef.current.filter(attachment => attachment.attachmentId !== attachmentId);
    stagedAttachmentsRef.current = next;
    setStagedAttachments(next);
    current.revokePreview();
    try {
      await attachmentRepository.remove(attachmentId);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'تعذر إزالة المرفق');
    }
  };

  const addAttachments = async (files: File[]) => {
    for (const file of files) await addAttachment(file);
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) {
      await addAttachments(Array.from(event.target.files));
      event.target.value = '';
    }
  };

  const handleFileDrop = async (files: FileList | File[]) => {
    await addAttachments(Array.from(files));
  };

  const handleChatExport = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.[0] || !chat) return;
    const file = event.target.files[0];
    const lease = generationGuardRef.current.begin();
    const reader = new FileReader();

    reader.onload = async loadEvent => {
      if (!lease.isCurrent()) return;
      setChatTyping(chat.id, true);
      try {
        const text = String(loadEvent.target?.result || '');
        const profile = await GeminiService.analyzeChatExport(text, chat.settings.botName);
        lease.throwIfStale();
        const updatedChat = await DB.patchChatSession(chat.id, {
          settings: { impersonationProfile: profile },
        });
        lease.throwIfStale();
        if (!updatedChat) throw new Error('Chat not found');
        updateChat(updatedChat);
        await addBotMessage('قريت الشات وجاهز', undefined, undefined, chat.psychology, updatedChat, undefined, lease);
      } catch (error) {
        if (!isAbortLikeError(error)) {
          await addBotMessage('مش قادر أقرأ الملف ده', undefined, undefined, undefined, chat, undefined, lease);
        }
      } finally {
        if (lease.isCurrent()) setChatTyping(chat.id, false);
      }
    };
    reader.onerror = () => {
      if (lease.isCurrent()) {
        setChatTyping(chat.id, false);
        showToast('تعذر قراءة الملف');
      }
    };
    lease.signal.addEventListener('abort', () => reader.abort(), { once: true });
    reader.readAsText(file);
  };

  useEffect(() => {
    const bridge = useComposerAttachmentUiStore.getState();
    bridge.setSnapshot({
      chatId,
      uploads: attachmentUploads,
      attachments: composerAttachments,
      cancelUpload: cancelAttachmentUpload,
      removeAttachment: removeComposerAttachment,
    });
    return () => useComposerAttachmentUiStore.getState().clear(chatId);
  }, [chatId, attachmentUploads, composerAttachments]);

  return {
    chat,
    messages,
    input,
    setInput,
    isTyping,
    scrollRef,
    appMode,
    setAppMode,
    studioConfig,
    setStudioConfig,
    attachments,
    composerAttachments,
    attachmentUploads,
    replyingTo,
    setReplyingTo,
    handleSend,
    requestSelfie,
    selectedModel,
    setSelectedModel,
    selectedThinkingLevel,
    setSelectedThinkingLevel,
    handleFile,
    handleFileDrop,
    addAttachment,
    cancelAttachmentUpload,
    removeComposerAttachment,
    handleChatExport,
    activeStory: useRafiqStore(state => state.activeStories[chatId]) || null,
    clearActiveStory: async () => {
      await DB.clearActiveStory(chatId);
      useRafiqStore.getState().setActiveStory(chatId, null);
    },
    continueStory: async (cue = 'كمل') => {
      await handleSend(cue);
    },
  };
};
