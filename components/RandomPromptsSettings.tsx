import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Power, Sparkles } from 'lucide-react';
import { useRafiqStore } from '../stores/useRafiqStore.js';
import {
  listRandomPrompts,
  addRandomPrompt,
  toggleRandomPromptEnabled,
  removeRandomPrompt,
} from '../services/randomPrompts.js';
import { RandomPrompt } from '../types.js';

/**
 * RandomPromptsSettings
 *
 * Modal for managing the user's pool of random "AI trigger" prompts.
 * - Add new prompts (max 500 chars each)
 * - Toggle each prompt enabled/disabled
 * - Delete prompts
 * - Shows use count per prompt
 */

interface RandomPromptsSettingsProps {
  open: boolean;
  onClose: () => void;
}

export const RandomPromptsSettings: React.FC<RandomPromptsSettingsProps> = ({
  open,
  onClose,
}) => {
  const setPrompts = useRafiqStore((s) => s.setRandomPrompts);
  const prompts = useRafiqStore((s) => s.randomPrompts);

  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Load prompts when modal opens
  useEffect(() => {
    if (open) {
      listRandomPrompts()
        .then(setPrompts)
        .catch((e) => {
          console.error('[RandomPromptsSettings] load failed:', e);
          setError('Failed to load prompts');
        });
    }
  }, [open, setPrompts]);

  if (!open) return null;

  const enabledCount = prompts.filter(p => p.enabled).length;

  const handleAdd = async () => {
    setError(null);
    if (!draft.trim()) {
      setError('Prompt text is required');
      return;
    }
    if (draft.length > 500) {
      setError('Max 500 characters');
      return;
    }

    setBusy(true);
    try {
      const prompt = await addRandomPrompt(draft);
      setPrompts([...prompts, prompt]);
      setDraft('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (prompt: RandomPrompt) => {
    const next = !prompt.enabled;
    try {
      await toggleRandomPromptEnabled(prompt.id, next);
      setPrompts(prompts.map(p =>
        p.id === prompt.id ? { ...p, enabled: next, updatedAt: new Date() } : p
      ));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleDelete = async (prompt: RandomPrompt) => {
    if (!window['confirm'](`Delete this prompt?\n\n"${prompt.text}"`)) return;
    try {
      await removeRandomPrompt(prompt.id);
      setPrompts(prompts.filter(p => p.id !== prompt.id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog" aria-labelledby="rps-title"
      aria-modal="true"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Sparkles size={18} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 id="rps-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">
                AI Trigger Prompts
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Floating button randomly picks one and sends to the active chat
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stats bar */}
        <div className="px-6 py-2 bg-gray-50 dark:bg-gray-900/50 text-xs text-gray-600 dark:text-gray-400 flex justify-between">
          <span>{prompts.length} total • <strong className="text-emerald-600">{enabledCount} enabled</strong></span>
          {enabledCount === 0 && (
            <span className="text-amber-600 dark:text-amber-400">⚠ Button disabled until you enable at least one</span>
          )}
        </div>

        {/* Add new */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
          <div className="flex gap-2">
            <textarea
              value={draft}
              onChange={(e) => { setDraft(e.target.value); setError(null); }}
              placeholder="Type a message that will randomly be sent to the AI…"
              rows={2}
              maxLength={500}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
            <button
              onClick={handleAdd}
              disabled={busy || !draft.trim()}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center gap-1 self-end transition"
            >
              <Plus size={16} />
              Add
            </button>
          </div>
          <div className="flex justify-between mt-1 text-[11px]">
            <span className="text-red-500 min-h-[14px]">{error || ''}</span>
            <span className="text-gray-400">{draft.length}/500</span>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {prompts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Sparkles size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No prompts yet.</p>
              <p className="text-xs mt-1">Add one above to enable the floating button.</p>
            </div>
          ) : (
            prompts.map((p) => (
              <div
                key={p.id}
                className={[
                  'group flex items-start gap-3 p-3 rounded-xl border transition',
                  p.enabled
                    ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-900/10'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 opacity-60',
                ].join(' ')}
              >
                <button
                  onClick={() => handleToggle(p)}
                  className={[
                    'mt-0.5 w-9 h-9 rounded-full flex items-center justify-center transition shrink-0',
                    p.enabled
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 text-gray-500',
                  ].join(' ')}
                  aria-label={p.enabled ? 'Disable' : 'Enable'}
                  title={p.enabled ? 'Click to disable' : 'Click to enable'}
                >
                  <Power size={14} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-gray-100 break-words">
                    {p.text}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Used {p.useCount || 0}×
                    {p.lastUsedAt && ` • last: ${new Date(p.lastUsedAt).toLocaleDateString()}`}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(p)}
                  className="opacity-0 group-hover:opacity-100 p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition shrink-0"
                  aria-label="Delete"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-[11px] text-gray-500 dark:text-gray-400">
          <strong>Tip:</strong> Use varied phrasings — questions, statements, casual — to get natural AI responses.
          The button respects a 10s cooldown.
        </div>
      </div>
    </div>
  );
};

export default RandomPromptsSettings;