import React from 'react';
import { useComposerAttachmentUiStore } from '../stores/composerAttachmentUiStore.js';
import ComposerAttachmentTray from './ComposerAttachmentTray.js';

const ComposerAttachmentOverlayHost: React.FC = () => {
  const uploads = useComposerAttachmentUiStore(state => state.uploads);
  const attachments = useComposerAttachmentUiStore(state => state.attachments);
  const cancelUpload = useComposerAttachmentUiStore(state => state.cancelUpload);
  const removeAttachment = useComposerAttachmentUiStore(state => state.removeAttachment);

  if (uploads.length === 0 && attachments.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-2 bottom-[calc(68px+env(safe-area-inset-bottom))] z-[65] flex justify-center md:bottom-20 md:justify-end md:pe-8" dir="rtl">
      <div className="pointer-events-auto max-w-full rounded-2xl bg-white/92 p-1.5 shadow-2xl ring-1 ring-black/10 backdrop-blur">
        <ComposerAttachmentTray
          uploads={uploads}
          attachments={attachments}
          onCancelUpload={cancelUpload}
          onRemoveAttachment={removeAttachment}
        />
      </div>
    </div>
  );
};

export default ComposerAttachmentOverlayHost;
