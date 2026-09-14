import { getFileMetadata, validateFileUpload } from "./fileProcessor.js";

export {
  MAX_ATTACHMENT_COUNT,
  MAX_FILE_SIZE_BYTES,
  buildFileContextInstruction,
  categorizeFile,
  formatFileSize,
  getFileMetadata,
  validateAttachmentCount,
  validateFileUpload,
} from "./fileProcessor.js";

export const processFileUpload = async (file: { name?: string; size?: number; type?: string }) => {
  const validation = validateFileUpload(file);
  if (!validation.valid) {
    throw new Error(validation.error || "Invalid file.");
  }

  return getFileMetadata(file);
};
