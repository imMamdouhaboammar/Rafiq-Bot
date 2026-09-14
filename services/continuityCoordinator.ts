import {
  PsychologicalStateSchema,
  type ChatMessage,
  type ChatSession,
  type PsychologicalState,
} from "../types.js";
import {
  advanceContinuityTime,
  applyContinuityProposal,
  createInitialContinuityState,
  selectContinuityContext,
  type CompanionContinuityState,
  type ContinuityContextItem,
} from "./companionContinuity.js";
import {
  createContinuityFollowupTrigger,
  type ProactiveReachoutTrigger,
} from "./socialHeartbeat.js";

export type ReflectionMessage = Pick<ChatMessage, "id" | "chatId" | "role" | "text" | "timestamp">;

export interface ContinuityReflectionInput {
  chatId: string;
  botId: string;
  botName: string;
  messages: ReflectionMessage[];
  currentState: PsychologicalState;
}

export interface ContinuityReflectionResult {
  continuityProposals?: unknown[];
}

export interface ContinuityCoordinatorOptions {
  now?: () => Date;
  reflectionCooldownMs?: number;
  saveChat?: (chat: ChatSession) => Promise<void>;
  reflect?: (input: ContinuityReflectionInput) => Promise<ContinuityReflectionResult>;
}

export interface SessionResumeInput {
  chat: ChatSession;
}

export interface ConversationSettledInput {
  chat: ChatSession;
  messages: ChatMessage[];
}

export interface ContinuityCoordinatorResult {
  chat: ChatSession;
  changed: boolean;
  context: ContinuityContextItem[];
  proactiveTriggers: ProactiveReachoutTrigger[];
}

export interface ContinuityCoordinator {
  onSessionResume(input: SessionResumeInput): Promise<ContinuityCoordinatorResult>;
  onConversationSettled(input: ConversationSettledInput): Promise<ContinuityCoordinatorResult>;
}

const stateChanged = (
  before: CompanionContinuityState | undefined,
  after: CompanionContinuityState,
): boolean => !before || JSON.stringify(before) !== JSON.stringify(after);

const reflectionMessages = (messages: ChatMessage[]): ReflectionMessage[] => (
  messages.slice(-30).map(message => ({
    id: message.id,
    chatId: message.chatId,
    role: message.role,
    text: message.text,
    timestamp: message.timestamp,
  }))
);

const resultFor = (
  chat: ChatSession,
  changed: boolean,
  now: Date,
): ContinuityCoordinatorResult => {
  if (chat.isGroup || !chat.continuityState) {
    return { chat, changed, context: [], proactiveTriggers: [] };
  }

  const context = selectContinuityContext(chat.continuityState, now);
  const proactiveTriggers = chat.continuityState.threads
    .filter(thread => thread.status === "due")
    .sort((left, right) => right.salience - left.salience)
    .slice(0, 3)
    .map(thread => createContinuityFollowupTrigger(chat.id, chat.id, thread, now));

  return { chat, changed, context, proactiveTriggers };
};

/**
 * Owns relationship-continuity lifecycle transitions without owning UI or
 * provider details. Groups are intentionally excluded from private continuity.
 */
export function createContinuityCoordinator(
  options: ContinuityCoordinatorOptions = {},
): ContinuityCoordinator {
  const now = options.now ?? (() => new Date());
  const reflectionCooldownMs = options.reflectionCooldownMs ?? 20 * 60 * 1000;
  const lastReflectionAttempt = new Map<string, number>();

  const persistIfChanged = async (
    original: ChatSession,
    state: CompanionContinuityState,
  ): Promise<ContinuityCoordinatorResult> => {
    const changed = stateChanged(original.continuityState, state);
    const chat = changed ? { ...original, continuityState: state } : original;
    if (changed && options.saveChat) await options.saveChat(chat);
    return resultFor(chat, changed, now());
  };

  return {
    async onSessionResume({ chat }) {
      if (chat.isGroup) return resultFor(chat, false, now());
      const currentTime = now();
      const currentState = chat.continuityState ?? createInitialContinuityState(currentTime);
      const advancedState = advanceContinuityTime(currentState, currentTime);
      return persistIfChanged(chat, advancedState);
    },

    async onConversationSettled({ chat, messages }) {
      if (chat.isGroup) return resultFor(chat, false, now());

      const currentTime = now();
      const originalState = chat.continuityState;
      let nextState = advanceContinuityTime(
        originalState ?? createInitialContinuityState(currentTime),
        currentTime,
      );

      const recentMessages = reflectionMessages(messages);
      const lastAttempt = lastReflectionAttempt.get(chat.id);
      const cooldownElapsed = lastAttempt === undefined
        || currentTime.getTime() - lastAttempt >= reflectionCooldownMs;
      const canReflect = Boolean(options.reflect)
        && recentMessages.length >= 2
        && cooldownElapsed;

      if (canReflect && options.reflect) {
        lastReflectionAttempt.set(chat.id, currentTime.getTime());
        try {
          const reflection = await options.reflect({
            chatId: chat.id,
            botId: chat.id,
            botName: chat.settings.botName,
            messages: recentMessages,
            currentState: chat.psychology ?? PsychologicalStateSchema.parse({}),
          });
          const evidence = { messageIds: recentMessages.map(message => message.id) };
          for (const proposal of reflection.continuityProposals ?? []) {
            try {
              nextState = applyContinuityProposal(nextState, proposal, evidence, currentTime);
            } catch {
              // Model output is advisory. Invalid proposals fail closed.
            }
          }
        } catch (error) {
          console.warn("[ContinuityCoordinator] Reflection skipped after provider failure:", error);
        }
      }

      const changed = stateChanged(originalState, nextState);
      const updatedChat = changed ? { ...chat, continuityState: nextState } : chat;
      if (changed && options.saveChat) await options.saveChat(updatedChat);
      return resultFor(updatedChat, changed, currentTime);
    },
  };
}
