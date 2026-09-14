import React, { useMemo } from 'react';
import { Loader2, Pause, Play, VolumeX } from 'lucide-react';
import type { Attachment } from '../../types.js';
import { useAudioPlayback } from '../../hooks/useAudioPlayback.js';
import { useResolvedAttachmentUrl } from '../../hooks/useResolvedAttachmentUrl.js';

interface ResolvedAttachmentAudioProps {
  attachment: Attachment;
  messageId: string;
  senderAvatar?: string;
  isUser: boolean;
}

const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
};

const generateWaveform = (seed: string, count = 40): number[] => {
  const bars: number[] = [];
  let hash = 0;
  for (let index = 0; index < seed.length; index++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
  }
  for (let index = 0; index < count; index++) {
    hash = ((hash << 5) - hash + index * 7) | 0;
    bars.push(Math.max(3, Math.min(24, Math.abs(hash % 100) / 100 * 24)));
  }
  return bars;
};

const ResolvedAttachmentAudio: React.FC<ResolvedAttachmentAudioProps> = ({
  attachment,
  messageId,
  senderAvatar,
  isUser,
}) => {
  const resolved = useResolvedAttachmentUrl(attachment.previewUrl);
  const playback = useAudioPlayback();
  const waveformBars = useMemo(() => generateWaveform(messageId), [messageId]);

  if (resolved.loading) {
    return (
      <div className="flex min-w-[220px] items-center justify-center gap-2 px-3 py-3 text-xs text-[#667781]" role="status">
        <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        جاري تحميل التسجيل
      </div>
    );
  }

  if (!resolved.url || resolved.error) {
    return (
      <div className="flex min-w-[220px] items-center gap-2 px-3 py-3 text-xs text-[#667781]" role="alert">
        <VolumeX size={18} aria-hidden="true" />
        التسجيل غير متاح على هذا الجهاز
      </div>
    );
  }

  return (
    <>
      <div className="flex min-w-[220px] items-center gap-2 px-1 py-1 sm:min-w-[280px]">
        <button
          type="button"
          onClick={() => void playback.toggle(resolved.url!)}
          className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full text-[#54656f] hover:bg-black/5"
          aria-label={playback.isPlaying ? 'إيقاف الرسالة الصوتية مؤقتًا' : 'تشغيل الرسالة الصوتية'}
        >
          {playback.isPlaying ? <Pause size={20} fill="currentColor" aria-hidden="true" /> : <Play size={20} fill="currentColor" aria-hidden="true" />}
        </button>
        <div className="voice-waveform flex flex-1 items-center gap-[2px]" aria-hidden="true">
          {waveformBars.map((height, index) => (
            <div
              key={index}
              className={`bar ${playback.progress > 0 && index / waveformBars.length < playback.progress ? 'played' : ''}`}
              style={{ height: `${height}px` }}
            />
          ))}
        </div>
        {!isUser && senderAvatar ? (
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/30">
            <img src={senderAvatar} alt="" className="h-full w-full object-cover" />
          </div>
        ) : null}
      </div>
      <div className="-mt-0.5 mb-0.5 flex items-center gap-1 px-2">
        <span className="text-[11px] text-[#667781]">
          {formatDuration(playback.isPlaying ? playback.currentTime : playback.duration)}
        </span>
      </div>
    </>
  );
};

export default ResolvedAttachmentAudio;
