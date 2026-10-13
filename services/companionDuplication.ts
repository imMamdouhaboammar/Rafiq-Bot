import type {
  BotSettings,
  ChatSession,
  PsychologicalState,
  SoulMemorySeed,
} from '../types.js';
import { BotMood } from '../types.js';
import * as DB from './db.js';
import { buildBlueprintMemoryRecords } from './memoryEngine.js';

export interface DuplicateCompanionOptions {
  /** Optional custom name for the duplicated companion. Defaults to `${originalName} (نسخة)`. */
  newName?: string;
}

/**
 * Creates a clean duplicate ChatSession from an existing companion's settings:
 * - Copies all personality, voice, model, soul, and appearance configurations.
 * - Does NOT copy any past messages (empty chat history).
 * - Resets adaptive personality message evidence to prevent message leaks while keeping learned traits.
 * - Resets psychological state to a clean, fresh baseline.
 */
export function createDuplicateCompanionSession(
  sourceChat: ChatSession,
  options?: DuplicateCompanionOptions,
): ChatSession {
  if (sourceChat.isGroup) {
    throw new Error('لا يمكن نسخ مجموعة كمرافق');
  }

  const originalSettings = sourceChat.settings;
  const newId = crypto.randomUUID();
  const rawName = options?.newName?.trim();
  const newName = rawName && rawName.length > 0 ? rawName : `${originalSettings.botName} (نسخة)`;

  // Deep copy settings
  const clonedSettings: BotSettings = structuredClone(originalSettings);
  clonedSettings.botName = newName;

  // Clean adaptive personality if present:
  // We keep calibrated facet offsets, but clear previous message evidence & history
  if (clonedSettings.adaptivePersonality) {
    clonedSettings.adaptivePersonality = {
      ...clonedSettings.adaptivePersonality,
      evidence: [],
      processedMessageIds: [],
      currentSessionKey: undefined,
      lastBatchId: undefined,
      dailyDeltaBps: {},
      runsToday: 0,
      observationCount: 0,
      lastObservedUserAt: undefined,
      lastRunAt: undefined,
      observeAfter: undefined,
      updatedAt: new Date(),
    };
  }

  // If cloneProfile exists, preserve persona attributes but reset active job/batch progress
  if (clonedSettings.cloneProfile) {
    const cloneProfile = structuredClone(clonedSettings.cloneProfile);
    if (cloneProfile.analysis) {
      cloneProfile.analysis = {
        ...cloneProfile.analysis,
        jobId: `clone-${newId}`,
        status: 'ready',
        error: undefined,
        updatedAt: new Date().toISOString(),
      };
    }
    clonedSettings.cloneProfile = cloneProfile;
  }

  const initialPsychology: PsychologicalState = {
    mood: BotMood.NEUTRAL,
    intimacyLevel: 5,
    socialMeter: 5,
    energyLevel: 8,
    emotionalLedger: 0,
    lastInteractionTime: new Date(),
    secretUnlocked: false,
    hungerLevel: 20,
    financialStress: 30,
    sleepiness: 0,
    tier: sourceChat.psychology?.tier || 'pro',
    isPro: sourceChat.psychology?.isPro ?? true,
    isBlocked: false,
  };

  const newChatSession: ChatSession = {
    id: newId,
    settings: clonedSettings,
    psychology: initialPsychology,
    lastMessage: undefined, // Zero messages
    lastMessageTimestamp: new Date(),
    unreadCount: 0,
  };

  return newChatSession;
}

export interface DuplicateCompanionDbAdapter {
  saveChatSession: (chat: ChatSession) => Promise<void>;
  saveClonedChatSession: (
    chat: ChatSession,
    legacyEntries: any[],
    memoryRecords: any[],
  ) => Promise<void>;
}

/**
 * Duplicates a companion and persists it to the database with clean message history.
 * If the companion has profile memory seeds, they are safely re-indexed for the new companion id.
 */
export async function duplicateCompanion(
  sourceChat: ChatSession,
  options?: DuplicateCompanionOptions,
  dbAdapter?: DuplicateCompanionDbAdapter,
): Promise<ChatSession> {
  const newChat = createDuplicateCompanionSession(sourceChat, options);
  const saveSession = dbAdapter?.saveChatSession ?? DB.saveChatSession;
  const saveCloned = dbAdapter?.saveClonedChatSession ?? DB.saveClonedChatSession;

  const cloneSeeds = newChat.settings.cloneProfile?.memorySeeds;
  if (cloneSeeds && cloneSeeds.length > 0) {
    const validSeeds = cloneSeeds.flatMap((seed): SoulMemorySeed[] => {
      if (!seed.text?.trim() || !seed.category || !Number.isFinite(seed.salience)) return [];
      return [{
        text: seed.text.trim(),
        category: seed.category,
        salience: Math.max(0, Math.min(1, seed.salience)),
        ...(seed.subject ? { subject: seed.subject } : {}),
      }];
    });

    if (validSeeds.length > 0) {
      const { legacyEntries, memoryRecords } = buildBlueprintMemoryRecords(newChat.id, validSeeds);
      await saveCloned(newChat, legacyEntries, memoryRecords);
      return newChat;
    }
  }

  await saveSession(newChat);
  return newChat;
}
