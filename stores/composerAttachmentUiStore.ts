import { create } from 'zustand';
import type {
  ComposerAttachmentUpload,
  ReadyComposerAttachment,
} from '../components/ComposerAttachmentTray.js';

interface ComposerAttachmentUiState {
  chatId?: string;
  uploads: ComposerAttachmentUpload[];
  attachments: ReadyComposerAttachment[];
  cancelUpload: (id: string) => void;
  removeAttachment: (id: string) => void | Promise<void>;
  setSnapshot: (snapshot: Omit<ComposerAttachmentUiState, 'setSnapshot' | 'clear'>) => void;
  clear: (chatId?: string) => void;
}

const noop = () => undefined;

export const useComposerAttachmentUiStore = create<ComposerAttachmentUiState>((set, get) => ({
  chatId: undefined,
  uploads: [],
  attachments: [],
  cancelUpload: noop,
  removeAttachment: noop,
  setSnapshot: snapshot => set(snapshot),
  clear: chatId => {
    if (chatId && get().chatId !== chatId) return;
    set({
      chatId: undefined,
      uploads: [],
      attachments: [],
      cancelUpload: noop,
      removeAttachment: noop,
    });
  },
}));
