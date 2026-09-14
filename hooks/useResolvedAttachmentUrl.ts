import { useEffect, useState } from 'react';
import { attachmentRepository } from '../services/attachmentRepository.js';

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

export const useResolvedAttachmentUrl = (previewUrl: string | undefined) => {
  const [state, setState] = useState<{
    url?: string;
    loading: boolean;
    error?: string;
  }>({
    url: previewUrl && !getLocalAttachmentId(previewUrl) ? previewUrl : undefined,
    loading: Boolean(getLocalAttachmentId(previewUrl)),
  });

  useEffect(() => {
    const attachmentId = getLocalAttachmentId(previewUrl);
    if (!attachmentId) {
      setState({ url: previewUrl, loading: false });
      return;
    }

    let active = true;
    let revoke: (() => void) | undefined;
    setState({ loading: true });

    void attachmentRepository.createObjectUrl(attachmentId)
      .then(result => {
        if (!active) {
          result.revoke();
          return;
        }
        revoke = result.revoke;
        setState({ url: result.url, loading: false });
      })
      .catch(error => {
        if (!active) return;
        setState({
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      active = false;
      revoke?.();
    };
  }, [previewUrl]);

  return state;
};
