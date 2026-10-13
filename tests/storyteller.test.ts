import assert from 'node:assert/strict';
import {
  STORY_STYLES,
  type StorytellerChapter,
  type StorytellerStory,
} from '../contracts/storyteller.js';
import {
  deleteStory,
  exportStoryAsMarkdown,
  exportStoryAsText,
  getStory,
  listStories,
  saveStory,
} from '../services/storytellerRepository.js';
import { matchActiveSkill } from '../services/skillMatcher.js';
import { BUILTIN_SKILLS } from '../services/skillRegistry.js';

// 1. Verify Styles Catalog
console.log('Testing Storyteller Styles Catalog...');
assert.ok(STORY_STYLES.length >= 8, 'Must have at least 8 story styles');

const realism = STORY_STYLES.find(s => s.id === 'egyptian_realism');
assert.ok(realism, 'Egyptian Realism style must exist');
assert.match(realism.label, /واقعية مصرية/);
assert.ok(realism.voiceDirective.length > 20);

const horror = STORY_STYLES.find(s => s.id === 'paranormal_horror');
assert.ok(horror, 'Paranormal Horror style must exist');
assert.match(horror.label, /رعب/);

const freeform = STORY_STYLES.find(s => s.id === 'boundless_freeform');
assert.ok(freeform, 'Boundless Freeform style must exist');
assert.match(freeform.label, /بلا حدود/);

// 2. Verify Story Persistence and Repository
console.log('Testing Storyteller Repository Persistence...');
const mockStoryId = `test_story_${Date.now()}`;
const chapter1: StorytellerChapter = {
  chapterNumber: 1,
  title: 'كشك الأزبكية القديم',
  content: 'كان الليل بارداً في شارع عماد الدين، ورائحة الشاي المغلي تفوح من القهوة المجاورة...',
  summary: 'وصل أحمد إلى الكشك المغلق ووجد الصندوق الخشبي مفتوحاً.',
  cliffhanger: 'ماذا ينتظره تحت البلاطة المخلوعة؟',
  wordCount: 15,
  createdAt: new Date().toISOString(),
};

const mockStory: StorytellerStory = {
  id: mockStoryId,
  title: 'أسرار شارع عماد الدين',
  logline: 'رحلة شاب مصري يبحث عن هوية صاحب كشك أثري وسط القاهرة.',
  premise: 'شاب يجد مذكرات ترشده إلى كشك تصوير ملعون',
  styleId: 'egyptian_realism',
  styleLabel: 'واقعية مصرية أصيلة',
  targetChapters: 3,
  pacing: 'balanced',
  characters: [
    { name: 'أحمد', role: 'البطل', description: 'شاب في أواخر العشرينات هاوٍ للآثار' },
    { name: 'عم محروس', role: 'المرشد', description: 'عجوز قروي قاطن بوسط البلد' },
  ],
  plannedChapters: [
    { chapterNumber: 1, title: 'كشك الأزبكية القديم', objective: 'اكتشاف المذكرات' },
    { chapterNumber: 2, title: 'الوجه الآخر للصندوق', objective: 'كشف الخدعة الأولى' },
    { chapterNumber: 3, title: 'نهاية السر', objective: 'المواجهة الحاسمة' },
  ],
  chapters: [chapter1],
  currentChapterIndex: 0,
  status: 'in_progress',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Save
await saveStory(mockStory);
const fetched = await getStory(mockStoryId);
assert.ok(fetched, 'Saved story must be retrievable');
assert.equal(fetched.id, mockStoryId);
assert.equal(fetched.title, 'أسرار شارع عماد الدين');
assert.equal(fetched.chapters.length, 1);
assert.equal(fetched.status, 'in_progress');

// List
const allStories = await listStories();
assert.ok(allStories.some(s => s.id === mockStoryId), 'Story list must include newly saved story');

// Add Chapter 2 and complete story
const chapter2: StorytellerChapter = {
  chapterNumber: 2,
  title: 'الوجه الآخر للصندوق',
  content: 'انحنى أحمد ليرفع الصندوق الخشبي، لتصدمه رؤية بطاقة عليها اسمه وصورته!',
  summary: 'اكتشاف صورة أحمد داخل الصندوق.',
  cliffhanger: 'من وضع صورته هناك قبل خمسين عاماً؟',
  wordCount: 14,
  createdAt: new Date().toISOString(),
};

const chapter3: StorytellerChapter = {
  chapterNumber: 3,
  title: 'نهاية السر',
  content: 'اتضحت الحقيقة أخيراً: الكشك لم يكن سوى مرآة لروحه وأسلافه.',
  summary: 'حل لغز الكشك وصورة الأسلاف.',
  cliffhanger: 'وهكذا أُغلقت أبواب عماد الدين إلى الأبد.',
  wordCount: 13,
  createdAt: new Date().toISOString(),
};

const updatedStory: StorytellerStory = {
  ...mockStory,
  chapters: [chapter1, chapter2, chapter3],
  status: 'completed',
};

await saveStory(updatedStory);
const fetchedUpdated = await getStory(mockStoryId);
assert.ok(fetchedUpdated);
assert.equal(fetchedUpdated.chapters.length, 3);
assert.equal(fetchedUpdated.status, 'completed');

// 3. Test Markdown and Text Exporters
console.log('Testing Markdown & Text Exporters...');
const md = exportStoryAsMarkdown(fetchedUpdated);
assert.match(md, /# أسرار شارع عماد الدين/);
assert.match(md, /## الفصل 1: كشك الأزبكية القديم/);
assert.match(md, /## الفصل 2: الوجه الآخر للصندوق/);
assert.match(md, /## الفصل 3: نهاية السر/);
assert.match(md, /أحمد/);

const txt = exportStoryAsText(fetchedUpdated);
assert.match(txt, /أسرار شارع عماد الدين/);
assert.match(txt, /\[ الفصل 1: كشك الأزبكية القديم \]/);

// Delete
await deleteStory(mockStoryId);
const afterDelete = await getStory(mockStoryId);
assert.equal(afterDelete, undefined, 'Story must be deleted');

// 4. Test Skill Matcher for Storyteller
console.log('Testing Skill Matcher for Storyteller...');
const match1 = matchActiveSkill('/story احكيلي قصة رعب', BUILTIN_SKILLS);
assert.ok(match1, 'Should match /story slash command');
assert.equal(match1.skill.id, 'storyteller-boundless');

const match2 = matchActiveSkill('/حكاية', BUILTIN_SKILLS);
assert.ok(match2, 'Should match /حكاية arabic slash alias');
assert.equal(match2.skill.id, 'storyteller-boundless');

const match3 = matchActiveSkill('ألفلي قصة خيال علمي', BUILTIN_SKILLS);
assert.ok(match3, 'Should match keyword trigger for story');
assert.equal(match3.skill.id, 'storyteller-boundless');

console.log('All Storyteller tests passed successfully! ✅');
