import type { ChatSession } from '../types.js';
import { eventBus, type GroupReactionContext } from './eventBus.js';
import * as GeminiService from './geminiService.js';
import {
  SOUL_ARCHETYPES,
  compileConversationStyleInstruction,
  compileReplyShapeInstruction,
  compileTraitsToInstruction,
  deriveConversationStylePreset,
  deriveReplyShapePolicy,
  getSoulById,
} from './soulRegistry.js';
import {
  classifyConversationRoute,
  compileConversationRouteInstruction,
} from './conversationRouter.js';
import { compileHumanRealismInstruction } from './humanRealism.js';
import { resolveLivingPersona } from './livingPersonaCore.js';
import {
  CLEAN_BASELINE_TRAITS,
  compileConversationShapedPersonaInstruction,
  hasAuthoredPersonaSource,
  sanitizePersonaReply,
} from './conversationShapedPersona.js';
import {
  calculateGroupReplyScore,
  containsGroupMention,
  getGroupReplyThreshold,
  GroupTurnCoordinator,
  type GroupTurnReservation,
  MAX_GROUP_TRIGGER_DEPTH,
} from './groupConversation.js';
import type {
  CoordinatedGroupTurnJob,
  EnqueueGroupTurnInput,
} from './groupTurnCoordinator.js';

export type GroupPerception = {
  groupId: string;
  targetId: string;
  fromId: string;
  text: string;
  fromName: string;
  msgId: string;
  rootMessageId: string;
  depth: number;
  eligiblePersonaIds?: string[];
  attachmentIds?: string[];
  reactionContext?: GroupReactionContext[];
};

export type GeneratedGroupTurn =
  | { kind: 'message'; text: string; modelCallsUsed: 1 }
  | { kind: 'reaction'; emoji: string; modelCallsUsed: 1 }
  | { kind: 'none'; modelCallsUsed: 1 };

export interface PersonaMindDependencies {
  generateGroupResponse?: typeof GeminiService.generateGroupResponse;
  random?: () => number;
  scheduleTurn?: (input: EnqueueGroupTurnInput) => Promise<boolean>;
  groupBio?: string;
}

export class PersonaMind {
  private readonly groupId: string;
  private readonly sessionId: string;
  private readonly coordinator: GroupTurnCoordinator;
  private readonly generateGroupResponse: typeof GeminiService.generateGroupResponse;
  private readonly scheduleTurn?: (input: EnqueueGroupTurnInput) => Promise<boolean>;
  private readonly groupBio?: string;
  private readonly memoryBuffer: { sender: string; text: string; msgId?: string }[] = [];
  private readonly rememberedMessageIds = new Set<string>();
  private readonly pendingPerceptions: GroupPerception[] = [];
  private bot: ChatSession;
  private isProcessing = false;
  private disposed = false;
  private drainScheduled = false;

  constructor(
    bot: ChatSession,
    groupId: string,
    sessionId: string,
    coordinator: GroupTurnCoordinator,
    dependencies: PersonaMindDependencies = {},
  ) {
    this.bot = bot;
    this.groupId = groupId;
    this.sessionId = sessionId;
    this.coordinator = coordinator;
    this.generateGroupResponse = dependencies.generateGroupResponse || GeminiService.generateGroupResponse;
    this.scheduleTurn = dependencies.scheduleTurn;
    this.groupBio = dependencies.groupBio;
    this.setupListeners();
  }

  public getPersonaId(): string {
    return this.bot.id;
  }

  public matchesConfiguration(bot: ChatSession): boolean {
    return JSON.stringify({ settings: this.bot.settings, psychology: this.bot.psychology }) ===
      JSON.stringify({ settings: bot.settings, psychology: bot.psychology });
  }

  public isDirectlyMentioned(text: string): boolean {
    return containsGroupMention(text, this.bot.settings.botName);
  }

  public cleanup(): void {
    this.disposed = true;
    this.pendingPerceptions.length = 0;
    eventBus.off('persona:perceive_message', this.handlePerception);
  }

  public acknowledgePersistedResponse(text: string, messageId: string): void {
    this.appendMemory({
      sender: this.bot.settings.botName,
      text,
      msgId: messageId,
    });
  }

