import React from "react";
import { Archive, Code2, File, FileAudio, FileSpreadsheet, FileText, FileVideo, Image as ImageIcon } from "lucide-react";
import type { AttachmentCategory } from "../types.js";
import { formatFileSize } from "../services/fileProcessor.js";

type FilePreviewCardProps = {
  fileName?: string;
  fileSize?: number;
  mimeType: string;
  category?: AttachmentCategory;
  compact?: boolean;
};

const iconForCategory = (category?: AttachmentCategory) => {
  switch (category) {
    case "image":
      return ImageIcon;
    case "audio":
      return FileAudio;
    case "video":
      return FileVideo;
    case "document":
      return FileText;
    case "spreadsheet":
      return FileSpreadsheet;
    case "code":
      return Code2;
    case "archive":
      return Archive;
    default:
      return File;
  }
};

const colorForCategory = (category?: AttachmentCategory): string => {
  switch (category) {
    case "document":
      return "bg-red-50 text-red-600";
    case "spreadsheet":
      return "bg-emerald-50 text-emerald-700";
    case "code":
      return "bg-violet-50 text-violet-700";
    case "audio":
      return "bg-purple-50 text-purple-700";
    case "video":
      return "bg-sky-50 text-sky-700";
    case "archive":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
};

const FilePreviewCard: React.FC<FilePreviewCardProps> = ({ fileName, fileSize, mimeType, category, compact = false }) => {
  const Icon = iconForCategory(category);
  const safeName = fileName || "ملف مرفق";

  if (compact) {
    return (
      <div className="flex h-10 min-w-0 max-w-[160px] items-center gap-2 rounded-lg border border-[#d1d7db] bg-white/90 px-2">
        <div className={`grid h-7 w-7 shrink-0 place-items-center rounded ${colorForCategory(category)}`}>
          <Icon size={15} />
        </div>
        <div className="min-w-0 text-start">
          <div className="truncate text-[11px] font-semibold text-[#111b21]" title={safeName}>{safeName}</div>
          <div className="truncate text-[10px] text-[#667781]">{formatFileSize(fileSize)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-1 flex min-w-[220px] max-w-full items-center gap-2 rounded-lg bg-black/5 p-2">
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${colorForCategory(category)}`}>
        <Icon size={21} />
      </div>
      <div className="min-w-0 flex-1 text-start">
        <div className="truncate text-[13px] font-semibold text-[#111b21]" title={safeName}>{safeName}</div>
        <div className="truncate text-[11px] text-[#667781]">
          {formatFileSize(fileSize)} · {category || "file"} · {mimeType || "unknown"}
        </div>
      </div>
    </div>
  );
};

export default FilePreviewCard;

