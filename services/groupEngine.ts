import type { ChatMessage, ChatSession, Reaction } from '../types.js';
import { PersonaMind, type PersonaMindDependencies } from './personaMind.js';
import { eventBus, type RafiqEventMap } from './eventBus.js';
import * as DB from './db.js';
import { GroupTurnCoordinator, type GroupTurnCoordinatorOptions } from './groupConversation.js';
import {
  GroupBudgetExceededError,
  PersistentGroupTurnCoordinator,
  persistentGroupTurnCoordinator,
  type CoordinatedGroupTurnJob,
  type EnqueueGroupTurnInput,
  type GroupTurnJobStore,
} from './groupTurnCoordinator.js';

interface GroupEngineDependencies {
  getChatSession?: (chatId: string) => Promise<ChatSession | undefined>;
  saveGroupMessage?: (message: ChatMessage) => Promise<void>;
  deleteGroupMessage?: (messageId: string, groupId: string) => Promise<void>;
  saveGroupReaction?: (groupId: string, messageId: string, reaction: Reaction) => Promise<void>;
  createMessageId?: () => string;
  personaMind?: PersonaMindDependencies;
  turnCoordinator?: PersistentGroupTurnCoordinator;
  coordinatorOptions?: GroupTurnCoordinatorOptions;
  continuationDelayMs?: number;
}

type LastGroupMessage = {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
};

const createMemoryTurnCoordinator = (): PersistentGroupTurnCoordinator => {
  const jobs = new Map<string, CoordinatedGroupTurnJob>();
  const store: GroupTurnJobStore = {
    get: async id => jobs.get(id),
    put: async job => { jobs.set(job.id, structuredClone(job)); },
    list: async () => Array.from(jobs.values()).map(job => structuredClone(job)),
  };
  return new PersistentGroupTurnCoordinator(store);
};

const getDefaultTurnCoordinator = (): PersistentGroupTurnCoordinator => (
  typeof globalThis.indexedDB === 'undefined'
    ? createMemoryTurnCoordinator()
    : persistentGroupTurnCoordinator
);

export class GroupEngine {
  private readonly activeMinds = new Map<string, PersonaMind[]>();
  private readonly sessionIds = new Map<string, string>();
  private readonly initializedGroups = new Set<string>();
  private readonly drainingGroups = new Set<string>();
  private readonly drainRequests = new Set<string>();
  private readonly retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly continuationTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly lastGroupMessages = new Map<string, LastGroupMessage>();
  private readonly dependencies: Required<Omit<GroupEngineDependencies, 'personaMind' | 'turnCoordinator' | 'coordinatorOptions'>> & {
    personaMind: PersonaMindDependencies;
    coordinatorOptions?: GroupTurnCoordinatorOptions;
    continuationDelayMs: number;
  };
  private readonly turnCoordinator: PersistentGroupTurnCoordinator;

  constructor(dependencies: GroupEngineDependencies = {}) {
    this.dependencies = {
      getChatSession: dependencies.getChatSession || DB.getChatSession,
      saveGroupMessage: dependencies.saveGroupMessage || DB.saveGroupMessage,
      deleteGroupMessage: dependencies.deleteGroupMessage || ((messageId, groupId) => (
        DB.deleteMessage(messageId, groupId, true)
      )),
      saveGroupReaction: dependencies.saveGroupReaction || DB.saveGroupMessageReaction,
      createMessageId: dependencies.createMessageId || (() => crypto.randomUUID()),
      personaMind: dependencies.personaMind || {},
      coordinatorOptions: dependencies.coordinatorOptions,
      continuationDelayMs: Math.max(500, dependencies.continuationDelayMs ?? 3_000),
    };
    this.turnCoordinator = dependencies.turnCoordinator || getDefaultTurnCoordinator();
    this.setupGlobalListeners();
  }

  public async initGroupSession(groupChat: ChatSession, memberBots: ChatSession[]): Promise<void> {
    const requestedMemberIds = [...new Set(memberBots.map(bot => bot.id))].sort();
    const currentMinds = this.activeMinds.get(groupChat.id) || [];
    const currentMemberIds = currentMinds.map(mind => mind.getPersonaId()).sort();
    const configurationsMatch = memberBots.every(bot => currentMinds.some(
      mind => mind.getPersonaId() === bot.id && mind.matchesConfiguration(bot),
    ));

    if (
      this.initializedGroups.has(groupChat.id) &&
      requestedMemberIds.length === currentMemberIds.length &&
      requestedMemberIds.every((id, index) => id === currentMemberIds[index]) &&
      configurationsMatch
    ) {
      void this.drainPersistentJobs(groupChat.id);
      return;
    }

    if (this.initializedGroups.has(groupChat.id)) this.destroyGroupSession(groupChat.id);

    const causalCoordinator = new GroupTurnCoordinator(this.dependencies.coordinatorOptions);
    const sessionId = crypto.randomUUID();
    const minds = memberBots.map(bot => new PersonaMind(
      bot,
      groupChat.id,
      sessionId,
      causalCoordinator,
      {
        ...this.dependencies.personaMind,
        scheduleTurn: input => this.schedulePersistentTurn(groupChat.id, sessionId, input),
        groupBio: groupChat.settings.botBio,
      },
    ));

    this.activeMinds.set(groupChat.id, minds);
    this.sessionIds.set(groupChat.id, sessionId);
    this.lastGroupMessages.delete(groupChat.id);
    this.initializedGroups.add(groupChat.id);
    void this.drainPersistentJobs(groupChat.id);
  }

