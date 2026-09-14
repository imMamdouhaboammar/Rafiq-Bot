import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { BotSettings, MemoryEntry, SoulSynthesisResult } from '../types.js';
import type { MemoryRecord } from '../contracts/rafiqV6.js';
import type { ProgressiveCloneJobRecord } from '../services/db.js';
import {
  ProgressiveCloneJobOrchestrator,
  parseProgressiveCloneBatchResult,
  progressiveSnapshotToSoulSynthesisResult,
  requestProgressiveCloneBatch,
  splitWhatsAppTextIntoBatches,
  type ProgressiveCloneBatchResult,
  type ProgressiveCloneJobStore,
} from '../services/progressiveCloneJob.js';

class MemoryJobStore implements ProgressiveCloneJobStore {
  readonly jobs = new Map<string, ProgressiveCloneJobRecord>();
  readonly settingsByChat = new Map<string, Partial<BotSettings>>();
  readonly legacyByChat = new Map<string, MemoryEntry[]>();
  readonly recordsByChat = new Map<string, MemoryRecord[]>();
  readonly commitHistory: Array<{
    processedBatches: number;
    status: ProgressiveCloneJobRecord['status'];
    memoryCount: number;
  }> = [];

  async get(jobId: string): Promise<ProgressiveCloneJobRecord | undefined> {
    const job = this.jobs.get(jobId);
    return job ? structuredClone(job) : undefined;
  }

  async save(job: ProgressiveCloneJobRecord, settingsPatch?: Partial<BotSettings>): Promise<void> {
    this.jobs.set(job.id, structuredClone(job));
    if (settingsPatch) {
      this.settingsByChat.set(job.chatId, {
        ...(this.settingsByChat.get(job.chatId) || {}),
        ...structuredClone(settingsPatch),
      });
    }
  }

  async commitBatch({
    job,
    settingsPatch,
    legacyEntries,
    memoryRecords,
  }: {
    job: ProgressiveCloneJobRecord;
    settingsPatch: Partial<BotSettings>;
    legacyEntries: MemoryEntry[];
    memoryRecords: MemoryRecord[];
  }): Promise<void> {
    // One synchronous state swap models the production store's single Dexie transaction.
    this.jobs.set(job.id, structuredClone(job));
    this.settingsByChat.set(job.chatId, {
      ...(this.settingsByChat.get(job.chatId) || {}),
      ...structuredClone(settingsPatch),
    });
    this.legacyByChat.set(job.chatId, structuredClone(legacyEntries));
    this.recordsByChat.set(job.chatId, structuredClone(memoryRecords));
    this.commitHistory.push({
      processedBatches: job.processedBatches,
      status: job.status,
      memoryCount: legacyEntries.length,
    });
  }
}

const source = `${'أ'.repeat(900)}\n${'b'.repeat(900)}\n${'ج'.repeat(900)}`;
const split = splitWhatsAppTextIntoBatches(source, 1_024);
assert.ok(split.length >= 3);
assert.equal(split.join(''), source, 'batching must not lose or duplicate source text');
assert.ok(split.every(batch => new TextEncoder().encode(batch).byteLength <= 1_024));

