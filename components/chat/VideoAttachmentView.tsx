import React, { useState } from 'react';
import { AlertTriangle, LoaderCircle, VideoOff } from 'lucide-react';
import { useResolvedAttachmentUrl } from '../../hooks/useResolvedAttachmentUrl.js';

interface VideoAttachmentViewProps {
  previewUrl: string;
  fileName?: string;
}

const VideoAttachmentView: React.FC<VideoAttachmentViewProps> = ({ previewUrl, fileName }) => {
  const resolved = useResolvedAttachmentUrl(previewUrl);
  const [codecError, setCodecError] = useState<string>();

  if (resolved.loading) {
    return (
      <div className="grid min-h-48 place-items-center rounded-lg bg-black/5 text-gray-500" role="status" aria-label="جاري تحميل الفيديو المحلي">
        <LoaderCircle size={24} className="animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (!resolved.url) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg bg-black/5 px-4 text-center text-xs text-gray-500" role="status">
        <VideoOff size={26} aria-hidden="true" />
        <span>{resolved.error || 'الفيديو غير موجود على هذا الجهاز'}</span>
      </div>
    );
  }

  if (codecError) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg bg-amber-50 px-4 text-center text-xs leading-5 text-amber-800" role="alert">
        <AlertTriangle size={24} aria-hidden="true" />
        <span>{codecError}</span>
      </div>
    );
  }

  return (
    <video
      src={resolved.url}
      controls
      preload="metadata"
      playsInline
      className="max-h-[480px] w-full rounded-lg bg-black"
      aria-label={fileName || 'مرفق فيديو'}
      onError={event => {
        const mediaError = event.currentTarget.error;
        const reason = mediaError?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
          ? 'المتصفح لا يدعم codec هذا الفيديو. الملف ما زال محفوظًا محليًا ويمكن تنزيله أو فتحه ببرنامج آخر'
          : 'تعذر تشغيل الفيديو المحلي في هذا المتصفح';
        setCodecError(reason);
      }}
    >
      المتصفح لا يدعم تشغيل الفيديو
    </video>
  );
};

export default VideoAttachmentView;
