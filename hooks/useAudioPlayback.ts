import { useCallback, useEffect, useRef, useState } from 'react';

export const useAudioPlayback = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sourceRef = useRef<string | null>(null);
  const listenerCleanupRef = useRef<(() => void) | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const release = useCallback(() => {
    listenerCleanupRef.current?.();
    listenerCleanupRef.current = null;

    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    audioRef.current = null;
    sourceRef.current = null;
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  const ensureAudio = useCallback((source: string): HTMLAudioElement => {
    if (audioRef.current && sourceRef.current === source) return audioRef.current;
    release();

    const audio = new Audio(source);
    const syncTiming = () => {
      const nextDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
      setCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
      setDuration(nextDuration);
      setProgress(nextDuration ? audio.currentTime / nextDuration : 0);
    };
    const handleEnded = () => {
      syncTiming();
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };
    const handleError = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener('loadedmetadata', syncTiming);
    audio.addEventListener('durationchange', syncTiming);
    audio.addEventListener('timeupdate', syncTiming);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    listenerCleanupRef.current = () => {
      audio.removeEventListener('loadedmetadata', syncTiming);
      audio.removeEventListener('durationchange', syncTiming);
      audio.removeEventListener('timeupdate', syncTiming);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
    audioRef.current = audio;
    sourceRef.current = source;
    return audio;
  }, [release]);

  const toggle = useCallback(async (source: string) => {
    const audio = ensureAudio(source);
    if (!audio.paused) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  }, [ensureAudio]);

  useEffect(() => release, [release]);

  return {
    isPlaying,
    progress,
    currentTime,
    duration,
    toggle,
    stop: release,
  };
};
