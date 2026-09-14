import type { ChatMessage, ChatSession } from "../types.js";
import { AdaptivePersonalityStateSchema, MessageRole } from "../types.js";
import * as DB from "./db.js";
import { eventBus } from "./eventBus.js";
import { analyzePersonalitySignals } from "./geminiService.js";
import {
  createAdaptivePersonalityState,
  reduceAdaptivePersonality,
  type PersonalityEvidenceMessage,
  type PersonalitySignalProposal,
} from "./livingPersonaCore.js";

export type PersonalityAnalysisInput = {
  botName: string;
  currentSummary: string;
  messages: Array<{
    id: string;
    role: "user" | "model";
    text: string;
    timestamp: string;
  }>;
};

type CoordinatorDependencies = {
  getChatSession: (chatId: string) => Promise<ChatSession | undefined>;
  getMessagesForChat: (chatId: string, limit: number) => Promise<ChatMessage[]>;
  commitAdaptivePersonality: (
    chatId: string,
    expectedVersion: number,
    state: NonNullable<ChatSession["settings"]["adaptivePersonality"]>,
  ) => Promise<ChatSession | undefined>;
  analyzeSignals: (input: PersonalityAnalysisInput) => Promise<PersonalitySignalProposal[]>;
  onUpdated: (chat: ChatSession) => void;
  now: () => Date;
  setTimer?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
};

export type PersonalityEvolutionStatus =
  | "updated"
  | "missing_chat"
  | "unsupported_scope"
  | "disabled"
  | "not_enough_evidence"
  | "rate_limited"
  | "conflict"
  | "in_flight";

const MIN_NEW_USER_MESSAGES = 8;
const RUN_COOLDOWN_MS = 15 * 60 * 1000;
const MAX_RUNS_PER_DAY = 4;
const SESSION_GAP_MS = 30 * 60 * 1000;
const DEFAULT_DEBOUNCE_MS = 6_000;
const MAX_USER_MESSAGES_PER_RUN = 16;
const MAX_MODEL_CONTEXT_MESSAGES = 8;

const sameUtcDay = (left: Date, right: Date): boolean => (
  left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10)
);

const assignSessionKeys = (
  messages: ChatMessage[],
  state: NonNullable<ChatSession["settings"]["adaptivePersonality"]>,
): PersonalityEvidenceMessage[] => {
  const observeAfter = state.observeAfter ? new Date(state.observeAfter).getTime() : 0;
  const sorted = [...messages]
    .filter(message => message.role === MessageRole.USER && new Date(message.timestamp).getTime() > observeAfter)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let previousTime = state.lastObservedUserAt ? new Date(state.lastObservedUserAt).getTime() : 0;
  let currentSessionKey = state.currentSessionKey;
  return sorted.map(message => {
    const time = new Date(message.timestamp).getTime();
    if (!currentSessionKey || previousTime === 0 || time - previousTime > SESSION_GAP_MS) {
      currentSessionKey = `${message.chatId}:session:${new Date(message.timestamp).toISOString()}`;
    }
    previousTime = time;
    return {
      id: message.id,
      sessionKey: currentSessionKey,
      timestamp: new Date(message.timestamp),
    };
  });
};

export class PersonalityEvolutionCoordinator {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private inFlight = new Set<string>();
  private readonly deps: Required<CoordinatorDependencies>;

  constructor(dependencies: CoordinatorDependencies) {
    this.deps = {
      ...dependencies,
      setTimer: dependencies.setTimer || ((callback, delayMs) => setTimeout(callback, delayMs)),
      clearTimer: dependencies.clearTimer || (timer => clearTimeout(timer)),
    };
  }

  observeTurn(chatId: string): void {
    const existing = this.timers.get(chatId);
    if (existing) this.deps.clearTimer(existing);
    const timer = this.deps.setTimer(() => {
      this.timers.delete(chatId);
      void this.runNow(chatId).catch(error => {
        console.warn("[PersonalityEvolution] Background adaptation failed:", error);
      });
    }, DEFAULT_DEBOUNCE_MS);
    this.timers.set(chatId, timer);
  }

  cancel(chatId: string): void {
    const timer = this.timers.get(chatId);
    if (timer) this.deps.clearTimer(timer);
    this.timers.delete(chatId);
  }

  async runNow(chatId: string): Promise<{ status: PersonalityEvolutionStatus }> {
    if (this.inFlight.has(chatId)) return { status: "in_flight" };
    this.inFlight.add(chatId);

    try {
      const session = await this.deps.getChatSession(chatId);
      if (!session) return { status: "missing_chat" };
      if (session.isGroup) return { status: "unsupported_scope" };

      const parsedState = AdaptivePersonalityStateSchema.safeParse(session.settings.adaptivePersonality);
      const state = parsedState.success ? parsedState.data : createAdaptivePersonalityState();
      if (!state.enabled) return { status: "disabled" };

      const now = this.deps.now();
      if (state.lastRunAt && now.getTime() - new Date(state.lastRunAt).getTime() < RUN_COOLDOWN_MS) {
        return { status: "rate_limited" };
      }
      if (state.lastRunAt && sameUtcDay(now, new Date(state.lastRunAt)) && state.runsToday >= MAX_RUNS_PER_DAY) {
        return { status: "rate_limited" };
      }

      const messages = await this.deps.getMessagesForChat(chatId, 80);
      const processed = new Set(state.processedMessageIds);
      const evidenceMessages = assignSessionKeys(messages, state)
        .filter(message => !processed.has(message.id))
        .slice(0, MAX_USER_MESSAGES_PER_RUN);
      if (evidenceMessages.length < MIN_NEW_USER_MESSAGES) return { status: "not_enough_evidence" };

      const evidenceIds = new Set(evidenceMessages.map(message => message.id));
      const modelContext = messages
        .filter(message => message.role === MessageRole.MODEL)
        .slice(-MAX_MODEL_CONTEXT_MESSAGES);
      const analysisMessages = messages
        .filter(message => evidenceIds.has(message.id))
        .concat(modelContext)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map(message => ({
          id: message.id,
          role: message.role === MessageRole.USER ? "user" as const : "model" as const,
          text: message.text.slice(0, 1_000),
          timestamp: new Date(message.timestamp).toISOString(),
        }));

      const analyzerResult = await this.deps.analyzeSignals({
        botName: session.settings.botName,
        currentSummary: state.summary,
        messages: analysisMessages,
      });
      const proposals = Array.isArray(analyzerResult) ? analyzerResult : [];
      const batchId = `${chatId}:${evidenceMessages[0].id}:${evidenceMessages[evidenceMessages.length - 1].id}`;
      const reduction = reduceAdaptivePersonality(state, proposals, {
        batchId,
        now,
        messages: evidenceMessages,
      });

      const updated = await this.deps.commitAdaptivePersonality(chatId, state.version, reduction.next);
      if (!updated) return { status: "conflict" };
      this.deps.onUpdated(updated);
      return { status: "updated" };
    } finally {
      this.inFlight.delete(chatId);
    }
  }
}

export const personalityEvolutionCoordinator = new PersonalityEvolutionCoordinator({
  getChatSession: DB.getChatSession,
  getMessagesForChat: (chatId, limit) => DB.getMessagesForChat(chatId, limit),
  commitAdaptivePersonality: DB.commitAdaptivePersonality,
  analyzeSignals: input => analyzePersonalitySignals(input),
  onUpdated: chat => eventBus.emit("persona:adaptation_updated", { chatId: chat.id, chat }, "PersonalityEvolution"),
  now: () => new Date(),
});
