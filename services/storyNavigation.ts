export interface StoryPosition {
  statusIndex: number;
  storyIndex: number;
}

export interface StoryCollectionShape {
  stories: unknown[];
}

export interface NextStoryResult {
  position: StoryPosition;
  reachedEnd: boolean;
}

const clampPosition = (
  statuses: StoryCollectionShape[],
  position: StoryPosition,
): StoryPosition => {
  if (statuses.length === 0) return { statusIndex: 0, storyIndex: 0 };
  const statusIndex = Math.max(0, Math.min(statuses.length - 1, position.statusIndex));
  const storyCount = statuses[statusIndex]?.stories.length || 0;
  return {
    statusIndex,
    storyIndex: Math.max(0, Math.min(Math.max(0, storyCount - 1), position.storyIndex)),
  };
};

export const getNextStoryPosition = (
  statuses: StoryCollectionShape[],
  current: StoryPosition,
): NextStoryResult => {
  const position = clampPosition(statuses, current);
  if (statuses.length === 0) return { position, reachedEnd: true };

  const currentStories = statuses[position.statusIndex].stories;
  if (position.storyIndex < currentStories.length - 1) {
    return {
      position: { ...position, storyIndex: position.storyIndex + 1 },
      reachedEnd: false,
    };
  }

  if (position.statusIndex < statuses.length - 1) {
    return {
      position: { statusIndex: position.statusIndex + 1, storyIndex: 0 },
      reachedEnd: false,
    };
  }

  return { position, reachedEnd: true };
};

export const getPreviousStoryPosition = (
  statuses: StoryCollectionShape[],
  current: StoryPosition,
): StoryPosition => {
  const position = clampPosition(statuses, current);
  if (statuses.length === 0) return position;

  if (position.storyIndex > 0) {
    return { ...position, storyIndex: position.storyIndex - 1 };
  }

  if (position.statusIndex > 0) {
    const previousStatusIndex = position.statusIndex - 1;
    return {
      statusIndex: previousStatusIndex,
      storyIndex: Math.max(0, statuses[previousStatusIndex].stories.length - 1),
    };
  }

  return position;
};