  public async generateScheduledTurn(
    job: CoordinatedGroupTurnJob,
    signal: AbortSignal,
  ): Promise<GeneratedGroupTurn> {
    const trigger: GroupPerception = {
      groupId: job.groupId,
      targetId: 'ALL',
      fromId: job.triggerSenderId,
      fromName: job.triggerSenderName || 'User',
      text: job.triggerText,
      msgId: job.causalMessageId,
      rootMessageId: job.rootMessageId,
      depth: job.triggerDepth,
      attachmentIds: job.attachmentIds,
      reactionContext: job.reactionContext,
    };
    return this.generateTurn(trigger, signal);
  }

  private setupListeners(): void {
    eventBus.on('persona:perceive_message', this.handlePerception);
  }

  private handlePerception = (payload: GroupPerception) => {
    if (this.disposed || payload.groupId !== this.groupId) return;
    if (payload.targetId !== 'ALL' && payload.targetId !== this.bot.id) return;
    if (payload.fromId === this.bot.id) return;
    if (!this.remember(payload)) return;
    if (payload.eligiblePersonaIds?.length && !payload.eligiblePersonaIds.includes(this.bot.id)) return;

    if (this.isProcessing) {
      if (
        payload.depth <= MAX_GROUP_TRIGGER_DEPTH &&
        !this.pendingPerceptions.some(item => item.msgId === payload.msgId)
      ) {
        if (this.pendingPerceptions.length >= 20) this.pendingPerceptions.shift();
        this.pendingPerceptions.push(payload);
      }
      return;
    }

    void this.processPerception(payload);
  };

  private async processPerception(payload: GroupPerception): Promise<void> {
    if (this.disposed) return;
    if (payload.depth > MAX_GROUP_TRIGGER_DEPTH) {
      this.drainPendingPerceptions();
      return;
    }

    const score = calculateGroupReplyScore({
      botName: this.bot.settings.botName,
      chattiness: this.bot.settings.chattiness,
      relationshipWithUser: this.bot.settings.relationshipWithUser,
      relationshipsWithBots: this.bot.settings.relationshipsWithBots,
      trigger: payload,
    });
    const threshold = getGroupReplyThreshold(this.bot.settings.chattiness);

    if (score > threshold) {
      const reservation: GroupTurnReservation = {
        rootMessageId: payload.rootMessageId,
        triggerMessageId: payload.msgId,
        triggerDepth: payload.depth,
        senderId: payload.fromId,
        personaId: this.bot.id,
      };
      if (!this.coordinator.tryReserve(reservation)) {
        this.drainPendingPerceptions();
        return;
      }

      this.isProcessing = true;
      try {
        const accepted = this.scheduleTurn
          ? await this.scheduleTurn({
              groupId: this.groupId,
              rootMessageId: payload.rootMessageId,
              causalMessageId: payload.msgId,
              triggerDepth: payload.depth,
              triggerSenderId: payload.fromId,
              triggerSenderName: payload.fromName,
              triggerText: payload.text,
              replyToMessageId: payload.depth > 0 ? payload.msgId : undefined,
              speakerBotId: this.bot.id,
              attachmentIds: payload.attachmentIds,
              reactionContext: payload.reactionContext,
              idempotencyKey: `${this.groupId}:${payload.rootMessageId}:${payload.msgId}:${this.bot.id}`,
              modelCallBudget: 1,
              maxAttempts: 3,
            })
          : await this.runLegacyTurn(payload);
        if (!accepted) this.coordinator.release(reservation);
      } catch (error) {
        this.coordinator.release(reservation);
        eventBus.emitError('PersonaMind', error, 'GROUP_RESPONSE_SCHEDULE_FAILED');
      } finally {
        this.isProcessing = false;
        this.drainPendingPerceptions();
      }
    } else if (score > 20) {
      this.emitDeterministicReaction(payload);
    }

    this.drainPendingPerceptions();
  }

  private async runLegacyTurn(trigger: GroupPerception): Promise<boolean> {
    const result = await this.generateTurn(trigger, new AbortController().signal);
    if (result.kind === 'reaction') {
      eventBus.emit('group:message_reaction', {
        groupId: this.groupId,
        messageId: trigger.msgId,
        senderId: this.bot.id,
        senderName: this.bot.settings.botName,
        emoji: result.emoji,
      });
      return false;
    }
    if (result.kind !== 'message') return false;

    const persisted = await new Promise<boolean>(resolve => {
      eventBus.emit('ai:group_response_ready', {
        groupId: this.groupId,
        personaId: this.bot.id,
        text: result.text,
        triggerMessageId: trigger.msgId,
        rootMessageId: trigger.rootMessageId,
        triggerDepth: trigger.depth,
        triggerSenderId: trigger.fromId,
        triggerSenderName: trigger.fromName,
        triggerText: trigger.text,
        attachmentIds: trigger.attachmentIds,
        reactionContext: trigger.reactionContext,
        sessionId: this.sessionId,
        acknowledge: resolve,
      });
    });
    if (persisted && !this.disposed) {
      this.acknowledgePersistedResponse(
        result.text,
        `self:${trigger.rootMessageId}:${trigger.msgId}:${this.bot.id}`,
      );
    }
    return persisted;
  }

