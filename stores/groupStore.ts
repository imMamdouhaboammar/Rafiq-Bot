
import { create } from 'zustand';
import { ChatMessage, Reaction } from '../types';

interface GroupState {
  activeGroupId: string | null;
  messages: Record<string, ChatMessage[]>;
  typingPersonas: Record<string, string[]>; // groupId -> [personaName, personaName]

  // Actions
  setActiveGroup: (id: string | null) => void;
  addGroupMessage: (groupId: string, message: ChatMessage) => void;
  addReaction: (groupId: string, messageId: string, reaction: Reaction) => void;
  removeGroupMessage: (groupId: string, messageId: string) => void;
  setGroupMessages: (groupId: string, messages: ChatMessage[]) => void;
  setTyping: (groupId: string, personaName: string, isTyping: boolean) => void;
}

export const useGroupStore = create<GroupState>((set) => ({
  activeGroupId: null,
  messages: {},
  typingPersonas: {},

  setActiveGroup: (id) => set({ activeGroupId: id }),

  addGroupMessage: (groupId, message) => set((state) => ({
    messages: {
      ...state.messages,
      [groupId]: (state.messages[groupId] || []).some(existing => existing.id === message.id)
        ? state.messages[groupId]
        : [...(state.messages[groupId] || []), message]
    }
  })),

  addReaction: (groupId, messageId, reaction) => set((state) => {
      const groupMsgs = state.messages[groupId] || [];
      const updatedMsgs = groupMsgs.map(msg => {
          if (msg.id === messageId) {
              const currentReactions = msg.reactions || [];
              // Prevent duplicate reaction from same user? Maybe allow updating.
              const otherReactions = currentReactions.filter(r => r.senderId !== reaction.senderId);
              return { ...msg, reactions: [...otherReactions, reaction] };
          }
          return msg;
      });
      
      return {
          messages: {
              ...state.messages,
              [groupId]: updatedMsgs
          }
      };
  }),

  removeGroupMessage: (groupId, messageId) => set((state) => ({
    messages: {
      ...state.messages,
      [groupId]: (state.messages[groupId] || []).filter(message => message.id !== messageId),
    },
  })),

  setGroupMessages: (groupId, messages) => set((state) => {
    const mergedById = new Map<string, ChatMessage>();
    for (const message of [...messages, ...(state.messages[groupId] || [])]) {
      mergedById.set(message.id, message);
    }

    return {
      messages: {
        ...state.messages,
        [groupId]: [...mergedById.values()].sort(
          (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
        )
      }
    };
  }),

  setTyping: (groupId, personaName, isTyping) => set((state) => {
    const currentTyping = state.typingPersonas[groupId] || [];
    const newTyping = isTyping 
        ? [...currentTyping, personaName]
        : currentTyping.filter(name => name !== personaName);
    
    return {
        typingPersonas: {
            ...state.typingPersonas,
            [groupId]: [...new Set(newTyping)] // Unique names
        }
    };
  })
}));
