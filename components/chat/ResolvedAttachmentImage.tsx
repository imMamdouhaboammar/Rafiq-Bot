import React from 'react';
import { Download, ImageOff, Loader2 } from 'lucide-react';
import type { Attachment } from '../../types.js';
import { useResolvedAttachmentUrl } from '../../hooks/useResolvedAttachmentUrl.js';

interface ResolvedAttachmentImageProps {
  attachment: Attachment;
  index: number;
}

const downloadImage = (url: string, fileName: string) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
};

const ResolvedAttachmentImage: React.FC<ResolvedAttachmentImageProps> = ({ attachment, index }) => {
  const resolved = useResolvedAttachmentUrl(attachment.previewUrl);
  const fileName = attachment.fileName || `image-${index + 1}.png`;

  if (resolved.loading) {
    return (
      <div className="grid min-h-32 min-w-48 place-items-center rounded-lg bg-black/5 text-[#667781]" role="status" aria-label={`جاري تحميل ${fileName}`}>
        <Loader2 size={22} className="animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (!resolved.url || resolved.error) {
    return (
      <div className="flex min-h-28 min-w-48 flex-col items-center justify-center gap-2 rounded-lg bg-black/5 px-4 text-center text-xs text-[#667781]" role="alert">
        <ImageOff size={22} aria-hidden="true" />
        <span>الصورة غير متاحة على هذا الجهاز</span>
      </div>
    );
  }

  return (
    <div className="group/image relative overflow-hidden rounded-lg bg-black/5">
      <button
        type="button"
        onClick={() => window.open(resolved.url, '_blank', 'noopener,noreferrer')}
        className="block max-w-full cursor-zoom-in"
        aria-label={`فتح ${fileName}`}
      >
        <img src={resolved.url} alt={fileName} className="h-auto max-w-full object-cover" />
      </button>
      {attachment.fileName?.startsWith('studio-') ? (
        <span className="absolute right-2 top-2 rounded-full bg-[#7c3aed]/85 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur">
          Studio
        </span>
      ) : null}
      <button
        type="button"
        onClick={event => {
          event.stopPropagation();
          downloadImage(resolved.url!, fileName);
        }}
        className="absolute bottom-1 right-1 grid min-h-11 min-w-11 place-items-center rounded-full bg-black/55 text-white opacity-0 transition-opacity hover:bg-black/70 focus:opacity-100 group-hover/image:opacity-100"
        aria-label="تنزيل الصورة"
      >
        <Download size={16} aria-hidden="true" />
      </button>
    </div>
  );
};

export default ResolvedAttachmentImage;
