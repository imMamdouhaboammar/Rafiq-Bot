import type { Attachment, AttachmentCategory } from "../types.js";

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const MAX_ATTACHMENT_COUNT = 5;

export type FileLike = {
  name?: string;
  size?: number;
  type?: string;
};

export type FileValidationResult = {
  valid: boolean;
  error?: string;
};

export type FileUploadMetadata = {
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: AttachmentCategory;
};

const extensionOf = (fileName = ""): string => {
  const match = fileName.toLowerCase().match(/\.([^.]+)$/);
  return match?.[1] || "";
};

const codeExtensions = new Set([
  "c", "cpp", "cs", "css", "go", "html", "java", "js", "jsx", "json", "kt", "lua",
  "md", "php", "py", "rb", "rs", "sh", "sql", "swift", "tsx", "ts", "vue", "xml",
  "yaml", "yml",
]);

const spreadsheetExtensions = new Set(["csv", "ods", "tsv", "xls", "xlsx"]);
const documentExtensions = new Set(["doc", "docx", "dot", "dotx", "hwp", "hwpx", "odt", "pdf", "rtf", "txt"]);
const archiveExtensions = new Set(["7z", "gz", "rar", "tar", "tgz", "zip"]);

export const categorizeFile = (mimeType = "", fileName = ""): AttachmentCategory => {
  const normalizedMime = mimeType.toLowerCase();
  const ext = extensionOf(fileName);

  if (normalizedMime.startsWith("image/")) return "image";
  if (normalizedMime.startsWith("audio/")) return "audio";
  if (normalizedMime.startsWith("video/")) return "video";
  if (normalizedMime === "application/pdf") return "document";
  if (normalizedMime.includes("spreadsheet") || normalizedMime.includes("excel") || normalizedMime === "text/csv") {
    return "spreadsheet";
  }
  if (
    normalizedMime.includes("wordprocessing") ||
    normalizedMime === "application/msword" ||
    normalizedMime === "text/plain" ||
    normalizedMime === "text/html"
  ) {
    return "document";
  }
  if (
    normalizedMime.startsWith("text/") ||
    normalizedMime.includes("json") ||
    normalizedMime.includes("javascript") ||
    normalizedMime.includes("typescript") ||
    normalizedMime.includes("xml")
  ) {
    return "code";
  }
  if (normalizedMime.includes("zip") || normalizedMime.includes("compressed") || normalizedMime.includes("tar")) {
    return "archive";
  }

  if (spreadsheetExtensions.has(ext)) return "spreadsheet";
  if (codeExtensions.has(ext)) return "code";
  if (documentExtensions.has(ext)) return "document";
  if (archiveExtensions.has(ext)) return "archive";
  return "other";
};

export const formatFileSize = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Number(kb.toFixed(kb >= 10 ? 0 : 1))} KB`;
  const mb = kb / 1024;
  return `${Number(mb.toFixed(mb >= 10 ? 0 : 1))} MB`;
};

export const validateAttachmentCount = (currentCount: number, incomingCount: number): FileValidationResult => {
  if (currentCount + incomingCount > MAX_ATTACHMENT_COUNT) {
    return {
      valid: false,
      error: `مسموح بحد أقصى ${MAX_ATTACHMENT_COUNT} ملفات في الرسالة الواحدة.`,
    };
  }
  return { valid: true };
};

export const validateFileUpload = (file: FileLike): FileValidationResult => {
  const size = file.size ?? 0;
  if (size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `الملف "${file.name || "بدون اسم"}" أكبر من الحد الأقصى ${formatFileSize(MAX_FILE_SIZE_BYTES)}.`,
    };
  }
  return { valid: true };
};

export const getFileMetadata = (file: FileLike): FileUploadMetadata => {
  const fileName = file.name || "untitled";
  const mimeType = file.type || "application/octet-stream";
  return {
    fileName,
    fileSize: file.size ?? 0,
    mimeType,
    category: categorizeFile(mimeType, fileName),
  };
};

const actionForCategory = (category?: AttachmentCategory): string => {
  switch (category) {
    case "code":
      return "review the code, explain issues, and suggest practical improvements";
    case "spreadsheet":
      return "analyze the data, patterns, and useful takeaways";
    case "document":
      return "read and summarize the document, then answer the user's request";
    case "image":
      return "look at the image and react to its content";
    case "audio":
      return "listen to the audio and respond to what it contains";
    case "video":
      return "watch the video and describe or analyze the relevant content";
    default:
      return "inspect the file and explain what can be understood from it";
  }
};

export const buildFileContextInstruction = (
  attachments: Array<Pick<Attachment, "fileName" | "fileSize" | "mimeType" | "category">>
): string | undefined => {
  const files = attachments.filter(Boolean);
  if (files.length === 0) return undefined;

  const fileLines = files.map((att, index) => {
    const fileName = att.fileName || `attachment-${index + 1}`;
    const mimeType = att.mimeType || "application/octet-stream";
    const category = att.category || categorizeFile(mimeType, fileName);
    return `${index + 1}. ${fileName} (${category}, ${mimeType}, ${formatFileSize(att.fileSize)}): ${actionForCategory(category)}.`;
  });

  return [
    "The user attached file(s). Use the inline file data as the source of truth.",
    "Respond naturally in character, but actually analyze the attachment content before replying.",
    "If a file type is unsupported or unreadable, say that plainly and use any available metadata.",
    ...fileLines,
  ].join("\n");
};

