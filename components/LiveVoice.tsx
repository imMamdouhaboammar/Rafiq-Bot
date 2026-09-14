import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { PhoneOff, Mic, MicOff, Video, VideoOff, MoreHorizontal, ChevronDown, UserPlus, Volume2 } from 'lucide-react';
import { BotSettings, UserProfile } from '../types.js';
import { getSystemInstruction } from '../services/personaEngine.js';
import { eventBus } from '../services/eventBus.js';

interface LiveVoiceProps {
  onClose: () => void;
  settings: BotSettings;
  userProfile: UserProfile | null;
}

const LiveVoice: React.FC<LiveVoiceProps> = ({ onClose, settings, userProfile }) => {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'reconnecting'>('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0);

  // Audio Contexts
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<any>(null);

  useEffect(() => {
    eventBus.emit('ui:dialog', {
      title: 'الاتصال الصوتي المباشر',
      message: 'الميزة دي متأجلة مؤقتًا لأن Vertex AI لا يدعم WebSockets داخل المتصفح بالشكل المطلوب حاليًا.',
      tone: 'warning',
      confirmLabel: 'فهمت',
    });
    onClose();
  }, [onClose]);

  return null;
};

export default LiveVoice;
