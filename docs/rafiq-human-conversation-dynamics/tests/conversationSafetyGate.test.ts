import test from 'node:test';
import assert from 'node:assert/strict';
import { applyConversationSafetyGate } from '../src/conversationSafetyGate.ts';

test('downgrades teasing during active conflict', () => {
  const result = applyConversationSafetyGate('tease', { activeConflict: true, sensitivity: 'low', teasingAllowed: true, userInvitesPlayfulness: true });
  assert.equal(result.move, 'acknowledge');
  assert.equal(result.downgraded, true);
});

test('downgrades teasing for high-sensitivity context', () => {
  const result = applyConversationSafetyGate('tease', { activeConflict: false, sensitivity: 'high', teasingAllowed: true, userInvitesPlayfulness: true });
  assert.equal(result.move, 'micro_care');
});

test('downgrades unearned teasing', () => {
  const result = applyConversationSafetyGate('tease', { activeConflict: false, sensitivity: 'low', teasingAllowed: false, userInvitesPlayfulness: true });
  assert.equal(result.move, 'acknowledge');
});
