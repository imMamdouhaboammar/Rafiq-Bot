import { create } from 'zustand';
import type {
  ActiveStoryState,
  ChatMessage,
  ChatSession,
  RandomPrompt,
  UserProfile,
} from '../types.js';
import { attachmentRepository } from '../services/attachmentRepository.js';

interface RafiqState {
  userProfile: UserProfile | null;
  chats: ChatSession[];
  activeChatId: string | null;
  messagesByChat: Record<string, ChatMessage[]>;
  typingByChat: Record<string, boolean>;
  randomPrompts: RandomPrompt[];
  activeStories: Record<string, ActiveStoryState | null>;
  setUserProfile: (profile: UserProfile | null) => void;
  setChats: (chats: ChatSession[]) => void;
  updateChat: (updatedChat: ChatSession) => void;
  updateChatPreview: (chatId: string, lastMessage: string, timestamp: Date) => void;
  addChat: (newChat: ChatSession) => void;
  removeChat: (chatId: string) => void;
  setActiveChatId: (id: string | null) => void;
  setMessages: (chatId: string, messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  setChatTyping: (chatId: string, isTyping: boolean) => void;
  removeMessage: (chatId: string, messageId: string) => void;
  setRandomPrompts: (prompts: RandomPrompt[]) => void;
  addRandomPrompt: (prompt: RandomPrompt) => void;
  updateRandomPrompt: (prompt: RandomPrompt) => void;
  removeRandomPrompt: (promptId: string) => void;
  setActiveStory: (chatId: string, story: ActiveStoryState | null) => void;
}

export const useRafiqStore = create<RafiqState>((set) => ({
  userProfile: null,
  chats: [],
  activeChatId: null,
  messagesByChat: {},
  typingByChat: {},
  randomPrompts: [],
  activeStories: {},

  setUserProfile: profile => set({ userProfile: profile }),

  setChats: chats => set({ chats }),

  updateChat: updatedChat => set(state => ({
    chats: state.chats.map(chat => chat.id === updatedChat.id ? updatedChat : chat)
      .sort((left, right) => (
        (right.lastMessageTimestamp?.getTime() || 0) - (left.lastMessageTimestamp?.getTime() || 0)
      )),
  })),

  updateChatPreview: (chatId, lastMessage, timestamp) => set(state => ({
    chats: state.chats
      .map(chat => chat.id === chatId
        ? { ...chat, lastMessage, lastMessageTimestamp: timestamp }
        : chat)
      .sort((left, right) => (
        (right.lastMessageTimestamp?.getTime() || 0) - (left.lastMessageTimestamp?.getTime() || 0)
      )),
  })),

  addChat: newChat => set(state => ({ chats: [newChat, ...state.chats] })),

  removeChat: chatId => set(state => ({
    chats: state.chats.filter(chat => chat.id !== chatId),
    activeChatId: state.activeChatId === chatId ? null : state.activeChatId,
    messagesByChat: Object.fromEntries(
      Object.entries(state.messagesByChat).filter(([id]) => id !== chatId),
    ),
    typingByChat: Object.fromEntries(
      Object.entries(state.typingByChat).filter(([id]) => id !== chatId),
    ),
  })),

  setActiveChatId: id => set({ activeChatId: id }),

  setMessages: (chatId, messages) => set(state => ({
    messagesByChat: {
      ...state.messagesByChat,
      [chatId]: messages,
    },
  })),

  addMessage: message => set(state => ({
    messagesByChat: {
      ...state.messagesByChat,
      [message.chatId]: [...(state.messagesByChat[message.chatId] || []), message],
    },
  })),

  setChatTyping: (chatId, isTyping) => set(state => ({
    typingByChat: {
      ...state.typingByChat,
      [chatId]: isTyping,
    },
  })),

  removeMessage: (chatId, messageId) => set(state => {
    const currentMessages = state.messagesByChat[chatId] || [];
    const removedMessage = currentMessages.find(message => message.id === messageId);
    const hasLocalAttachments = removedMessage?.attachments?.some(
      attachment => attachment.previewUrl.startsWith('opfs://'),
    );
    if (hasLocalAttachments) {
      void attachmentRepository.removeForMessage(messageId).catch(error => {
        console.error('[RafiqStore] Failed to remove message attachments:', error);
      });
    }
    return {
      messagesByChat: {
        ...state.messagesByChat,
        [chatId]: currentMessages.filter(message => message.id !== messageId),
      },
    };
  }),

  setRandomPrompts: prompts => set({ randomPrompts: prompts }),

  addRandomPrompt: prompt => set(state => ({
    randomPrompts: [...state.randomPrompts, prompt],
  })),

  updateRandomPrompt: prompt => set(state => ({
    randomPrompts: state.randomPrompts.map(item => item.id === prompt.id ? prompt : item),
  })),

  removeRandomPrompt: promptId => set(state => ({
    randomPrompts: state.randomPrompts.filter(prompt => prompt.id !== promptId),
  })),

  setActiveStory: (chatId, story) => set(state => ({
    activeStories: {
      ...state.activeStories,
      [chatId]: story,
    },
  })),
}));
