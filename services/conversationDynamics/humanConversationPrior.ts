import type { HumanConversationPrior } from './types.js';

/**
 * Aggregate-only reference prior derived from the supplied long-form natural chat.
 * No raw messages, names, topics, or private details are retained.
 */
export const REFERENCE_HUMAN_CONVERSATION_PRIOR_V1: Readonly<HumanConversationPrior> = Object.freeze({
  totalEvents: 2731,
  shortTextRatio: 0.795,
  quoteReplyRatio: 0.0915,
  codeSwitchRatio: 0.0696,
  burstMedian: 1,
  burstMean: 1.65,
  contentKindRatios: {
    text: 0.848,
    sticker: 0.063,
    voice: 0.047,
    media: 0.027,
    link: 0.014,
    deleted: 0.001,
  },
});
