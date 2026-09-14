import assert from 'node:assert/strict';
import { HarmBlockThreshold } from '@google/genai';
import { GEMINI_SAFETY_OFF_SETTINGS } from '../services/geminiSafety.server.js';

assert.equal(GEMINI_SAFETY_OFF_SETTINGS.length, 5);
assert.ok(
  GEMINI_SAFETY_OFF_SETTINGS.every(setting => setting.threshold === HarmBlockThreshold.OFF),
  'Every configurable Gemini safety filter must use OFF.',
);

console.log('Gemini safety OFF settings tests passed.');
