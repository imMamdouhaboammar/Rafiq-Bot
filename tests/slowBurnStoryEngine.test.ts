import assert from 'node:assert/strict';
import {
  advanceStoryState,
  compileSlowBurnStoryInstruction,
  createInitialStoryState,
  detectSlowBurnStoryIntent,
} from '../services/slowBurnStoryEngine.js';
import { AppMode, type Attachment } from '../types.js';

// 1. Explicit Arabic Story Trigger Tests
const explicitArabicIntent = detectSlowBurnStoryIntent({
  text: 'احكيلي قصة رعب قديمة في حارة في إسكندرية بالتفصيل الممل',
});
assert.equal(explicitArabicIntent.isStory, true);
assert.equal(explicitArabicIntent.kind, 'explicit_request');
assert.equal(explicitArabicIntent.genre, 'رعب وغموض');
assert.equal(explicitArabicIntent.isContinuation, false);

const slowBurnIntent = detectSlowBurnStoryIntent({
  text: 'عايز قصة slow burn عن اتنين أصحاب اتقابلوا بعد عشر سنين',
});
assert.equal(slowBurnIntent.isStory, true);
assert.equal(slowBurnIntent.kind, 'explicit_request');

// 2. Active Story Continuation Trigger Tests
const activeStory = createInitialStoryState({
  chatId: 'chat-story-1',
  title: 'سر العمارة المهجورة',
  genre: 'رعب وغموض',
  premise: 'أحمد دخل العمارة وسمع صوت خطوات في الدور التالت',
});
assert.equal(activeStory.currentChapter, 1);
assert.equal(activeStory.status, 'active');

const continueIntent1 = detectSlowBurnStoryIntent({
  text: 'كمل',
  activeStory,
});
assert.equal(continueIntent1.isStory, true);
assert.equal(continueIntent1.kind, 'continuation');
assert.equal(continueIntent1.isContinuation, true);

const continueIntent2 = detectSlowBurnStoryIntent({
  text: 'وبعدين؟ إيه اللي حصل؟',
  activeStory,
});
assert.equal(continueIntent2.isStory, true);
assert.equal(continueIntent2.kind, 'continuation');

// 3. Media-Triggered Story Tests
const imageAttachment: Attachment = {
  previewUrl: 'opfs://street_night.jpg',
  mimeType: 'image/jpeg',
  category: 'image',
};
const mediaIntent = detectSlowBurnStoryIntent({
  text: 'شوف دي واحكيلي',
  attachments: [imageAttachment],
});
assert.equal(mediaIntent.isStory, true);
assert.equal(mediaIntent.kind, 'media_triggered');
assert.equal(mediaIntent.hasMediaInspiration, true);

// 4. Mode-Forced Story Tests
const modeIntent = detectSlowBurnStoryIntent({
  text: 'قهوة بلدي',
  appMode: AppMode.SLOW_BURN_STORY,
});
assert.equal(modeIntent.isStory, true);
assert.equal(modeIntent.kind, 'mode_forced');

// 5. Non-Story Message Tests
const plainIntent = detectSlowBurnStoryIntent({
  text: 'الساعة كام دلوقتي يا رفيق؟',
});
assert.equal(plainIntent.isStory, false);
assert.equal(plainIntent.kind, 'none');

// 6. Slow Burn Story System Prompt Compilation Tests
const initialInstruction = compileSlowBurnStoryInstruction({
  intent: explicitArabicIntent,
  botName: 'أميرة',
});
assert.match(initialInstruction, /SLOW BURN STORY ENGINE/);
assert.match(initialInstruction, /أميرة/);
assert.match(initialInstruction, /العمق الحسي/);
assert.match(initialInstruction, /التصعيد الهادئ/);
assert.match(initialInstruction, /\|\|\|/);

const continuationInstruction = compileSlowBurnStoryInstruction({
  intent: continueIntent1,
  activeStory,
  botName: 'أميرة',
});
assert.match(continuationInstruction, /الجزء 2/);
assert.match(continuationInstruction, /سر العمارة المهجورة/);
assert.match(continuationInstruction, /واصل الأحداث مباشرة/);

// 7. State Advancement Tests
const advancedStory = advanceStoryState(activeStory, 'أحمد فتح باب الشقة المقفول بسلسلة', 15);
assert.equal(advancedStory.currentChapter, 2);
assert.equal(advancedStory.scenesLog.length, 2);
assert.equal(advancedStory.tensionScore, 50);

console.log('Slow Burn Story Engine tests passed successfully!');