  public destroyGroupSession(groupId: string): void {
    const minds = this.activeMinds.get(groupId);
    if (minds) {
      for (const mind of minds) mind.cleanup();
      this.activeMinds.delete(groupId);
    }
    this.initializedGroups.delete(groupId);
    this.sessionIds.delete(groupId);
    this.drainRequests.delete(groupId);
    const retryTimer = this.retryTimers.get(groupId);
    if (retryTimer) clearTimeout(retryTimer);
    this.retryTimers.delete(groupId);
    const continuationTimer = this.continuationTimers.get(groupId);
    if (continuationTimer) clearTimeout(continuationTimer);
    this.continuationTimers.delete(groupId);
    this.lastGroupMessages.delete(groupId);
    void this.turnCoordinator.cancelGroup(groupId).catch(error => {
      eventBus.emitError('GroupEngine', error, 'GROUP_QUEUE_CANCEL_FAILED');
    });
  }

  public dispose(): void {
    eventBus.off('group:message_send', this.broadcastToMinds);
    eventBus.off('group:message_reaction', this.handleGroupReaction);
    eventBus.off('ai:group_response_ready', this.handleLegacyBotResponse);
    eventBus.off('persona:adaptation_updated', this.handlePersonaAdaptation);
    for (const groupId of [...this.activeMinds.keys()]) this.destroyGroupSession(groupId);
  }

  private setupGlobalListeners(): void {
    eventBus.on('group:message_send', this.broadcastToMinds);
    eventBus.on('group:message_reaction', this.handleGroupReaction);
    eventBus.on('ai:group_response_ready', this.handleLegacyBotResponse);
    eventBus.on('persona:adaptation_updated', this.handlePersonaAdaptation);
  }

  private handlePersonaAdaptation = ({ chatId }: { chatId: string }) => {
    for (const [groupId, minds] of this.activeMinds.entries()) {
      if (!minds.some(mind => mind.getPersonaId() === chatId)) continue;
      void this.dependencies.getChatSession(groupId).then(async group => {
        if (!group?.isGroup) return;
        const members = (await Promise.all(
          (group.memberIds || []).map(memberId => this.dependencies.getChatSession(memberId)),
        )).filter((member): member is ChatSession => Boolean(member && !member.isGroup));
        await this.initGroupSession(group, members);
      }).catch(error => eventBus.emitError('GroupEngine', error, 'GROUP_PERSONA_REFRESH_FAILED'));
    }
  };

  private broadcastToMinds = (payload: RafiqEventMap['group:message_send']) => {
    if (!this.initializedGroups.has(payload.groupId)) return;
    const minds = this.activeMinds.get(payload.groupId) || [];
    const mentionedPersonaIds = minds
      .filter(mind => mind.isDirectlyMentioned(payload.text))
      .map(mind => mind.getPersonaId());

    eventBus.emit('persona:perceive_message', {
      groupId: payload.groupId,
      targetId: 'ALL',
      fromId: payload.senderId,
      fromName: payload.senderName || 'User',
      text: payload.text,
      msgId: payload.msgId,
      rootMessageId: payload.rootMessageId || payload.msgId,
      depth: payload.depth ?? (payload.senderId === 'user' ? 0 : 1),
      eligiblePersonaIds: mentionedPersonaIds.length > 0 ? mentionedPersonaIds : undefined,
      attachmentIds: payload.attachmentIds,
      reactionContext: payload.reactionContext,
    });
  };

  private async schedulePersistentTurn(
    groupId: string,
    sessionId: string,
    input: EnqueueGroupTurnInput,
  ): Promise<boolean> {
    if (!this.isActiveSession(groupId, sessionId, input.speakerBotId)) return false;

    try {
      await this.turnCoordinator.enqueue(input);
      void this.drainPersistentJobs(groupId);
      return true;
    } catch (error) {
      if (error instanceof GroupBudgetExceededError) return false;
      eventBus.emitError('GroupEngine', error, 'GROUP_JOB_ENQUEUE_FAILED');
      return false;
    }
  }

