import { useState, useEffect } from 'react';
import { useRafiqStore } from '../stores/useRafiqStore.js';
import * as DB from '../services/db.js';
import * as GeminiService from '../services/geminiService.js';
import { eventBus } from '../services/eventBus.js';
import { MessageRole } from '../types.js';

export const useAppController = () => {
  const [isLoading, setIsLoading] = useState(true);
  const { setUserProfile, setChats, addMessage } = useRafiqStore();

  useEffect(() => {
    let cancelled = false;

    const runBackgroundStartupWork = async (loadedChats: any[], loadedProfile: any) => {


      const now = new Date();
      let updated = false;

      const simulatedChats = await Promise.all(loadedChats.map(async (c) => {
          if (!c.psychology) return c;
          
          const lastInteraction = c.psychology.lastInteractionTime 
              ? new Date(c.psychology.lastInteractionTime) 
              : new Date();
              
          const hoursOffline = (now.getTime() - lastInteraction.getTime()) / 36e5;
          
          if (hoursOffline > 4 && Math.random() < 0.1 && !c.isGroup) {
              const msgText = await GeminiService.generateInitiativeMessage(c.settings, loadedProfile, c.psychology);
              
              if (msgText) {
                  c.lastMessage = msgText;
                  c.lastMessageTimestamp = new Date();
                  c.unreadCount = (c.unreadCount || 0) + 1;
                  c.psychology.lastInteractionTime = new Date();
                  
                  const autoMsg = { 
                      id: 'auto-' + Date.now(), 
                      chatId: c.id, 
                      role: MessageRole.MODEL, 
                      senderId: c.id, 
                      text: msgText, 
                      timestamp: new Date() 
                  };
                  
                  await DB.saveMessage(autoMsg);
                  eventBus.emit('chat:new_message', { message: autoMsg });
                  updated = true;
              }
          }
          return c;
      }));

      if (cancelled || !updated) return;

      await Promise.all(simulatedChats.map(c => DB.saveChatSession(c)));
      if (cancelled) return;
      setChats(simulatedChats);

    };

    const init = async () => {
      try {
        const loadedProfile = await DB.getUserProfile();
        if (cancelled) return;
        const proProfile = loadedProfile
          ? { ...loadedProfile, isPro: true, tier: 'pro' as const }
          : null;
        setUserProfile(proProfile);
        
        const loadedChats = await DB.getChatSessions();
        if (cancelled) return;
        const proChats = loadedChats.map(chat => ({
          ...chat,
          psychology: chat.psychology ? {
            ...chat.psychology,
            isPro: true,
            tier: 'pro' as const,
          } : chat.psychology,
        }));
        setChats(proChats);
        setIsLoading(false);
        eventBus.emit('system:online_status', { isOnline: true });
        runBackgroundStartupWork(proChats, proProfile);

      } catch (err: any) {
        console.error(err);
        eventBus.emitError('AppInit', err);
        setIsLoading(false);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, []); // Run once on mount

  return { isLoading };
};
