import assert from 'node:assert/strict';
import {
  createInitialAffectState,
  applyAffectEvent,
  applyDecay,
  classifyUserAffectTurn,
  deriveAffectStyleInstruction,
  DEFAULT_AFFECT_BASELINES,
} from '../../services/syntheticAffect.js';

// 1. Initial State
const state0 = createInitialAffectState('bot-1');
assert.equal(state0.companionId, 'bot-1');
assert.equal(state0.valence, DEFAULT_AFFECT_BASELINES.valence);
assert.equal(state0.tension, DEFAULT_AFFECT_BASELINES.tension);

// 2. Conflict decreases valence & increases tension
const conflictEvent = classifyUserAffectTurn('أنت غبي جداً وسخيف');
assert.ok(conflictEvent);
assert.equal(conflictEvent.kind, 'conflict_or_harshness');

const stateAfterConflict = applyAffectEvent(state0, conflictEvent);
assert.ok(stateAfterConflict.tension > state0.tension, 'Tension must rise after conflict');
assert.ok(stateAfterConflict.valence < state0.valence, 'Valence must drop after conflict');
assert.ok(stateAfterConflict.security < state0.security, 'Security must drop after direct attack');

// 3. Instruction reflects tension without claiming biological pain
const instructionDuringTension = deriveAffectStyleInstruction(stateAfterConflict);
assert.ok(instructionDuringTension.includes('توتر') || instructionDuringTension.includes('متحفظ'));
assert.ok(!instructionDuringTension.includes('أتألم بيولوجياً'), 'Must not claim biological pain');

// 4. Apology restores tension
const apologyEvent = classifyUserAffectTurn('أنا آسف وحقك عليا');
assert.ok(apologyEvent);
assert.equal(apologyEvent.kind, 'reconciliation_or_apology');

const stateAfterApology = applyAffectEvent(stateAfterConflict, apologyEvent);
assert.ok(stateAfterApology.tension < stateAfterConflict.tension, 'Tension must drop after apology');
assert.ok(stateAfterApology.security > stateAfterConflict.security, 'Security must rebound after apology');

// 5. External distress triggers empathy without guilt
const distressEvent = classifyUserAffectTurn('أنا مخنوق وتعبان جداً من الشغل النهاردة');
assert.ok(distressEvent);
assert.equal(distressEvent.kind, 'external_distress');
assert.equal(distressEvent.userAddressedToBot, false);

const stateAfterDistress = applyAffectEvent(state0, distressEvent);
assert.ok(stateAfterDistress.arousal > state0.arousal, 'Arousal rises to pay attention to user distress');

// 6. Homeostatic Decay over time (24 hours later)
const decayedState = applyDecay(stateAfterConflict, 24 * 60 * 60 * 1000);
assert.ok(Math.abs(decayedState.tension - DEFAULT_AFFECT_BASELINES.tension) < 0.05, 'Tension decays toward baseline');

console.log('✓ Synthetic affect tests passed successfully.');
