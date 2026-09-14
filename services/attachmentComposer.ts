import type { Attachment } from '../types.js';
import {
  attachmentRepository,
  type AttachmentRepository,
  type LocalAttachmentFile,
} from './attachmentRepository.js';
import { getFileMetadata } from './fileProcessor.js';
import {
  validateLocalAttachmentCount,
  validateLocalAttachmentFile,
} from './largeFilePolicy.js';
import { createLocalAttachmentReference } from './localAttachmentReference.js';

export interface StagedComposerAttachment {
  attachmentId: string;
  draft: Attachment;
  persistent: Attachment;
  revokePreview: () => void;
}

export const stageComposerAttachment = async ({
  chatId,
  file,
  currentCount,
  attachmentId,
  signal,
  onProgress,
  repository = attachmentRepository,
}: {
  chatId: string;
  file: LocalAttachmentFile;
  currentCount: number;
  attachmentId?: string;
  signal?: AbortSignal;
  onProgress?: (ratio: number) => void;
  repository?: Pick<AttachmentRepository, 'saveLocalFile' | 'createObjectUrl'>;
}): Promise<StagedComposerAttachment> => {
  validateLocalAttachmentCount(currentCount, 1);
  validateLocalAttachmentFile(file);

  const metadata = getFileMetadata(file as File);
  const record = await repository.saveLocalFile({
    chatId,
    file,
    attachmentId,
    signal,
    onProgress,
  });
  const preview = await repository.createObjectUrl(record.id);
  const shared = {
    mimeType: record.mimeType,
    fileName: record.fileName,
    fileSize: record.sizeBytes,
    category: metadata.category,
  } satisfies Partial<Attachment>;

  return {
    attachmentId: record.id,
    draft: {
      ...shared,
      previewUrl: preview.url,
    } as Attachment,
    persistent: {
      ...shared,
      previewUrl: createLocalAttachmentReference(record.id),
      base64: undefined,
      file: undefined,
    } as Attachment,
    revokePreview: preview.revoke,
  };
};

export const finalizeComposerAttachments = async ({
  staged,
  messageId,
  repository = attachmentRepository,
}: {
  staged: StagedComposerAttachment[];
  messageId: string;
  repository?: Pick<AttachmentRepository, 'attachToMessage'>;
}): Promise<Attachment[]> => {
  for (const attachment of staged) {
    await repository.attachToMessage(attachment.attachmentId, messageId);
  }
  return staged.map(attachment => structuredClone(attachment.persistent));
};

export const releaseComposerAttachments = (
  staged: StagedComposerAttachment[],
): void => {
  for (const attachment of staged) attachment.revokePreview();
};