  private async drainPersistentJobs(groupId: string): Promise<void> {
    if (!this.initializedGroups.has(groupId)) return;
    if (this.drainingGroups.has(groupId)) {
      this.drainRequests.add(groupId);
      return;
    }
    this.drainingGroups.add(groupId);

    try {
      while (this.initializedGroups.has(groupId)) {
        const result = await this.turnCoordinator.runNext(groupId, (job, signal) => (
          this.executeGroupJob(job, signal)
        ));
        if (!result) break;
        if (result.status === 'queued') {
          this.scheduleRetry(groupId, result.runAfter);
          break;
        }
      }
    } catch (error) {
      eventBus.emitError('GroupEngine', error, 'GROUP_QUEUE_DRAIN_FAILED');
    } finally {
      this.drainingGroups.delete(groupId);
      const replayRequested = this.drainRequests.delete(groupId);
      if (replayRequested && this.initializedGroups.has(groupId)) {
        void this.drainPersistentJobs(groupId);
      }
    }
  }

  private scheduleRetry(groupId: string, runAfter: Date): void {
    const existing = this.retryTimers.get(groupId);
    if (existing) clearTimeout(existing);
    const delay = Math.max(0, runAfter.getTime() - Date.now());
    const timer = setTimeout(() => {
      this.retryTimers.delete(groupId);
      void this.drainPersistentJobs(groupId);
    }, Math.min(delay, 60_000));
    this.retryTimers.set(groupId, timer);
  }

  private async executeGroupJob(
    job: CoordinatedGroupTurnJob,
    signal: AbortSignal,
  ) {
    if (!this.initializedGroups.has(job.groupId)) {
      throw new DOMException('Group session is not active.', 'AbortError');
    }
    const mind = (this.activeMinds.get(job.groupId) || []).find(
      candidate => candidate.getPersonaId() === job.speakerBotId,
    );
    if (!mind) throw new Error('Scheduled group persona is not an active member.');

    const generated = await mind.generateScheduledTurn(job, signal);
    if (signal.aborted) throw new DOMException('Group turn cancelled.', 'AbortError');
    const botConfig = await this.dependencies.getChatSession(job.speakerBotId);
    if (!botConfig) throw new Error('Scheduled group bot no longer exists.');

    if (generated.kind === 'reaction') {
      await this.dependencies.saveGroupReaction(job.groupId, job.causalMessageId, {
        senderId: job.speakerBotId,
        senderName: botConfig.settings.botName,
        emoji: generated.emoji,
      });
      eventBus.emit('group:message_reaction', {
        groupId: job.groupId,
        messageId: job.causalMessageId,
        senderId: job.speakerBotId,
        senderName: botConfig.settings.botName,
        emoji: generated.emoji,
      });
      return {
        outputMessageId: `group-reaction-${job.id}`,
        modelCallsUsed: generated.modelCallsUsed,
        actualCostMicros: 0,
      };
    }

    if (generated.kind === 'none') {
      return {
        outputMessageId: `group-none-${job.id}`,
        modelCallsUsed: generated.modelCallsUsed,
        actualCostMicros: 0,
      };
    }

    const messageId = `group-turn-${job.id}`;
    const message: ChatMessage = {
      id: messageId,
      chatId: job.groupId,
      role: 'model' as ChatMessage['role'],
      senderId: job.speakerBotId,
      senderName: botConfig.settings.botName,
      rootMessageId: job.rootMessageId,
      replyToMessageId: job.causalMessageId,
      depth: job.triggerDepth + 1,
      text: generated.text,
      timestamp: new Date(),
    };

    await this.dependencies.saveGroupMessage(message);
    if (signal.aborted || !this.initializedGroups.has(job.groupId)) {
      await this.dependencies.deleteGroupMessage(messageId, job.groupId);
      throw new DOMException('Group session changed before persistence completed.', 'AbortError');
    }

    eventBus.emit('group:message_send', {
      groupId: job.groupId,
      senderId: job.speakerBotId,
      senderName: botConfig.settings.botName,
      senderAvatar: botConfig.settings.avatarUrl,
      text: generated.text,
      msgId: messageId,
      rootMessageId: job.rootMessageId,
      replyToMessageId: job.causalMessageId,
      depth: job.triggerDepth + 1,
      reactionContext: job.reactionContext,
    });
    mind.acknowledgePersistedResponse(generated.text, messageId);
    this.scheduleConversationContinuation(job.groupId, {
      id: messageId,
      senderId: job.speakerBotId,
      senderName: botConfig.settings.botName,
      text: generated.text,
    });

    return {
      outputMessageId: messageId,
      modelCallsUsed: generated.modelCallsUsed,
      actualCostMicros: 0,
    };
  }

