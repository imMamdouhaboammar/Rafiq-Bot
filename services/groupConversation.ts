import type { BotRelationship, ChattinessLevel } from '../types.js';
import { RelationType } from '../types.js';

export const MAX_GROUP_PRIMARY_REPLIES = 3;
export const MAX_GROUP_FOLLOW_UP_REPLIES = 12;
export const MAX_GROUP_BOT_MESSAGES = 15;
export const MAX_GROUP_TRIGGER_DEPTH = 8;

export interface GroupTurnReservation {
  rootMessageId: string;
  triggerMessageId: string;
  triggerDepth: number;
  senderId: string;
  personaId: string;
}

interface GroupTurnState {
  primaryReplies: number;
  followUpReplies: number;
  totalBotMessages: number;
  reservations: Set<string>;
  touchedAt: number;
}

export interface GroupTurnCoordinatorOptions {
  maxPrimaryReplies?: number;
  maxFollowUpReplies?: number;
  maxBotMessages?: number;
  maxTrackedTurns?: number;
}

export class GroupTurnCoordinator {
  private readonly maxPrimaryReplies: number;
  private readonly maxFollowUpReplies: number;
  private readonly maxBotMessages: number;
  private readonly maxTrackedTurns: number;
  private readonly turns = new Map<string, GroupTurnState>();

  constructor(options: GroupTurnCoordinatorOptions = {}) {
    this.maxPrimaryReplies = options.maxPrimaryReplies ?? MAX_GROUP_PRIMARY_REPLIES;
    this.maxFollowUpReplies = options.maxFollowUpReplies ?? MAX_GROUP_FOLLOW_UP_REPLIES;
    this.maxBotMessages = options.maxBotMessages ?? MAX_GROUP_BOT_MESSAGES;
    this.maxTrackedTurns = options.maxTrackedTurns ?? 50;
  }

  tryReserve(reservation: GroupTurnReservation): boolean {
    if (
      reservation.senderId === reservation.personaId ||
      reservation.triggerDepth < 0 ||
      reservation.triggerDepth > MAX_GROUP_TRIGGER_DEPTH
    ) {
      return false;
    }

    const state = this.getOrCreateTurn(reservation.rootMessageId);
    const reservationKey = `${reservation.triggerMessageId}:${reservation.personaId}`;
    if (state.reservations.has(reservationKey) || state.totalBotMessages >= this.maxBotMessages) {
      return false;
    }
    if (reservation.triggerDepth === 0 && state.primaryReplies >= this.maxPrimaryReplies) return false;
    if (reservation.triggerDepth > 0 && state.followUpReplies >= this.maxFollowUpReplies) return false;

    state.reservations.add(reservationKey);
    state.totalBotMessages += 1;
    state.touchedAt = Date.now();
    if (reservation.triggerDepth === 0) state.primaryReplies += 1;
    else state.followUpReplies += 1;
    return true;
  }

  release(reservation: GroupTurnReservation): void {
    const state = this.turns.get(reservation.rootMessageId);
    if (!state) return;
    const reservationKey = `${reservation.triggerMessageId}:${reservation.personaId}`;
    if (!state.reservations.delete(reservationKey)) return;

    state.totalBotMessages = Math.max(0, state.totalBotMessages - 1);
    if (reservation.triggerDepth === 0) {
      state.primaryReplies = Math.max(0, state.primaryReplies - 1);
    } else {
      state.followUpReplies = Math.max(0, state.followUpReplies - 1);
    }
  }

  clear(rootMessageId: string): void {
    this.turns.delete(rootMessageId);
  }

  private getOrCreateTurn(rootMessageId: string): GroupTurnState {
    const existing = this.turns.get(rootMessageId);
    if (existing) return existing;

    if (this.turns.size >= this.maxTrackedTurns) {
      const oldest = [...this.turns.entries()]
        .sort(([, left], [, right]) => left.touchedAt - right.touchedAt)[0];
      if (oldest) this.turns.delete(oldest[0]);
    }

    const created: GroupTurnState = {
      primaryReplies: 0,
      followUpReplies: 0,
      totalBotMessages: 0,
      reservations: new Set(),
      touchedAt: Date.now(),
    };
    this.turns.set(rootMessageId, created);
    return created;
  }
}

interface GroupReplyScoreInput {
  botName: string;
  chattiness: ChattinessLevel;
  relationshipWithUser?: RelationType;
  relationshipsWithBots?: BotRelationship[];
  trigger: {
    text: string;
    fromId: string;
  };
  random?: () => number;
}

const normalizeMentionText = (value: string): string => value
  .normalize('NFKC')
  .toLocaleLowerCase('ar-EG')
  .replace(/[ًٌٍَُِّْـ]/g, '');

const tokenizeMentionText = (value: string): string[] => (
  normalizeMentionText(value).match(/[\p{L}\p{N}_]+/gu) || []
);

export const containsGroupMention = (text: string, botName: string): boolean => {
  const textTokens = tokenizeMentionText(text);
  const nameTokens = tokenizeMentionText(botName);
  if (nameTokens.length === 0 || nameTokens.length > textTokens.length) return false;

  return textTokens.some((_, startIndex) => nameTokens.every(
    (token, nameIndex) => textTokens[startIndex + nameIndex] === token,
  ));
};

const getRelationshipScore = (relationship?: RelationType): number => {
  switch (relationship) {
    case RelationType.PARTNER:
    case RelationType.FIANCE:
    case RelationType.SPOUSE:
      return 65;
    case RelationType.BEST_FRIEND:
    case RelationType.CHILDHOOD_FRIEND:
      return 60;
    case RelationType.RIVAL:
      return 55;
    case RelationType.FRIEND:
    case RelationType.BROTHER:
    case RelationType.SISTER:
      return 50;
    case RelationType.ENEMY:
      return 30;
    default:
      return 45;
  }
};

export const getGroupReplyThreshold = (chattiness: ChattinessLevel): number => {
  if (chattiness === 'high') return 20;
  if (chattiness === 'low') return 60;
  return 35;
};

const getContentRelevanceScore = (text: string): number => {
  const normalized = normalizeMentionText(text);
  let score = 0;
  if (/[؟?]/.test(normalized)) score += 12;
  if (/(رأيك|رايك|قول|قولي|قولوا|شايف|شايفه|ايه رأي|إيه رأي|what do you think|your opinion)/i.test(normalized)) score += 12;
  if (/(حد|مين|كلكم|يا جماعه|يا جماعة|انتوا|إنتوا|you all|anyone)/i.test(normalized)) score += 6;
  if (normalized.length < 3) score -= 15;
  return score;
};

export const calculateGroupReplyScore = ({
  botName,
  chattiness,
  relationshipWithUser,
  relationshipsWithBots = [],
  trigger,
}: GroupReplyScoreInput): number => {
  if (containsGroupMention(trigger.text, botName)) return 120;

  let score: number;
  if (trigger.fromId === 'user') {
    score = 55;
    if (
      relationshipWithUser === RelationType.PARTNER ||
      relationshipWithUser === RelationType.BEST_FRIEND ||
      relationshipWithUser === RelationType.SPOUSE
    ) {
      score += 10;
    }
  } else {
    const relationship = relationshipsWithBots.find(
      candidate => candidate.targetBotId === trigger.fromId,
    )?.type;
    score = getRelationshipScore(relationship);
  }

  score += getContentRelevanceScore(trigger.text);
  if (chattiness === 'high') score += 10;
  if (chattiness === 'low') score -= 10;
  return Math.max(0, Math.min(120, score));
};
