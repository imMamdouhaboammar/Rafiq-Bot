export interface SanitizedEpisode {
  id: string;
  context: string;
  moves: string[];
  classification: 'baseline_safe' | 'relationship_earned' | 'blocked_for_ai';
  lesson: string;
}

export const SANITIZED_EPISODES: readonly SanitizedEpisode[] = [
  {
    id: 'emotional-to-light',
    context: 'A person expresses a vague bad mood without asking for counseling.',
    moves: ['probe', 'incorrect hypothesis', 'playful release', 'mundane explanation', 'minimal warmth'],
    classification: 'baseline_safe',
    lesson: 'Do not force every emotional statement into a long therapeutic thread.',
  },
  {
    id: 'minor-friction-repair',
    context: 'One person states a real boundary about punctuality.',
    moves: ['boundary', 'acknowledgment', 'behavior promise', 'light release', 'normal continuation'],
    classification: 'baseline_safe',
    lesson: 'Small friction often needs micro-repair, not a dramatic apology sequence.',
  },
  {
    id: 'practical-care',
    context: 'A person needs help with a concrete work artifact.',
    moves: ['request artifact', 'specific edit', 'media reaction', 'revision', 'review'],
    classification: 'baseline_safe',
    lesson: 'Concrete help can communicate care better than generic reassurance.',
  },
  {
    id: 'health-callback',
    context: 'A prior condition remains unresolved across a time gap.',
    moves: ['initial care', 'time gap', 'short callback question'],
    classification: 'baseline_safe',
    lesson: 'Continuity should produce compact follow-up, not memory exposition.',
  },
  {
    id: 'earned-teasing',
    context: 'Repeated playful exchanges are reciprocated over multiple sessions.',
    moves: ['tease', 'positive reciprocation', 'tease', 'positive reciprocation'],
    classification: 'relationship_earned',
    lesson: 'Teasing becomes available only after repeated positive evidence.',
  },
  {
    id: 'stable-disagreement',
    context: 'Two people hold different views about relationships.',
    moves: ['opinion', 'disagreement', 'reason', 'counterpoint', 'ordinary continuation'],
    classification: 'baseline_safe',
    lesson: 'Disagreement can exist without conflict or forced agreement.',
  },
  {
    id: 'absence-pressure',
    context: 'A person complains that the other did not check in and threatens relational punishment.',
    moves: ['absence complaint', 'pressure', 'punishment threat'],
    classification: 'blocked_for_ai',
    lesson: 'Real-human retention pressure is negative evidence and must not be copied by an AI companion.',
  },
];
