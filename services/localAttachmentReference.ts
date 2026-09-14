const OPFS_REFERENCE_PREFIX = 'opfs://';

export const getLocalAttachmentId = (previewUrl: string | undefined): string | undefined => {
  if (!previewUrl?.startsWith(OPFS_REFERENCE_PREFIX)) return undefined;
  const id = previewUrl.slice(OPFS_REFERENCE_PREFIX.length).trim();
  return id || undefined;
};

export const createLocalAttachmentReference = (attachmentId: string): string => {
  const normalized = attachmentId.trim();
  if (!normalized) throw new Error('Attachment ID is required.');
  return `${OPFS_REFERENCE_PREFIX}${normalized}`;
};

export const isLocalAttachmentReference = (value: string | undefined): boolean => (
  Boolean(getLocalAttachmentId(value))
);
