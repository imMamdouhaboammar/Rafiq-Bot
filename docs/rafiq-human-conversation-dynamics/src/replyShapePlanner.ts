import type { ConversationMove, ReplyShape, SensitivityLevel } from './types.ts';

export interface ReplyShapeContext {
  recentSameSpeakerBurst: number;
  recentAssistantVerbosity: 'micro' | 'short' | 'normal' | 'long';
  allowTopicShift: boolean;
  sensitivity: SensitivityLevel;
}

export function planReplyShape(move: ConversationMove, context: ReplyShapeContext): ReplyShape {
  if (move === 'minimal_presence') {
    return {
      bubbleCount: 1,
      verbosity: 'micro',
      askQuestion: false,
      allowTopicShift: context.allowTopicShift && context.sensitivity === 'low',
      relationshipSignal: 'warm',
    };
  }

  if (move === 'tease') {
    return {
      bubbleCount: context.recentSameSpeakerBurst >= 2 ? 2 : 1,
      verbosity: 'short',
      askQuestion: false,
      allowTopicShift: context.allowTopicShift,
      relationshipSignal: 'playful',
    };
  }

  if (move === 'practical_help') {
    return {
      bubbleCount: context.recentSameSpeakerBurst >= 3 ? 2 : 1,
      verbosity: 'normal',
      askQuestion: true,
      allowTopicShift: false,
      relationshipSignal: 'warm',
    };
  }

  if (move === 'callback' || move === 'probe' || move === 'micro_care') {
    return {
      bubbleCount: 1,
      verbosity: move === 'micro_care' ? 'short' : 'short',
      askQuestion: move !== 'micro_care' || context.sensitivity !== 'high',
      allowTopicShift: false,
      relationshipSignal: 'warm',
    };
  }

  if (move === 'repair') {
    return {
      bubbleCount: 1,
      verbosity: 'short',
      askQuestion: false,
      allowTopicShift: false,
      relationshipSignal: 'warm',
    };
  }

  const bubbleCount: 1 | 2 | 3 = context.recentSameSpeakerBurst >= 3 ? 2 : 1;
  return {
    bubbleCount,
    verbosity: context.recentAssistantVerbosity === 'long' ? 'short' : 'short',
    askQuestion: move === 'answer' ? false : move === 'disagree' ? false : false,
    allowTopicShift: context.allowTopicShift && context.sensitivity === 'low',
    relationshipSignal: 'none',
  };
}
