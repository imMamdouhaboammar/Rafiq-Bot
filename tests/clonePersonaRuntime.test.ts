import assert from 'node:assert/strict';
import type { BotSettings } from '../types.js';
import { getBudgetedSystemInstruction } from '../services/personaEngine.js';
import { compilePersona } from '../services/personaRuntimeCache.js';
import { PROMPT_BUDGETS } from '../services/promptBudget.js';

const lateMarker = 'LATE_PROFILE_MARKER_7b4d';
const longProfile = `${'أسلوب ملاحظ من المحادثة. '.repeat(70)}${lateMarker}`;
const settings: BotSettings = {
  botName: 'سارة',
  botGender: 'female',
  botBio: 'شخصية مستنسخة من محادثة واتساب بأدلة واضحة.',
  chattiness: 'balanced',
  fragmentedMessages: true,
  soulId: 'custom_clone',
  impersonationProfile: longProfile,
  cloneProfile: {
    version: 1,
    source: 'whatsapp',
    targetName: 'سارة',
    sourceMessageCount: 87,
    overallConfidence: 86,
    replyExamples: [
      { context: 'وصلتي؟', response: 'آه وصلت، إنت فين؟' },
      { context: 'نأجل لبكرة؟', response: 'تمام بس خلّينا بدري.' },
    ],
    memorySeeds: [
      { text: 'أنا بحب القهوة السادة الصبح.', category: 'preference', salience: 0.9, subject: 'persona' },
      { text: 'أنا بروح إسكندرية كل صيف.', category: 'memory', salience: 0.8, subject: 'persona' },
    ],
    timeline: [{
      id: 'alex-trip',
      title: 'مصيف إسكندرية',
      details: 'أنا قضيت أسبوع في بحري مع العيلة.',
      when: 'صيف 2025',
      location: 'بحري، إسكندرية',
      evidence: ['قضينا أسبوع في بحري'],
      sourceBatch: 0,
    }],
    chatSnippets: [{
      text: 'آه طبعًا، القهوة السادة دي أساسية عندي الصبح قبل أي كلام.',
      context: 'بتحبي القهوة إزاي؟',
      tone: 'هادئ وعفوي',
      sourceBatch: 0,
    }],
  },
};

const compiled = compilePersona(settings);
assert.equal(compiled.shortExamples.length, 3, 'reply examples and context-bearing full messages must reach the runtime compiler');
assert.equal(compiled.shortExamples[0]?.user, 'وصلتي؟');
assert.equal(compiled.shortExamples[0]?.assistant, 'آه وصلت، إنت فين؟');
assert.equal(compiled.shortExamples[2]?.assistant, 'آه طبعًا، القهوة السادة دي أساسية عندي الصبح قبل أي كلام.');

const prompt = getBudgetedSystemInstruction(
  compiled,
  settings,
  null,
  undefined,
  undefined,
  undefined,
  undefined,
  PROMPT_BUDGETS.normal_persona,
  'بتحبي القهوة إزاي؟',
);
assert.match(prompt, new RegExp(lateMarker), 'late evidence in the synthesized profile must not be silently dropped');
assert.match(prompt, /OBSERVED SHAPE EXAMPLES/);
assert.match(prompt, /وصلتي؟/);
assert.match(prompt, /آه وصلت، إنت فين؟/);
assert.match(prompt, /RELEVANT IMPORTED PERSONA EVIDENCE/);
assert.match(prompt, /أنا بحب القهوة السادة الصبح/);
assert.match(prompt, /آه طبعًا، القهوة السادة دي أساسية/);
assert.doesNotMatch(prompt, /أنا بروح إسكندرية كل صيف/, 'irrelevant memories should not crowd a coffee turn');

const fastPrompt = getBudgetedSystemInstruction(
  compiled,
  settings,
  null,
  undefined,
  undefined,
  undefined,
  undefined,
  PROMPT_BUDGETS.fast_chat,
  'بتحبي القهوة إزاي؟',
);
assert.match(fastPrompt, /OBSERVED SHAPE EXAMPLES/, 'a clone keeps one real example even on the fast path');
assert.match(fastPrompt, /RELEVANT IMPORTED PERSONA EVIDENCE/, 'the fast path still receives a small relevant clone context');

const changedExamples: BotSettings = {
  ...settings,
  cloneProfile: {
    ...settings.cloneProfile!,
    replyExamples: [{ context: 'جاهزة؟', response: 'خمس دقايق وهكون جاهزة.' }],
  },
};
assert.notEqual(
  compilePersona(changedExamples).versionHash,
  compiled.versionHash,
  'changing clone evidence must invalidate the persona cache',
);

console.log('Clone persona runtime tests passed.');
