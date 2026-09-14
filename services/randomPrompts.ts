/**
 * randomPrompts.ts — Client-side service for random prompts (floating trigger button)
 *
 * Wraps Dexie with user-scoped CRUD + selection logic.
 * Used by the FloatingTriggerButton and the RandomPromptsSettings UI.
 */

import {
  saveRandomPrompt as dbSave,
  getRandomPromptsForUser as dbList,
  pickRandomPromptForUser as dbPick,
  deleteRandomPrompt as dbDelete,
  toggleRandomPrompt as dbToggle,
  countEnabledRandomPrompts as dbCount,
} from './db.js';
import { RandomPrompt } from '../types.js';
import { getUserProfile } from './db.js';

const USER_ID = 'main_user'; // single-user app for now

const generateId = (): string =>
  `rp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

/**
 * List all prompts for the current user (enabled + disabled)
 */
export const listRandomPrompts = async (): Promise<RandomPrompt[]> => {
  return dbList(USER_ID);
};

/**
 * Add a new prompt. Throws if user has no profile (auth required).
 */
export const addRandomPrompt = async (text: string): Promise<RandomPrompt> => {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Prompt text cannot be empty');
  if (trimmed.length > 500) throw new Error('Prompt text exceeds 500 characters');

  // Ensure user is signed in (lightweight check)
  const profile = await getUserProfile();
  if (!profile) throw new Error('Sign in required to manage random prompts');

  const now = new Date();
  const prompt: RandomPrompt = {
    id: generateId(),
    userId: USER_ID,
    text: trimmed,
    enabled: true,
    createdAt: now,
    updatedAt: now,
    useCount: 0,
  };
  await dbSave(prompt);
  return prompt;
};

/**
 * Toggle enabled/disabled for a prompt
 */
export const toggleRandomPromptEnabled = async (
  promptId: string,
  enabled: boolean
): Promise<void> => {
  await dbToggle(promptId, enabled);
};

/**
 * Delete a prompt
 */
export const removeRandomPrompt = async (promptId: string): Promise<void> => {
  await dbDelete(promptId);
};

/**
 * Pick a random enabled prompt for the user (called when FAB is pressed)
 * Returns null if no enabled prompts exist
 */
export const pickRandomPrompt = async (): Promise<RandomPrompt | null> => {
  return dbPick(USER_ID);
};

/**
 * Count enabled prompts (for UI feedback)
 */
export const getEnabledCount = async (): Promise<number> => {
  return dbCount(USER_ID);
};

/**
 * Seed default prompts for new users (idempotent — only adds if user has none)
 */
export const seedDefaultPromptsIfEmpty = async (): Promise<void> => {
  const existing = await listRandomPrompts();
  if (existing.length > 0) return;

  const defaults = [
    'What are you thinking about right now?',
    'Tell me something interesting today.',
    'I was just thinking about you — what\'s new?',
    'Hey, got a minute?',
    'What\'s on your mind?',
  ];

  for (const text of defaults) {
    await addRandomPrompt(text).catch(() => {
      // Best-effort seeding — don't block UI if it fails
    });
  }
};