import React, { useCallback, useEffect, useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  getNextStoryPosition,
  getPreviousStoryPosition,
  type StoryPosition,
} from '../services/storyNavigation.js';

export interface Story {
  id: string;
  text: string;
  backgroundColor: string;
  textColor: string;
  createdAt: string;
}

export interface StatusItem {
  id: string;
  name: string;
  avatarUrl?: string;
  stories: Story[];
}

interface StatusViewerProps {
  statuses: StatusItem[];
  initialStatusIndex: number;
  onClose: () => void;
}

const STORY_DURATION_MS = 5000;
const PROGRESS_STEP_MS = 50;

const StatusViewer: React.FC<StatusViewerProps> = ({
  statuses,
  initialStatusIndex,
  onClose,
}) => {
  const [position, setPosition] = useState<StoryPosition>({
    statusIndex: Math.max(0, Math.min(statuses.length - 1, initialStatusIndex)),
    storyIndex: 0,
  });
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const activeStatus = statuses[position.statusIndex];
  const activeStory = activeStatus?.stories[position.storyIndex];

  useEffect(() => {
    setPosition({
      statusIndex: Math.max(0, Math.min(statuses.length - 1, initialStatusIndex)),
      storyIndex: 0,
    });
    setProgress(0);
  }, [initialStatusIndex, statuses.length]);

  const handleNextStory = useCallback(() => {
    const next = getNextStoryPosition(statuses, position);
    setProgress(0);
    if (next.reachedEnd) {
      onClose();
      return;
    }
    setPosition(next.position);
  }, [onClose, position, statuses]);

  const handlePreviousStory = useCallback(() => {
    setProgress(0);
    setPosition(getPreviousStoryPosition(statuses, position));
  }, [position, statuses]);

  useEffect(() => {
    if (!activeStory || isPaused) return;
    const increment = (PROGRESS_STEP_MS / STORY_DURATION_MS) * 100;
    const interval = window.setInterval(() => {
      setProgress(previous => Math.min(100, previous + increment));
    }, PROGRESS_STEP_MS);
    return () => window.clearInterval(interval);
  }, [activeStory, isPaused]);

  useEffect(() => {
    if (progress >= 100) handleNextStory();
  }, [handleNextStory, progress]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') handlePreviousStory();
      if (event.key === 'ArrowRight') handleNextStory();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleNextStory, handlePreviousStory, onClose]);

  if (!activeStatus || !activeStory) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-50 flex select-none flex-col items-center justify-center bg-[#0b141a]"
        role="dialog"
        aria-modal="true"
        aria-label={`حالة ${activeStatus.name}`}
      >
        <div
          className="relative flex h-full w-full max-w-[480px] flex-col justify-between overflow-hidden shadow-2xl"
          style={{ backgroundColor: activeStory.backgroundColor || '#075e54' }}
        >
          <div className="absolute inset-x-0 top-4 z-30 flex gap-1 px-3" aria-hidden="true">
            {activeStatus.stories.map((story, index) => {
              const widthPercent = index < position.storyIndex
                ? 100
                : index === position.storyIndex
                  ? progress
                  : 0;
              return (
                <div key={story.id} className="h-[2.5px] flex-1 overflow-hidden rounded-full bg-white/30">
                  <div className="h-full bg-white transition-all duration-75" style={{ width: `${widthPercent}%` }} />
                </div>
              );
            })}
          </div>

          <header className="absolute inset-x-0 top-8 z-30 flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="grid min-h-11 min-w-11 place-items-center rounded-full text-white transition-colors hover:bg-white/10"
                aria-label="الرجوع"
              >
                <ChevronRight size={24} aria-hidden="true" />
              </button>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10">
                {activeStatus.avatarUrl ? (
                  <img src={activeStatus.avatarUrl} alt={activeStatus.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-[#008069] text-lg font-bold text-white">
                    {activeStatus.name.charAt(0)}
                  </span>
                )}
              </div>
              <div className="flex flex-col text-right">
                <span className="text-sm font-semibold leading-tight text-white">{activeStatus.name}</span>
                <span className="mt-0.5 text-[11px] text-white/70">{activeStory.createdAt}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onPointerDown={() => setIsPaused(true)}
                onPointerUp={() => setIsPaused(false)}
                onPointerCancel={() => setIsPaused(false)}
                onPointerLeave={() => setIsPaused(false)}
                className="min-h-11 rounded-full bg-black/20 px-3 text-xs text-white/80 backdrop-blur-sm hover:text-white"
                aria-pressed={isPaused}
              >
                {isPaused ? 'متوقف مؤقتًا' : 'اضغط للتثبيت'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="grid min-h-11 min-w-11 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="إغلاق"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
          </header>

          <main className="relative flex flex-1 items-center justify-center px-8 py-20 text-center">
            <p
              className="max-w-full select-text whitespace-pre-wrap font-sans text-2xl font-medium leading-relaxed selection:bg-white/30 md:text-3xl"
              style={{ color: activeStory.textColor || '#ffffff' }}
            >
              {activeStory.text}
            </p>
          </main>

          <footer className="z-30 flex h-[70px] shrink-0 items-center justify-center border-t border-white/5 bg-black/20 px-4 backdrop-blur-sm">
            <span className="font-sans text-xs tracking-wide text-white/60">رفيق • الحالات</span>
          </footer>

          <button
            type="button"
            className="absolute inset-y-24 left-0 z-10 w-[80px] cursor-w-resize border-none bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={handlePreviousStory}
            aria-label="الحالة السابقة"
          />
          <button
            type="button"
            className="absolute inset-y-24 right-0 z-10 w-[80px] cursor-e-resize border-none bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={handleNextStory}
            aria-label="الحالة التالية"
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default StatusViewer;
