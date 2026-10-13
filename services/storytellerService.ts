import type {
  BotPersonaContext,
  StoryMediaSeed,
  StoryPacing,
  StoryStyleId,
  StorytellerChapter,
  StorytellerStory,
} from '../contracts/storyteller.js';
import { STORY_STYLES } from '../contracts/storyteller.js';
import {
  generateStorytellerNextChapter,
  generateStorytellerOutlineAndChapter1,
} from './geminiService.js';
import { saveStory } from './storytellerRepository.js';

export interface StartStoryInput {
  premise: string;
  styleId: StoryStyleId;
  customStylePrompt?: string;
  targetChapters: number;
  pacing: StoryPacing;
  chatId?: string;
  botName?: string;
  persona?: BotPersonaContext;
  mediaSeed?: StoryMediaSeed;
}

const countArabicWords = (text: string): number => {
  return text.trim().split(/\s+/).filter(Boolean).length;
};

export const startNewStory = async (input: StartStoryInput): Promise<StorytellerStory> => {
  const {
    premise,
    styleId,
    customStylePrompt,
    targetChapters,
    pacing,
    chatId,
    botName,
    persona,
    mediaSeed,
  } = input;
  const styleOption = STORY_STYLES.find(s => s.id === styleId);
  const styleLabel = styleOption ? styleOption.label : 'مخصص';

  const result = await generateStorytellerOutlineAndChapter1({
    premise,
    styleId,
    customStylePrompt,
    targetChapters,
    pacing,
    botName,
    persona,
    mediaSeed,
  });

  const now = new Date().toISOString();
  const chapter1: StorytellerChapter = {
    chapterNumber: 1,
    title: result.chapter1.title,
    content: result.chapter1.content,
    summary: result.chapter1.summary,
    cliffhanger: result.chapter1.cliffhanger,
    wordCount: countArabicWords(result.chapter1.content),
    createdAt: now,
  };

  const story: StorytellerStory = {
    id: `story_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    chatId,
    title: result.title,
    logline: result.logline,
    premise,
    styleId,
    styleLabel,
    customStylePrompt,
    targetChapters,
    pacing,
    characters: result.characters,
    plannedChapters: result.plannedChapters,
    chapters: [chapter1],
    currentChapterIndex: 0,
    status: targetChapters <= 1 ? 'completed' : 'in_progress',
    persona,
    mediaSeed: mediaSeed
      ? {
          type: mediaSeed.type,
          mimeType: mediaSeed.mimeType,
          previewUrl: mediaSeed.previewUrl,
          name: mediaSeed.name,
        }
      : undefined,
    createdAt: now,
    updatedAt: now,
  };

  await saveStory(story);
  return story;
};

export const generateNextStoryChapter = async (
  story: StorytellerStory,
  userDirective?: string,
  botName?: string,
): Promise<StorytellerStory> => {
  const nextChapterNumber = story.chapters.length + 1;
  if (nextChapterNumber > story.targetChapters) {
    throw new Error('تم بالفعل إنهاء جميع فصول هذه الرواية.');
  }

  const result = await generateStorytellerNextChapter({
    story,
    chapterNumber: nextChapterNumber,
    userDirective,
    botName,
  });

  const now = new Date().toISOString();
  const newChapter: StorytellerChapter = {
    chapterNumber: nextChapterNumber,
    title: result.title,
    content: result.content,
    summary: result.summary,
    cliffhanger: result.cliffhanger,
    wordCount: countArabicWords(result.content),
    createdAt: now,
  };

  const isCompleted = nextChapterNumber >= story.targetChapters;

  const updated: StorytellerStory = {
    ...story,
    chapters: [...story.chapters, newChapter],
    currentChapterIndex: story.chapters.length, // point to new chapter
    status: isCompleted ? 'completed' : 'in_progress',
    updatedAt: now,
  };

  await saveStory(updated);
  return updated;
};

export const regenerateCurrentChapter = async (
  story: StorytellerStory,
  chapterIndex: number,
  userDirective?: string,
  botName?: string,
): Promise<StorytellerStory> => {
  const targetChapter = story.chapters[chapterIndex];
  if (!targetChapter) throw new Error('الفصل غير موجود');

  // If it's chapter 1
  if (targetChapter.chapterNumber === 1) {
    const res = await generateStorytellerOutlineAndChapter1({
      premise: story.premise,
      styleId: story.styleId,
      customStylePrompt: story.customStylePrompt,
      targetChapters: story.targetChapters,
      pacing: story.pacing,
      botName,
    });

    const now = new Date().toISOString();
    const updatedCh1: StorytellerChapter = {
      chapterNumber: 1,
      title: res.chapter1.title,
      content: res.chapter1.content,
      summary: res.chapter1.summary,
      cliffhanger: res.chapter1.cliffhanger,
      wordCount: countArabicWords(res.chapter1.content),
      createdAt: now,
    };

    const updated: StorytellerStory = {
      ...story,
      title: res.title,
      logline: res.logline,
      characters: res.characters,
      plannedChapters: res.plannedChapters,
      chapters: [updatedCh1, ...story.chapters.slice(1)],
      updatedAt: now,
    };

    await saveStory(updated);
    return updated;
  }

  // If chapter > 1, pass story with chapters up to this one
  const storySubslice: StorytellerStory = {
    ...story,
    chapters: story.chapters.slice(0, chapterIndex),
  };

  const result = await generateStorytellerNextChapter({
    story: storySubslice,
    chapterNumber: targetChapter.chapterNumber,
    userDirective,
    botName,
  });

  const now = new Date().toISOString();
  const replacedChapter: StorytellerChapter = {
    chapterNumber: targetChapter.chapterNumber,
    title: result.title,
    content: result.content,
    summary: result.summary,
    cliffhanger: result.cliffhanger,
    wordCount: countArabicWords(result.content),
    createdAt: now,
  };

  const newChapters = [...story.chapters];
  newChapters[chapterIndex] = replacedChapter;

  const updated: StorytellerStory = {
    ...story,
    chapters: newChapters,
    updatedAt: now,
  };

  await saveStory(updated);
  return updated;
};
