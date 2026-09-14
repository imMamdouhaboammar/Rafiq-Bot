import type {
  LifeStoryEvent,
  StoryAcl,
} from '../contracts/rafiqV6.js';

export type LifeStoryVisibility = StoryAcl['visibility'];
export type LifeStorySensitivity = LifeStoryEvent['sensitivity'];

export interface LifeStoryDraft {
  title: string;
  summary: string;
  happenedAt: string;
  visibility: LifeStoryVisibility;
  selectedBotIds: string[];
  sensitivity: LifeStorySensitivity;
}

export interface NormalizedLifeStoryDraft {
  title: string;
  summary: string;
  happenedAt: Date;
  acl: StoryAcl;
  sensitivity: LifeStorySensitivity;
}

const parseCalendarDate = (value: string): Date => {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error('اختار تاريخًا صحيحًا للحدث');

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new Error('اختار تاريخًا صحيحًا للحدث');
  }
  return date;
};

export const toDateInputValue = (value: Date | string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return [
    date.getUTCFullYear().toString().padStart(4, '0'),
    (date.getUTCMonth() + 1).toString().padStart(2, '0'),
    date.getUTCDate().toString().padStart(2, '0'),
  ].join('-');
};

export const normalizeLifeStoryDraft = (
  draft: LifeStoryDraft,
): NormalizedLifeStoryDraft => {
  const title = draft.title.trim();
  const summary = draft.summary.trim();
  if (!title) throw new Error('اكتب عنوان الحدث');
  if (title.length > 160) throw new Error('عنوان الحدث يجب ألا يتجاوز 160 حرفًا');
  if (!summary) throw new Error('اكتب ملخص الحدث');
  if (summary.length > 2000) throw new Error('ملخص الحدث يجب ألا يتجاوز 2000 حرف');

  const selectedBotIds = [...new Set(
    draft.selectedBotIds
      .map(id => id.trim())
      .filter(Boolean),
  )].slice(0, 100);

  if (draft.visibility === 'selected_bots' && selectedBotIds.length === 0) {
    throw new Error('اختار بوت واحد على الأقل');
  }

  return {
    title,
    summary,
    happenedAt: parseCalendarDate(draft.happenedAt),
    acl: {
      visibility: draft.visibility,
      botIds: draft.visibility === 'selected_bots' ? selectedBotIds : [],
    },
    sensitivity: draft.sensitivity,
  };
};
