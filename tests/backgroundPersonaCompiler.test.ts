import assert from 'node:assert/strict';
import { BotMood, type BotSettings } from '../types.js';
import {
  BACKGROUND_PERSONA_BASELINE,
  compileBackgroundPersona,
  convertLegacySoulTraitsToEvidence,
} from '../services/backgroundPersonaCompiler.js';

const settings: BotSettings = {
  botName: 'سارة',
  botGender: 'female',
  botBio: 'زميلة عملية وهادئة تقول رأيها بوضوح.',
  chattiness: 'balanced',
  fragmentedMessages: true,
  soulId: 'chaotic_bestie',
  soulTraits: {
    chaos: 100,
    empathy: 0,
    slang: 100,
    intellect: 100,
    positivity: 0,
  },
};

const converted = convertLegacySoulTraitsToEvidence(settings.soulTraits);
assert.deepEqual(converted, {
  chaos: 27,
  empathy: 54,
  slang: 52,
  intellect: 61,
  positivity: 50,
});
assert.notDeepEqual(converted, settings.soulTraits, 'legacy mixer values must be damped');
assert.deepEqual(convertLegacySoulTraitsToEvidence(), BACKGROUND_PERSONA_BASELINE);

const compilation = compileBackgroundPersona({
  settings,
  adaptiveInstruction: '- more direct after repeated corrections.',
  mood: BotMood.HANGRY,
  socialAgency: {
    boldness: 80,
    proactivity: 20,
    unsolicitedDailyLimit: 1,
    cooldownHours: 12,
    quietHours: {
      enabled: true,
      startHour: 23,
      endHour: 8,
      timezone: 'Africa/Cairo',
    },
  },
});

assert.match(compilation.stableInstruction, /BACKGROUND PERSONA COMPILER/);
assert.match(compilation.stableInstruction, /زميلة عملية وهادئة/);
assert.match(compilation.stableInstruction, /more direct after repeated corrections/);
assert.match(compilation.stableInstruction, /weak historical evidence/);
assert.doesNotMatch(compilation.stableInstruction, /chaotic_bestie/);
assert.match(compilation.moodInstruction, /neutral/);
assert.doesNotMatch(compilation.moodInstruction, /hangry/i);
assert.match(compilation.moodInstruction, /never creates biography, illness, hunger/);
assert.match(compilation.socialAgencyInstruction, /الجرأة لا تعني إطالة الرد/);
assert.equal(compilation.usedLegacyEvidence, true);
assert.match(compilation.revision, /^background:/);

const repeated = compileBackgroundPersona({ settings, mood: BotMood.NEUTRAL });
assert.deepEqual(repeated.effectiveTraits, compilation.effectiveTraits, 'compilation must be deterministic');

console.log('Background persona compiler tests passed.');