const rawServerSnapshot = {
  version: 1,
  targetName: 'منى',
  totalBatches: 3,
  sourceMessageCount: 10,
  richBio: 'سيرة موثقة',
  richBioSections: {},
  timeline: [],
  speechStyle: {
    toneSummary: 'هادية ومباشرة',
    signaturePhrases: ['تمام'],
    responsePatterns: ['ردود قصيرة'],
    emojiPatterns: ['😂'],
  },
  chatSnippets: [{ text: 'تمام', context: 'عاملة إيه؟', sourceBatch: 0 }],
  memorySeeds: [{
    text: 'ذكرى',
    category: 'memory',
    subject: 'relationship',
    salience: 0.8,
    evidence: 'ذكرى',
    sourceBatch: 0,
  }],
  replyExamples: [],
  confidence: { overall: 65, evidenceCoverage: 70, batchCoverage: 33, sourceMessageCount: 10 },
  overallConfidence: 65,
  processedBatches: [0],
  analysis: {
    jobId: 'server-job',
    status: 'partial',
    processedBatches: 1,
    totalBatches: 3,
    capturedMemories: 1,
    capturedEvents: 0,
    capturedSnippets: 1,
    updatedAt: '2026-07-17T12:00:00.000Z',
  },
};
const adaptedServerSnapshot = parseProgressiveCloneBatchResult({
  settingsPatch: {},
  memorySeeds: [],
  preview: undefined,
  serverSnapshot: rawServerSnapshot,
});
assert.equal(adaptedServerSnapshot.settingsPatch.cloneProfile?.replyExamples[0]?.response, 'تمام');
assert.equal(adaptedServerSnapshot.memorySeeds[0]?.text, 'ذكرى');
assert.ok(adaptedServerSnapshot.serverSnapshot, 'opaque server snapshot must survive for the next batch');

