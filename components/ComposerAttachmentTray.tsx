import React from 'react';
import {
  FileUp,
  Image as ImageIcon,
  Mic,
  X,
} from 'lucide-react';
import type { Attachment } from '../types.js';
import FilePreviewCard from './FilePreviewCard.js';

export interface ComposerAttachmentUpload {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  progress: number;
}

export interface ReadyComposerAttachment {
  id: string;
  attachment: Attachment;
}

interface ComposerAttachmentTrayProps {
  uploads: ComposerAttachmentUpload[];
  attachments: ReadyComposerAttachment[];
  onCancelUpload: (id: string) => void;
  onRemoveAttachment: (id: string) => void | Promise<void>;
}

const formatPercent = (ratio: number): number => (
  Math.max(0, Math.min(100, Math.round(ratio * 100)))
);

const ComposerAttachmentTray: React.FC<ComposerAttachmentTrayProps> = ({
  uploads,
  attachments,
  onCancelUpload,
  onRemoveAttachment,
}) => {
  if (uploads.length === 0 && attachments.length === 0) return null;

  return (
    <div className="me-1 flex max-w-[min(420px,45vw)] shrink-0 gap-2 overflow-x-auto p-1" aria-label="مرفقات الرسالة">
      {uploads.map(upload => {
        const percent = formatPercent(upload.progress);
        return (
          <div key={upload.id} className="relative flex h-12 min-w-36 max-w-44 items-center gap-2 overflow-hidden rounded-xl border border-[#d1d7db] bg-white px-2 shadow-sm">
            <FileUp size={18} className="shrink-0 text-[#008069]" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-bold text-[#111b21]">{upload.fileName}</p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200" aria-hidden="true">
                <div className="h-full rounded-full bg-[#00a884] transition-[width]" style={{ width: `${percent}%` }} />
              </div>
              <p className="mt-0.5 text-[9px] text-[#667781]">{percent}%</p>
            </div>
            <button
              type="button"
              onClick={() => onCancelUpload(upload.id)}
              className="grid min-h-9 min-w-9 place-items-center rounded-full text-gray-500 hover:bg-red-50 hover:text-red-600"
              aria-label="إلغاء رفع الملف"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        );
      })}

      {attachments.map(({ id, attachment }) => (
        <div key={id} className="relative shrink-0 rounded-xl border border-[#d1d7db] bg-white p-1 shadow-sm">
          {attachment.mimeType.startsWith('image') ? (
            <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-gray-100">
              {attachment.previewUrl ? (
                <img src={attachment.previewUrl} alt={attachment.fileName || 'معاينة الصورة'} className="h-full w-full object-cover" />
              ) : (
                <ImageIcon size={18} className="absolute inset-0 m-auto text-gray-400" aria-hidden="true" />
              )}
            </div>
          ) : attachment.mimeType.startsWith('audio') ? (
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-purple-100 text-purple-700">
              <Mic size={18} aria-hidden="true" />
            </div>
          ) : (
            <FilePreviewCard
              fileName={attachment.fileName}
              fileSize={attachment.fileSize}
              mimeType={attachment.mimeType}
              category={attachment.category}
              compact
            />
          )}
          <button
            type="button"
            onClick={() => { void onRemoveAttachment(id); }}
            className="absolute -right-2 -top-2 grid min-h-9 min-w-9 place-items-center rounded-full border border-gray-200 bg-white text-gray-500 shadow hover:bg-red-50 hover:text-red-600"
            aria-label="إزالة المرفق"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ComposerAttachmentTray;
