export type ContentKind = 'text' | 'sticker' | 'voice' | 'media' | 'link' | 'deleted';

export interface ReferenceEvent {
  speakerId: string;
  timestampMs: number;
  contentKind: ContentKind;
  textLength: number;
  hasQuoteReply: boolean;
  hasCodeSwitch: boolean;
}

export interface HumanConversationPrior {
  totalEvents: number;
  shortTextRatio: number;
  quoteReplyRatio: number;
  codeSwitchRatio: number;
  burstMedian: number;
  burstMean: number;
  contentKindRatios: Record<ContentKind, number>;
}

export type ConversationMove =
  | 'answer'
  | 'acknowledge'
  | 'probe'
  | 'callback'
  | 'micro_care'
  | 'practical_help'
  | 'tease'
  | 'disagree'
  | 'repair'
  | 'topic_shift'
  | 'shared_reference'
  | 'minimal_presence';

export interface RelationshipEvidence {
  teasingPositiveReciprocations: number;
  teasingNegativeCorrections: number;
  nicknameReciprocatedUses: number;
  nicknameSessions: number;
  codeSwitchUserExamples: number;
  codeSwitchSessions: number;
  sharedReferenceReciprocations: number;
  directnessPositiveEvidence: number;
}

export interface RelationshipCalibration {
  teasingAllowed: boolean;
  teasingStrength: 0 | 1 | 2;
  nicknameAllowed: boolean;
  codeSwitchMirroringAllowed: boolean;
  sharedReferenceAllowed: boolean;
  directDisagreementAllowed: boolean;
}

export type SensitivityLevel = 'low' | 'medium' | 'high';

export interface ContinuityCandidate {
  id: string;
  kind: 'health' | 'outcome' | 'plan' | 'practical_task' | 'shared_interest' | 'ritual';
  summary: string;
  salience: number;
  relevance: number;
  due: boolean;
  expired: boolean;
  resolved: boolean;
  sourceEvidenceCount: number;
}

export interface ContinuityAffordance {
  candidateId: string;
  kind: ContinuityCandidate['kind'];
  summary: string;
  score: number;
}

export interface DynamicsInput {
  messageTextLength: number;
  isSocialPing: boolean;
  asksConcreteQuestion: boolean;
  requestsPracticalHelp: boolean;
  expressesDistress: boolean;
  containsCorrection: boolean;
  activeConflict: boolean;
  sensitivity: SensitivityLevel;
  userInvitesPlayfulness: boolean;
  userExpressesOpinion: boolean;
  assistantHasDifferentStableOpinion: boolean;
  recentAssistantVerbosity: 'micro' | 'short' | 'normal' | 'long';
  recentSameSpeakerBurst: number;
  allowTopicShift: boolean;
}

export interface SafetyContext {
  activeConflict: boolean;
  sensitivity: SensitivityLevel;
  teasingAllowed: boolean;
  userInvitesPlayfulness: boolean;
}

export interface SafetyResult {
  move: ConversationMove;
  downgraded: boolean;
  reasons: string[];
}

export interface ReplyShape {
  bubbleCount: 1 | 2 | 3;
  verbosity: 'micro' | 'short' | 'normal';
  askQuestion: boolean;
  allowTopicShift: boolean;
  relationshipSignal: 'none' | 'warm' | 'playful';
}

export interface ConversationPlan {
  move: ConversationMove;
  shape: ReplyShape;
  callback?: ContinuityAffordance;
  safetyReasons: string[];
}