const originalFetch = globalThis.fetch;
let capturedRequestBody: any;
try {
  globalThis.fetch = (async (_input: any, init: any) => {
    capturedRequestBody = JSON.parse(String(init?.body || '{}'));
    return new Response(JSON.stringify({ success: true, result: {
      settingsPatch: {},
      memorySeeds: [],
      serverSnapshot: rawServerSnapshot,
    } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as any;
  await requestProgressiveCloneBatch({
    jobId: 'browser-job',
    targetName: 'منى',
    batchIndex: 1,
    totalBatches: 3,
    text: 'batch text',
    priorSnapshot: adaptedServerSnapshot,
  });
  assert.equal(capturedRequestBody.action, 'analyzeProgressiveCloneBatch');
  assert.equal(capturedRequestBody.args[0].text, 'batch text');
  assert.deepEqual(capturedRequestBody.args[0].priorSnapshot.serverSnapshot, rawServerSnapshot);
  assert.equal(capturedRequestBody.args[0].batchText, undefined, 'public RPC must not leak raw-core field names');
} finally {
  globalThis.fetch = originalFetch;
}

const preview = {
  settings: { botName: 'منى' },
  blueprint: {},
  memorySeeds: [],
  statistics: {},
  confidence: { linguistic: 70, psychological: 70, overall: 70 },
} as unknown as SoulSynthesisResult;

const resultFor = (batchIndex: number): ProgressiveCloneBatchResult => ({
  settingsPatch: {
    botBio: `السيرة بعد الدفعة ${batchIndex + 1}`,
    impersonationProfile: `الأسلوب بعد الدفعة ${batchIndex + 1}`,
    cloneProfile: {
      version: 1,
      source: 'whatsapp',
      targetName: 'منى',
      sourceMessageCount: (batchIndex + 1) * 10,
      overallConfidence: 60 + batchIndex * 10,
      replyExamples: [{
        context: `سؤال ${batchIndex}`,
        response: `رد ${batchIndex}`,
      }],
      richBio: `السيرة الغنية بعد الدفعة ${batchIndex + 1}`,
      timeline: [{
        id: `event-${batchIndex}`,
        title: `حدث ${batchIndex}`,
        details: `تفاصيل ${batchIndex}`,
        evidence: [`دليل ${batchIndex}`],
        sourceBatch: batchIndex,
      }],
      speechStyle: {
        toneSummary: `نبرة ${batchIndex}`,
        signaturePhrases: [`عبارة ${batchIndex}`],
        responsePatterns: [`نمط ${batchIndex}`],
        emojiPatterns: ['😂'],
      },
      chatSnippets: [{ text: `مقتطف ${batchIndex}`, sourceBatch: batchIndex }],
    },
  },
  memorySeeds: [{
    text: `ذكرى موثوقة من الدفعة ${batchIndex}`,
    category: 'memory',
    salience: 0.8,
    subject: 'relationship',
  }],
  preview: batchIndex === 0 ? preview : undefined,
});

const store = new MemoryJobStore();
const firstRunCalls: number[] = [];
let tick = 0;
const firstRun = new ProgressiveCloneJobOrchestrator({
  store,
  maxBatchBytes: 1_024,
  createId: () => 'progressive-job',
  now: () => new Date(Date.UTC(2026, 6, 17, 12, 0, tick++)),
  rpc: async request => {
    firstRunCalls.push(request.batchIndex);
    if (request.batchIndex === 1) throw new Error('provider unavailable on batch 2');
    return resultFor(request.batchIndex);
  },
});

const updates: string[] = [];
const unsubscribe = firstRun.subscribe('progressive-job', status => {
  updates.push(`${status.status}:${status.processedBatches}/${status.totalBatches}`);
});
const handle = await firstRun.start({ chatId: 'clone-chat', targetName: 'منى', text: source });
assert.equal(handle.status.processedBatches, 1, 'first useful batch must be returned before later work');
assert.equal(progressiveSnapshotToSoulSynthesisResult(handle.firstSnapshot)?.settings.botBio, 'السيرة الغنية بعد الدفعة 1');

const failed = await handle.completion;
assert.equal(failed.status, 'partial');
assert.equal(failed.processedBatches, 1);
assert.deepEqual(firstRunCalls, [0, 1]);
assert.match(failed.error || '', /provider unavailable/);
assert.equal(store.legacyByChat.get('clone-chat')?.length, 1, 'first batch memories must survive later failure');
assert.equal(store.recordsByChat.get('clone-chat')?.length, 1, 'V6 memories must survive later failure');
assert.equal(store.settingsByChat.get('clone-chat')?.cloneProfile?.analysis?.status, 'partial');
assert.equal(store.settingsByChat.get('clone-chat')?.cloneProfile?.analysis?.processedBatches, 1);
assert.ok(updates.some(update => update === `partial:1/${split.length}`));
unsubscribe();

const resumedCalls: number[] = [];
const resumed = new ProgressiveCloneJobOrchestrator({
  store,
  maxBatchBytes: 1_024,
  now: () => new Date(Date.UTC(2026, 6, 17, 13, 0, tick++)),
  rpc: async request => {
    resumedCalls.push(request.batchIndex);
    return resultFor(request.batchIndex);
  },
});
const resumedHandle = await resumed.continue('progressive-job');
assert.equal(resumedHandle.status.processedBatches, 1, 'resume must expose prior results immediately');
const completed = await resumedHandle.completion;
assert.equal(completed.status, 'ready');
assert.equal(completed.processedBatches, split.length);
assert.deepEqual(resumedCalls, Array.from({ length: split.length - 1 }, (_, index) => index + 1));
assert.equal(completed.snapshot.memorySeeds.length, split.length);
assert.equal(completed.snapshot.settingsPatch.cloneProfile?.timeline?.length, split.length);
assert.equal(completed.snapshot.settingsPatch.cloneProfile?.analysis?.status, 'ready');
assert.equal(store.legacyByChat.get('clone-chat')?.length, split.length);
assert.equal(store.recordsByChat.get('clone-chat')?.length, split.length);
assert.deepEqual(
  store.commitHistory.map(commit => commit.processedBatches),
  Array.from({ length: split.length }, (_, index) => index + 1),
  'each successful batch must durably commit exactly once',
);

const dbSource = await readFile(new URL('../services/db.ts', import.meta.url), 'utf8');
assert.match(
  dbSource,
  /db\.transaction\([\s\S]*db\.chats,[\s\S]*db\.memoryEntries,[\s\S]*memoryRecordsTable,[\s\S]*jobsTable/,
  'production batch persistence must include chat, both memory stores, and job checkpoint in one transaction',
);

console.log('Progressive clone job tests passed.');