  private handleLegacyBotResponse = async (
    payload: RafiqEventMap['ai:group_response_ready'],
  ) => {
    if (!this.isActiveSession(payload.groupId, payload.sessionId, payload.personaId)) return;
    try {
      const botConfig = await this.dependencies.getChatSession(payload.personaId);
      if (!botConfig || !this.isActiveSession(payload.groupId, payload.sessionId, payload.personaId)) {
        payload.acknowledge(false);
        return;
      }
      const messageId = this.dependencies.createMessageId();
      const message: ChatMessage = {
        id: messageId,
        chatId: payload.groupId,
        role: 'model' as ChatMessage['role'],
        senderId: payload.personaId,
        senderName: botConfig.settings.botName,
        rootMessageId: payload.rootMessageId,
        replyToMessageId: payload.triggerMessageId,
        depth: payload.triggerDepth + 1,
        text: payload.text,
        timestamp: new Date(),
      };
      await this.dependencies.saveGroupMessage(message);
      eventBus.emit('group:message_send', {
        groupId: payload.groupId,
        senderId: payload.personaId,
        senderName: botConfig.settings.botName,
        senderAvatar: botConfig.settings.avatarUrl,
        text: payload.text,
        msgId: messageId,
        rootMessageId: payload.rootMessageId,
        replyToMessageId: payload.triggerMessageId,
        depth: payload.triggerDepth + 1,
        attachmentIds: payload.attachmentIds,
        reactionContext: payload.reactionContext,
      });
      this.scheduleConversationContinuation(payload.groupId, {
        id: messageId,
        senderId: payload.personaId,
        senderName: botConfig.settings.botName,
        text: payload.text,
      });
      payload.acknowledge(true);
    } catch (error) {
      payload.acknowledge(false);
      eventBus.emitError('GroupEngine', error, 'GROUP_MESSAGE_SAVE_FAILED');
    }
  };

  private handleGroupReaction = async (payload: RafiqEventMap['group:message_reaction']) => {
    if (!this.initializedGroups.has(payload.groupId)) return;
    try {
      await this.dependencies.saveGroupReaction(payload.groupId, payload.messageId, {
        senderId: payload.senderId,
        senderName: payload.senderName,
        emoji: payload.emoji,
      });
    } catch (error) {
      eventBus.emitError('GroupEngine', error, 'GROUP_REACTION_SAVE_FAILED');
    }
  };

  private isActiveSession(groupId: string, sessionId: string, personaId: string): boolean {
    return (
      this.initializedGroups.has(groupId) &&
      this.sessionIds.get(groupId) === sessionId &&
      (this.activeMinds.get(groupId) || []).some(mind => mind.getPersonaId() === personaId)
    );
  }

  private scheduleConversationContinuation(groupId: string, message: LastGroupMessage): void {
    this.lastGroupMessages.set(groupId, message);
    if (this.continuationTimers.has(groupId)) return;

    const timer = setTimeout(() => {
      this.continuationTimers.delete(groupId);
      void this.continueConversation(groupId);
    }, this.dependencies.continuationDelayMs);
    this.continuationTimers.set(groupId, timer);
  }

  private async continueConversation(groupId: string): Promise<void> {
    if (!this.initializedGroups.has(groupId)) return;

    const pendingJobs = (await this.turnCoordinator.listGroupJobs(groupId)).some(job => (
      job.status === 'queued' || job.status === 'running'
    ));
    if (pendingJobs) return;

    const lastMessage = this.lastGroupMessages.get(groupId);
    const minds = this.activeMinds.get(groupId) || [];
    if (!lastMessage || minds.length < 2) return;

    const previousSpeakerIndex = minds.findIndex(mind => mind.getPersonaId() === lastMessage.senderId);
    const nextSpeaker = minds[(Math.max(previousSpeakerIndex, 0) + 1) % minds.length];
    if (!nextSpeaker || nextSpeaker.getPersonaId() === lastMessage.senderId) return;

    const bot = await this.dependencies.getChatSession(nextSpeaker.getPersonaId());
    if (!bot || !this.initializedGroups.has(groupId)) return;

    const sessionId = this.sessionIds.get(groupId);
    if (!sessionId) return;
    await this.schedulePersistentTurn(groupId, sessionId, {
      groupId,
      rootMessageId: lastMessage.id,
      causalMessageId: lastMessage.id,
      triggerDepth: 0,
      triggerSenderId: lastMessage.senderId,
      triggerSenderName: lastMessage.senderName,
      triggerText: lastMessage.text,
      replyToMessageId: lastMessage.id,
      speakerBotId: bot.id,
      idempotencyKey: `group-continuation:${groupId}:${lastMessage.id}:${bot.id}`,
      modelCallBudget: 1,
      maxAttempts: 3,
    });
  }
}

export const groupEngine = new GroupEngine();
