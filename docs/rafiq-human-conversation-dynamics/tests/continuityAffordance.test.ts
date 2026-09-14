import test from 'node:test';
import assert from 'node:assert/strict';
import { selectContinuityAffordance } from '../src/continuityAffordance.ts';

const candidates = [
  { id: 'a', kind: 'health', summary: 'follow up on condition', salience: 0.9, relevance: 0.9, due: true, expired: false, resolved: false, sourceEvidenceCount: 2 },
  { id: 'b', kind: 'plan', summary: 'old plan', salience: 1, relevance: 0.2, due: true, expired: false, resolved: false, sourceEvidenceCount: 3 },
] as const;

test('selects at most one relevant unresolved due callback', () => {
  const result = selectContinuityAffordance(candidates, { sensitivity: 'low', callbackBudgetAvailable: true });
  assert.equal(result?.candidateId, 'a');
});

test('does not force callbacks when budget is unavailable', () => {
  const result = selectContinuityAffordance(candidates, { sensitivity: 'low', callbackBudgetAvailable: false });
  assert.equal(result, undefined);
});

test('filters resolved expired and weak-evidence candidates', () => {
  const result = selectContinuityAffordance([
    { ...candidates[0], resolved: true },
    { ...candidates[0], id: 'x', expired: true },
    { ...candidates[0], id: 'y', sourceEvidenceCount: 0 },
  ], { sensitivity: 'low', callbackBudgetAvailable: true });
  assert.equal(result, undefined);
});