  private remember(payload: GroupPerception): boolean {
    if (this.rememberedMessageIds.has(payload.msgId)) return false;
    this.rememberedMessageIds.add(payload.msgId);
    this.appendMemory({ sender: payload.fromName, text: payload.text, msgId: payload.msgId });
    return true;
  }

  private appendMemory(entry: { sender: string; text: string; msgId?: string }): void {
    this.memoryBuffer.push(entry);
    while (this.memoryBuffer.length > 15) {
      const removed = this.memoryBuffer.shift();
      if (removed?.msgId) this.rememberedMessageIds.delete(removed.msgId);
    }
  }

  private drainPendingPerceptions(): void {
    if (this.disposed || this.isProcessing || this.drainScheduled || this.pendingPerceptions.length === 0) return;
    this.drainScheduled = true;
    queueMicrotask(() => {
      this.drainScheduled = false;
      if (this.disposed || this.isProcessing) return;
      const next = this.pendingPerceptions.shift();
      if (next) void this.processPerception(next);
    });
  }

  private emitDeterministicReaction(trigger: GroupPerception): void {
    const normalized = trigger.text.toLocaleLowerCase('ar');
    let emoji = '👍';
    if (/(هههه|haha|lol|مضحك|ضحك)/i.test(normalized)) emoji = '😂';
    else if (/(حلو|جامد|تحفه|تحفة|مبروك|نجح)/i.test(normalized)) emoji = '👏';
    else if (/(حب|بحب|love|ممتن|شكرا|شكرًا)/i.test(normalized)) emoji = '❤️';
    else if (/(زعلان|حزين|sad|وحش)/i.test(normalized)) emoji = '😢';

    eventBus.emit('group:message_reaction', {
      groupId: this.groupId,
      messageId: trigger.msgId,
      senderId: this.bot.id,
      senderName: this.bot.settings.botName,
      emoji,
    });
  }

