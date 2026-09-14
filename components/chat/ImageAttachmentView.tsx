import React from 'react';
import { Download, ImageOff, LoaderCircle } from 'lucide-react';
import { useResolvedAttachmentUrl } from '../../hooks/useResolvedAttachmentUrl.js';

interface ImageAttachmentViewProps {
  previewUrl: string;
  fileName?: string;
  studio?: boolean;
}

const downloadImage = (url: string, fileName: string): void => {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
};

const ImageAttachmentView: React.FC<ImageAttachmentViewProps> = ({
  previewUrl,
  fileName,
  studio = false,
}) => {
  const resolved = useResolvedAttachmentUrl(previewUrl);

  if (resolved.loading) {
    return (
      <div className="grid min-h-40 place-items-center rounded-lg bg-black/5 text-gray-500" role="status" aria-label="جاري تحميل الصورة المحلية">
        <LoaderCircle size={24} className="animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (!resolved.url) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg bg-black/5 px-4 text-center text-xs text-gray-500" role="status">
        <ImageOff size={24} aria-hidden="true" />
        <span>{resolved.error || 'الصورة غير موجودة على هذا الجهاز'}</span>
      </div>
    );
  }

  return (
    <div className="group/image relative overflow-hidden rounded-lg bg-black/5">
      <button
        type="button"
        onClick={() => window.open(resolved.url, '_blank', 'noopener,noreferrer')}
        className="block max-w-full cursor-zoom-in"
        aria-label={`فتح ${fileName || 'الصورة'}`}
      >
        <img
          src={resolved.url}
          alt={fileName || 'مرفق صورة'}
          className="h-auto max-w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </button>
      {studio ? (
        <span className="absolute right-2 top-2 rounded-full bg-[#7c3aed]/85 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur">
          Studio
        </span>
      ) : null}
      <button
        type="button"
        onClick={event => {
          event.stopPropagation();
          downloadImage(resolved.url!, fileName || 'image.png');
        }}
        className="absolute bottom-1 right-1 grid min-h-11 min-w-11 place-items-center rounded-full bg-black/55 text-white opacity-0 transition-opacity hover:bg-black/70 focus:opacity-100 group-hover/image:opacity-100"
        aria-label="تنزيل الصورة"
      >
        <Download size={16} aria-hidden="true" />
      </button>
    </div>
  );
};

export default ImageAttachmentView;
