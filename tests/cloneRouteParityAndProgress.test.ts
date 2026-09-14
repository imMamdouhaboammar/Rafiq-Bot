import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLONE_ACTION_NAMES } from '../services/cloneActionRegistry.server.js';
import {
  CloneRequestError,
  getCloneRequestErrorMessage,
  synthesizeSoulFromChat,
} from '../services/soulSynthesizer.js';
import type { SoulSynthesisResult, SynthesisProgress } from '../types.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverSource = fs.readFileSync(path.join(repoRoot, 'server.ts'), 'utf8');
const vercelSource = fs.readFileSync(path.join(repoRoot, 'api/gemini.ts'), 'utf8');
const modalSource = fs.readFileSync(path.join(repoRoot, 'components/NewChatModal.tsx'), 'utf8');

assert.deepEqual([...CLONE_ACTION_NAMES].sort(), [
  'analyzeChatAndGeneratePersona',
  'analyzeProgressiveCloneBatch',
  'getParticipantsFromChat',
  'synthesizeSoulFromChat',
]);
assert.match(serverSource, /\.\.\.CLONE_ACTIONS/, 'Express must consume the shared clone action registry');
assert.match(vercelSource, /\.\.\.CLONE_ACTIONS/, 'Vercel must consume the shared clone action registry');
assert.doesNotMatch(modalSource, /p\.name\s*!==\s*['"]You['"]/, 'two-person exports must not guess which participant is the user');
assert.match(modalSource, /setImportTargetName\(''\)/, 'the target must be chosen explicitly after parsing');

const originalFetch = globalThis.fetch;
const minimalResult = {
  settings: {},
  blueprint: {},
  memorySeeds: [],
  statistics: {},
  confidence: { linguistic: 80, psychological: 80, overall: 80 },
} as unknown as SoulSynthesisResult;

try {
  globalThis.fetch = (async () => new Response(JSON.stringify({
    success: true,
    result: minimalResult,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })) as any;

  const progress: SynthesisProgress[] = [];
  const result = await synthesizeSoulFromChat('chat export', 'Mona', update => progress.push(update));
  assert.deepEqual(result, minimalResult);
  assert.deepEqual(progress.map(update => update.stage), ['synthesis', 'done']);
  assert.deepEqual(progress.map(update => update.progress), [0, 100]);
  assert.match(progress[0].message, /تقديرية/);

  globalThis.fetch = (async () => new Response(JSON.stringify({
    success: false,
    error: 'مزود التحليل غير متاح حاليًا',
    stage: 'analysis',
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  })) as any;

  await assert.rejects(
    synthesizeSoulFromChat('chat export', 'Mona'),
    (error: unknown) => {
      assert.ok(error instanceof CloneRequestError);
      assert.equal(error.stage, 'analysis');
      assert.equal(error.statusCode, 503);
      assert.match(getCloneRequestErrorMessage(error, 'participants'), /^تحليل الشخصية مكتملش:/);
      return true;
    },
  );
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Clone route parity and honest progress tests passed.');
