import type { ContentKind, HumanConversationPrior, ReferenceEvent } from './types.js';

const kinds: ContentKind[] = ['text', 'sticker', 'voice', 'media', 'link', 'deleted'];

const round = (value: number): number => Number(value.toFixed(4));

const median = (values: number[]): number => {
  if (values.length === 0) return 1;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];
};

export function deriveHumanConversationPrior(events: readonly ReferenceEvent[]): HumanConversationPrior {
  if (events.length === 0) {
    return {
      totalEvents: 0,
      shortTextRatio: 0,
      quoteReplyRatio: 0,
      codeSwitchRatio: 0,
      burstMedian: 1,
      burstMean: 1,
      contentKindRatios: {
        text: 0,
        sticker: 0,
        voice: 0,
        media: 0,
        link: 0,
        deleted: 0,
      },
    };
  }

  const textEvents = events.filter((event) => event.contentKind === 'text');
  const shortTextCount = textEvents.filter((event) => event.textLength <= 20).length;
  const quoteCount = events.filter((event) => event.hasQuoteReply).length;
  const codeSwitchCount = events.filter((event) => event.hasCodeSwitch).length;

  const contentCounts: Record<ContentKind, number> = {
    text: 0,
    sticker: 0,
    voice: 0,
    media: 0,
    link: 0,
    deleted: 0,
  };
  for (const event of events) contentCounts[event.contentKind] += 1;

  const burstLengths: number[] = [];
  let runSpeaker = events[0].speakerId;
  let runLength = 0;
  for (const event of events) {
    if (event.speakerId !== runSpeaker) {
      burstLengths.push(runLength);
      runSpeaker = event.speakerId;
      runLength = 1;
    } else {
      runLength += 1;
    }
  }
  burstLengths.push(runLength);

  const contentKindRatios = Object.fromEntries(
    kinds.map((kind) => [kind, round(contentCounts[kind] / events.length)]),
  ) as Record<ContentKind, number>;

  return {
    totalEvents: events.length,
    shortTextRatio: textEvents.length ? round(shortTextCount / textEvents.length) : 0,
    quoteReplyRatio: round(quoteCount / events.length),
    codeSwitchRatio: round(codeSwitchCount / events.length),
    burstMedian: median(burstLengths),
    burstMean: round(burstLengths.reduce((sum, value) => sum + value, 0) / burstLengths.length),
    contentKindRatios,
  };
}