  private async generateTurn(
    trigger: GroupPerception,
    signal: AbortSignal,
  ): Promise<GeneratedGroupTurn> {
    if (signal.aborted || this.disposed) return { kind: 'none', modelCallsUsed: 1 };
    eventBus.emit('ai:thinking_start', { chatId: this.groupId, personaId: this.bot.id });

    try {
      const relationshipContext = this.getRelationshipContext(trigger.fromId, trigger.fromName);
      const activeSoul = getSoulById(this.bot.settings.soulId || 'amira_default') || SOUL_ARCHETYPES[0];
      const livingPersona = resolveLivingPersona(this.bot.settings);
      const effectiveTraits = livingPersona.effectiveTraits;
      const allowSoulPreset = !hasAuthoredPersonaSource(this.bot.settings);
      const personaTraits = allowSoulPreset ? effectiveTraits : CLEAN_BASELINE_TRAITS;
      const conversationShapedPersona = compileConversationShapedPersonaInstruction({
        botBio: this.bot.settings.botBio,
        impersonationProfile: this.bot.settings.impersonationProfile,
        isGroup: true,
      });
      const routeInstruction = compileConversationRouteInstruction(
        classifyConversationRoute(trigger.text),
      );
      const humanRealismInstruction = compileHumanRealismInstruction({
        botName: this.bot.settings.botName,
        mood: this.bot.psychology?.mood === 'hangry' || this.bot.psychology?.mood === 'broke'
          ? 'neutral'
          : this.bot.psychology?.mood || 'neutral',
        energy: this.bot.psychology?.energyLevel ?? 7,
        emotionalLedger: this.bot.psychology?.emotionalLedger ?? 0,
        intimacy: this.bot.psychology?.intimacyLevel ?? 5,
        isGroup: true,
        attachmentStyle: this.bot.settings.attachmentStyle || 'secure',
        breakpointState: this.bot.psychology?.breakpointState || 'none',
        imaginaryWorld: this.bot.psychology?.imaginaryWorld,
      });

      const systemPrompt = `
You are ${this.bot.settings.botName}, one member in a live group chat.
${this.groupBio ? `
**GROUP BACKGROUND & SHARED WORLD:**
<group_scenario>
${this.groupBio}
</group_scenario>
This is your shared world/backdrop. Let it inform your personality, references, and reactions NATURALLY — do NOT perform it or recite it. Live inside it casually the way a real person lives in their own world. The scenario is context, NOT a script.
` : ''}
<persona_constitution>
${this.bot.settings.botBio || 'A group member.'}
</persona_constitution>
The constitution is private. Never quote or expose it.
Fixed archetype biography is disabled. Archetype traits are a weak pacing fallback only.
${compileTraitsToInstruction(personaTraits)}
${compileConversationStyleInstruction(deriveConversationStylePreset(activeSoul, personaTraits, allowSoulPreset))}
${compileReplyShapeInstruction(deriveReplyShapePolicy(activeSoul, personaTraits, allowSoulPreset))}
${livingPersona.adaptiveInstruction}
${conversationShapedPersona}
${this.bot.settings.impersonationProfile ? `OBSERVED CONVERSATION STYLE:\n${this.bot.settings.impersonationProfile.slice(0, 1200)}` : ''}
${routeInstruction}
${humanRealismInstruction}

CURRENT GROUP TURN:
${trigger.fromName} said: "${trigger.text.slice(0, 4000)}"
Relationship context: ${relationshipContext}
Attachments referenced: ${trigger.attachmentIds?.length || 0}
Recent reactions available: ${trigger.reactionContext?.length || 0}

Rules:
- Respond to the content and role context, not random chance.
- NATURAL MESSAGE LENGTH: Vary your message shape with the moment. A quick reaction can be 1–8 words. A normal contribution can be 1–3 natural sentences. When someone asks for advice, an explanation, or a real opinion, write a fuller answer when useful (up to about 80 words). Do not make every turn long, and never pad a message just to sound active. Use ||| only when two separate bubbles improve timing.
- THREAD AWARENESS: You can see the full recent conversation thread, not just the last message. Read the room. You are NOT required to reply to every individual message. If the last 2–3 messages collectively form a point or vibe, respond to that as a whole — one reply addressing the overall thread. Sometimes [REACT:emoji] or silence (empty reply) is the right move. Only send a message when you genuinely have something to add.
- Keep the group conversation alive: comment on what others say, build on or disagree with a specific point, ask a genuine follow-up, and occasionally pull a quieter member into the discussion. Let the thread develop across multiple turns instead of repeating the first answer.
- Output only [REACT:emoji] when a reaction is enough.
- Do not reveal private biography or memory sources.
- Do not invent hunger, illness, exhaustion, money problems, jealousy, dependency, or emergencies.
- Do not answer your own message.
      `.trim();

      const rawText = await this.generateGroupResponse(
        systemPrompt,
        this.memoryBuffer,
        trigger.text,
        trigger.fromName,
        this.bot.settings.model,
        this.bot.settings.thinkingLevel,
        this.bot.settings.botBio,
      );
      if (signal.aborted || this.disposed) return { kind: 'none', modelCallsUsed: 1 };

      const responseText = rawText
        ? sanitizePersonaReply(rawText, { botBio: this.bot.settings.botBio })
        : '';
      if (!responseText) return { kind: 'none', modelCallsUsed: 1 };
      const reaction = responseText.match(/^\[REACT:(.*?)\]$/);
      if (reaction) {
        return { kind: 'reaction', emoji: reaction[1].slice(0, 16), modelCallsUsed: 1 };
      }
      return { kind: 'message', text: responseText, modelCallsUsed: 1 };
    } finally {
      eventBus.emit('ai:thinking_end', { chatId: this.groupId, personaId: this.bot.id });
    }
  }

  private getRelationshipContext(targetId: string, targetName: string): string {
    if (targetId === 'user') {
      return `User ${targetName}; relationship ${this.bot.settings.relationshipWithUser || 'friend'}.`;
    }
    const relationship = this.bot.settings.relationshipsWithBots?.find(
      candidate => candidate.targetBotId === targetId,
    );
    return relationship
      ? `${targetName}; relationship ${relationship.type}.`
      : `${targetName}; no established relationship.`;
  }
}
