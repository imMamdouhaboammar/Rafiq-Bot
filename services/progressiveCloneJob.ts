import { z } from 'zod';
import {
  BotSettingsSchema,
  MessageRole,
  type BotSettings,
  type MemoryEntry,
  type SoulMemorySeed,
  type SoulSynthesisResult,
} from '../types.js';
import { MemoryRecordSchema, type MemoryRecord } from '../contracts/rafiqV6.js';
import { calculateMemoryExpiry, inferMemoryRetention } from './memoryPolicy.js';
import './registerDbV6.js';
import * as DB from './db.js';
import type {
  ProgressiveCloneJobRecord,
  ProgressiveCloneJobStatus,
  ProgressiveCloneSnapshotRecord,
} from './db.js';

export const PROGRESSIVE_CLONE_BATCH_BYTES = 512 * 1024;
export const PROGRESSIVE_CLONE_ACTION = 'analyzeProgressiveCloneBatch' as const;

type CloneProfile = NonNullable<BotSettings['cloneProfile']>;

export interface ProgressiveCloneBatchRequest {
  jobId: string;
  targetName: string;
  batchIndex: number;
  totalBatches: number;
  text: string;
  priorSnapshot: ProgressiveCloneSnapshot;
}

export interface ProgressiveCloneBatchResult {
  settingsPatch: Partial<BotSettings>;
  memorySeeds: SoulMemorySeed[];
  preview?: SoulSynthesisResult;
  serverSnapshot?: unknown;
}

export interface ProgressiveCloneSnapshot extends ProgressiveCloneSnapshotRecord {}

export interface ProgressiveCloneJobStatusView {
  jobId: string;
  chatId: string;
  status: ProgressiveCloneJobStatus;
  processedBatches: number;
  totalBatches: number;
  snapshot: ProgressiveCloneSnapshot;
  error?: string;
  updatedAt: Date;
}

export interface ProgressiveCloneJobHandle {
  jobId: string;
  firstSnapshot: ProgressiveCloneSnapshot;
  status: ProgressiveCloneJobStatusView;
  completion: Promise<ProgressiveCloneJobStatusView>;
}

export interface StartProgressiveCloneJobInput {
  chatId: string;
  targetName: string;
  text: string;
  initialSnapshot?: Partial<ProgressiveCloneSnapshot>;
}

export type ProgressiveCloneStatusListener = (status: ProgressiveCloneJobStatusView) => void;
export type ProgressiveCloneBatchRpc = (
  request: ProgressiveCloneBatchRequest,
) => Promise<ProgressiveCloneBatchResult>;

export interface ProgressiveCloneJobStore {
  get(jobId: string): Promise<ProgressiveCloneJobRecord | undefined>;
  save(job: ProgressiveCloneJobRecord, settingsPatch?: Partial<BotSettings>): Promise<void>;
  commitBatch(input: {
    job: ProgressiveCloneJobRecord;
    settingsPatch: Partial<BotSettings>;
    legacyEntries: MemoryEntry[];
    memoryRecords: MemoryRecord[];
  }): Promise<void>;
}

export interface ProgressiveCloneJobDependencies {
  store?: ProgressiveCloneJobStore;
  rpc?: ProgressiveCloneBatchRpc;
  maxBatchBytes?: number;
  now?: () => Date;
  createId?: () => string;
}

export class ProgressiveCloneJobError extends Error {
  readonly jobId: string;

  constructor(jobId: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ProgressiveCloneJobError';
    this.jobId = jobId;
  }
}

const memorySeedSchema = z.object({
  text: z.string().trim().min(4).max(2_000),
  category: z.enum(['identity', 'preference', 'memory', 'goal', 'fact', 'emotion']),
  salience: z.number().finite().min(0).max(1),
  subject: z.enum(['user', 'persona', 'relationship']).optional(),
}).strict();

const batchResultSchema = z.object({
  settingsPatch: BotSettingsSchema.partial(),
  memorySeeds: z.array(memorySeedSchema).max(500),
  preview: z.unknown().optional(),
  serverSnapshot: z.unknown().optional(),
}).strict();

const serverSnapshotSchema = z.object({
  version: z.literal(1),
  targetName: z.string().trim().min(1).max(160),
  totalBatches: z.number().int().positive().max(10_000),
  sourceMessageCount: z.number().int().nonnegative(),
  richBio: z.string().trim().max(12_000),
  richBioSections: z.record(z.array(z.object({
    text: z.string(),
    evidence: z.string(),
    sourceBatch: z.number().int().nonnegative(),
  }).passthrough())),
  timeline: z.array(z.object({
    id: z.string().trim().min(1).max(160),
    title: z.string().trim().min(1).max(240),
    details: z.string().trim().min(1).max(1_500),
    when: z.string().trim().min(1).max(160).optional(),
    location: z.string().trim().min(1).max(240).optional(),
    evidence: z.array(z.string().trim().min(1).max(500)).max(4),
    sourceBatch: z.number().int().nonnegative(),
  }).strict()).max(80),
  speechStyle: z.object({
    toneSummary: z.string().trim().min(1).max(2_000),
    signaturePhrases: z.array(z.string().trim().min(1).max(160)).max(40),
    responsePatterns: z.array(z.string().trim().min(1).max(500)).max(30),
    emojiPatterns: z.array(z.string().trim().min(1).max(160)).max(30),
  }).strict(),
  chatSnippets: z.array(z.object({
    text: z.string().trim().min(1).max(2_000),
    context: z.string().trim().min(1).max(500).optional(),
    timestamp: z.string().trim().min(1).max(160).optional(),
    tone: z.string().trim().min(1).max(160).optional(),
    sourceBatch: z.number().int().nonnegative(),
  }).strict()).max(80),
  memorySeeds: z.array(z.object({
    text: z.string().trim().min(3).max(500),
    category: z.enum(['identity', 'preference', 'memory', 'goal', 'fact', 'emotion']),
    salience: z.number().finite().min(0).max(1),
    subject: z.enum(['user', 'persona', 'relationship']),
    evidence: z.string().trim().min(1).max(500),
    sourceBatch: z.number().int().nonnegative(),
  }).strict()).max(60),
  replyExamples: z.array(z.object({
    context: z.string().trim().min(1).max(500),
    response: z.string().trim().min(1).max(500),
    sourceBatch: z.number().int().nonnegative(),
  }).strict()).max(24),
  confidence: z.object({
    overall: z.number().min(0).max(100),
    evidenceCoverage: z.number().min(0).max(100),
    batchCoverage: z.number().min(0).max(100),
    sourceMessageCount: z.number().int().nonnegative(),
  }).strict(),
  overallConfidence: z.number().min(0).max(100),
  processedBatches: z.array(z.number().int().nonnegative()).max(10_000),
  analysis: z.object({
    jobId: z.string().trim().min(1).max(160),
    status: z.enum(['partial', 'ready']),
    processedBatches: z.number().int().nonnegative(),
    totalBatches: z.number().int().positive(),
    capturedMemories: z.number().int().nonnegative(),
    capturedEvents: z.number().int().nonnegative(),
    capturedSnippets: z.number().int().nonnegative(),
    updatedAt: z.string().datetime(),
  }).strict(),
}).strict();

const encoder = new TextEncoder();

const byteLength = (value: string): number => encoder.encode(value).byteLength;

const splitOversizedSegment = (segment: string, maxBatchBytes: number): string[] => {
  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;

  for (const character of segment) {
    const characterBytes = byteLength(character);
    if (current && currentBytes + characterBytes > maxBatchBytes) {
      chunks.push(current);
      current = '';
      currentBytes = 0;
    }
    current += character;
    currentBytes += characterBytes;
  }
  if (current) chunks.push(current);
  return chunks;
};

/** Splits at line boundaries when possible and always enforces a UTF-8 byte ceiling. */
export const splitWhatsAppTextIntoBatches = (
  text: string,
  maxBatchBytes = PROGRESSIVE_CLONE_BATCH_BYTES,
): string[] => {
  if (!Number.isInteger(maxBatchBytes) || maxBatchBytes < 1_024) {
    throw new Error('Progressive clone batch size must be at least 1024 bytes.');
  }
  if (!text.trim()) throw new Error('WhatsApp export is empty.');

  const segments = text.match(/.*(?:\r\n|\n|\r|$)/g)?.filter(Boolean) || [text];
  const batches: string[] = [];
  let current = '';
  let currentBytes = 0;

  const flush = () => {
    if (!current) return;
    batches.push(current);
    current = '';
    currentBytes = 0;
  };

  for (const segment of segments) {
    const segmentBytes = byteLength(segment);
    if (segmentBytes > maxBatchBytes) {
      flush();
      batches.push(...splitOversizedSegment(segment, maxBatchBytes));
      continue;
    }
    if (current && currentBytes + segmentBytes > maxBatchBytes) flush();
    current += segment;
    currentBytes += segmentBytes;
  }
  flush();

  return batches;
};

const parsePreview = (value: unknown): SoulSynthesisResult | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<SoulSynthesisResult>;
  if (!candidate.settings || !candidate.blueprint || !candidate.statistics || !candidate.confidence) {
    return undefined;
  }
  return candidate as SoulSynthesisResult;
};

export const parseProgressiveCloneBatchResult = (
  value: unknown,
): ProgressiveCloneBatchResult => {
  const possibleServerSnapshot = value && typeof value === 'object' && 'serverSnapshot' in value
    ? (value as { serverSnapshot?: unknown }).serverSnapshot
    : value;
  const serverSnapshot = serverSnapshotSchema.safeParse(possibleServerSnapshot);
  if (serverSnapshot.success) {
    const snapshot = serverSnapshot.data;
    const replyExamples = snapshot.replyExamples.map(({ context, response }) => ({ context, response }));
    if (replyExamples.length === 0) {
      const contextualSnippet = snapshot.chatSnippets.find(snippet => snippet.context);
      if (contextualSnippet?.context) {
        replyExamples.push({ context: contextualSnippet.context, response: contextualSnippet.text });
      }
    }
    const cloneProfile = snapshot.sourceMessageCount > 0 && replyExamples.length > 0 ? {
      version: 1 as const,
      source: 'whatsapp' as const,
      targetName: snapshot.targetName,
      sourceMessageCount: snapshot.sourceMessageCount,
      overallConfidence: snapshot.overallConfidence,
      replyExamples,
      richBio: snapshot.richBio || undefined,
      timeline: snapshot.timeline,
      speechStyle: snapshot.speechStyle,
      chatSnippets: snapshot.chatSnippets,
      memorySeeds: snapshot.memorySeeds.map(({ text, category, salience, subject }) => ({
        text,
        category,
        salience,
        subject,
      })),
    } : undefined;
    return {
      settingsPatch: {
        botName: snapshot.targetName,
        botBio: snapshot.richBio || undefined,
        impersonationProfile: formatSpeechStyle(snapshot.speechStyle),
        cloneProfile,
      },
      memorySeeds: snapshot.memorySeeds.map(({ text, category, salience, subject }) => ({
        text,
        category,
        salience,
        subject,
      })),
      preview: undefined,
      serverSnapshot: snapshot,
    };
  }
  const parsed = batchResultSchema.parse(value);
  return {
    settingsPatch: parsed.settingsPatch,
    memorySeeds: parsed.memorySeeds.map(seed => ({
      text: seed.text!,
      category: seed.category!,
      salience: seed.salience!,
      ...(seed.subject ? { subject: seed.subject } : {}),
    })),
    preview: parsePreview(parsed.preview),
    serverSnapshot: parsed.serverSnapshot,
  };
};

export const requestProgressiveCloneBatch: ProgressiveCloneBatchRpc = async request => {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: PROGRESSIVE_CLONE_ACTION, args: [request] }),
  });
  let payload: { success?: boolean; result?: unknown; error?: string } = {};
  try {
    payload = await response.json();
  } catch {
    // The status-specific message below is more useful than a JSON parse error.
  }
  if (!response.ok || !payload.success) {
    throw new Error(payload.error?.trim() || `Progressive clone batch failed (${response.status}).`);
  }
  return parseProgressiveCloneBatchResult(payload.result);
};

const dexieProgressiveCloneJobStore: ProgressiveCloneJobStore = {
  get: DB.getProgressiveCloneJob,
  save: DB.saveProgressiveCloneJob,
  commitBatch: DB.commitProgressiveCloneBatch,
};

const uniqueBy = <T>(values: T[], keyOf: (value: T) => string, limit: number): T[] => {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const value of values) {
    const key = keyOf(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (result.length >= limit) break;
  }
  return result;
};

const mergeCloneProfile = (
  previous: CloneProfile | undefined,
  incoming: CloneProfile | undefined,
): CloneProfile | undefined => {
  if (!incoming) return previous;
  if (!previous) return incoming;
  const previousStyle = previous.speechStyle;
  const incomingStyle = incoming.speechStyle;
  return {
    ...previous,
    ...incoming,
    sourceMessageCount: Math.max(previous.sourceMessageCount, incoming.sourceMessageCount),
    replyExamples: uniqueBy(
      [...incoming.replyExamples, ...previous.replyExamples],
      example => `${example.context}\u0000${example.response}`,
      24,
    ),
    richBio: incoming.richBio || previous.richBio,
    timeline: uniqueBy(
      [...(incoming.timeline || []), ...(previous.timeline || [])],
      event => event.id,
      80,
    ),
    chatSnippets: uniqueBy(
      [...(incoming.chatSnippets || []), ...(previous.chatSnippets || [])],
      snippet => `${snippet.text}\u0000${snippet.context || ''}`,
      80,
    ),
    memorySeeds: uniqueBy(
      [...(incoming.memorySeeds || []), ...(previous.memorySeeds || [])],
      seed => `${seed.category}\u0000${seed.text.toLocaleLowerCase('ar').replace(/\s+/g, ' ').trim()}`,
      60,
    ),
    speechStyle: incomingStyle || previousStyle ? {
      toneSummary: incomingStyle?.toneSummary || previousStyle?.toneSummary || '',
      signaturePhrases: uniqueBy(
        [...(incomingStyle?.signaturePhrases || []), ...(previousStyle?.signaturePhrases || [])],
        value => value,
        40,
      ),
      responsePatterns: uniqueBy(
        [...(incomingStyle?.responsePatterns || []), ...(previousStyle?.responsePatterns || [])],
        value => value,
        30,
      ),
      emojiPatterns: uniqueBy(
        [...(incomingStyle?.emojiPatterns || []), ...(previousStyle?.emojiPatterns || [])],
        value => value,
        30,
      ),
    } : undefined,
    analysis: incoming.analysis || previous.analysis,
  };
};

const formatSpeechStyle = (profile: CloneProfile['speechStyle']): string | undefined => {
  if (!profile) return undefined;
  const speaksArabic = /\p{Script=Arabic}/u.test([
    profile.toneSummary,
    ...profile.signaturePhrases,
    ...profile.responsePatterns,
  ].join(' '));
  return [
    profile.toneSummary,
    profile.signaturePhrases.length > 0
      ? `${speaksArabic ? 'عباراتي المميزة' : 'My signature phrases'}: ${profile.signaturePhrases.join('، ')}`
      : '',
    profile.responsePatterns.length > 0
      ? `${speaksArabic ? 'طريقتي في الرد' : 'How I respond'}: ${profile.responsePatterns.join('، ')}`
      : '',
    profile.emojiPatterns.length > 0
      ? `${speaksArabic ? 'الإيموجيز اللي بستخدمها' : 'Emojis I use'}: ${profile.emojiPatterns.join('، ')}`
      : '',
  ].filter(Boolean).join('\n');
};

export const mergeProgressiveCloneSnapshot = (
  previous: ProgressiveCloneSnapshot,
  result: ProgressiveCloneBatchResult,
): ProgressiveCloneSnapshot => {
  const cloneProfile = mergeCloneProfile(
    previous.settingsPatch.cloneProfile,
    result.settingsPatch.cloneProfile,
  );
  const settingsPatch: Partial<BotSettings> = {
    ...previous.settingsPatch,
    ...result.settingsPatch,
    cloneProfile,
  };
  if (cloneProfile?.richBio) settingsPatch.botBio = cloneProfile.richBio;
  const speechProfile = formatSpeechStyle(cloneProfile?.speechStyle);
  if (speechProfile) settingsPatch.impersonationProfile = speechProfile;

  const seedsByKey = new Map<string, SoulMemorySeed>();
  for (const seed of [...previous.memorySeeds, ...result.memorySeeds]) {
    const key = `${seed.category}\u0000${seed.text.toLocaleLowerCase('ar').replace(/\s+/g, ' ').trim()}`;
    const existing = seedsByKey.get(key);
    seedsByKey.set(key, existing && existing.salience > seed.salience ? existing : seed);
  }
  const memorySeeds = [...seedsByKey.values()];
  const previewSource = result.preview || previous.preview;
  const preview = previewSource ? {
    ...previewSource,
    settings: {
      ...previewSource.settings,
      ...settingsPatch,
    },
    memorySeeds,
  } : undefined;

  const serverSnapshot = result.serverSnapshot ?? previous.serverSnapshot;
  return { settingsPatch, memorySeeds, preview, serverSnapshot };
};

const analysisStatusFor = (job: ProgressiveCloneJobRecord): NonNullable<CloneProfile['analysis']>['status'] => {
  if (job.status === 'ready') return 'ready';
  if (job.status === 'partial') return 'partial';
  if (job.status === 'error') return 'error';
  if (job.status === 'initializing') return 'initializing';
  return 'analyzing';
};

const withDurableAnalysis = (
  job: ProgressiveCloneJobRecord,
  snapshot: ProgressiveCloneSnapshot,
): ProgressiveCloneSnapshot => {
  const cloneProfile = snapshot.settingsPatch.cloneProfile;
  if (!cloneProfile) return snapshot;
  const settingsPatch: Partial<BotSettings> = {
    ...snapshot.settingsPatch,
    cloneProfile: {
      ...cloneProfile,
      analysis: {
        jobId: job.id,
        status: analysisStatusFor(job),
        processedBatches: job.processedBatches,
        totalBatches: job.totalBatches,
        capturedMemories: snapshot.memorySeeds.length,
        capturedEvents: cloneProfile.timeline?.length || 0,
        capturedSnippets: cloneProfile.chatSnippets?.length || 0,
        updatedAt: job.updatedAt.toISOString(),
        error: job.error?.slice(0, 1_000),
      },
    },
  };
  const preview = snapshot.preview ? {
    ...snapshot.preview,
    settings: {
      ...snapshot.preview.settings,
      ...settingsPatch,
    },
    memorySeeds: snapshot.memorySeeds,
  } : undefined;
  return { ...snapshot, settingsPatch, preview };
};

const normalizeMemoryText = (value: string): string => (
  value.toLocaleLowerCase('ar').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
);

const memoryKeywords = (value: string): string[] => (
  [...new Set(normalizeMemoryText(value).split(' ').filter(token => token.length >= 2))].slice(0, 40)
);

export const buildProgressiveCloneMemoryRecords = (
  chatId: string,
  seeds: SoulMemorySeed[],
  now: Date,
): { legacyEntries: MemoryEntry[]; memoryRecords: MemoryRecord[] } => {
  const legacyEntries = seeds.map((seed, index): MemoryEntry => {
    const text = seed.text.trim();
    return {
      id: `${chatId}:progressive_seed_${index}`,
      chatId,
      sourceMessageId: `progressive_seed_${index}`,
      sourceRole: seed.subject === 'user' ? MessageRole.USER : MessageRole.MODEL,
      text,
      summary: text.length > 180 ? `${text.slice(0, 177)}...` : text,
      normalizedText: normalizeMemoryText(text),
      keywords: memoryKeywords(text),
      category: seed.category,
      salience: seed.salience,
      createdAt: now,
      updatedAt: now,
    };
  });
  const memoryRecords = legacyEntries.map((entry, index) => {
    const seed = seeds[index];
    const retention = inferMemoryRetention(entry.category);
    return MemoryRecordSchema.parse({
      id: `clone:${entry.id}`,
      ownerUserId: 'main_user',
      scope: 'chat',
      scopeId: chatId,
      text: entry.text,
      summary: entry.summary,
      category: entry.category,
      provenance: {
        kind: seed?.subject === 'user' ? 'user_message' : 'bot_message',
        sourceIds: [entry.sourceMessageId],
        observedAt: now,
      },
      confidence: 0.8,
      salience: entry.salience,
      sensitivity: 'normal',
      retention,
      expiresAt: calculateMemoryExpiry(retention, now),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
  });
  return { legacyEntries, memoryRecords };
};

const toStatusView = (job: ProgressiveCloneJobRecord): ProgressiveCloneJobStatusView => ({
  jobId: job.id,
  chatId: job.chatId,
  status: job.status,
  processedBatches: job.processedBatches,
  totalBatches: job.totalBatches,
  snapshot: structuredClone(job.snapshot),
  error: job.error,
  updatedAt: new Date(job.updatedAt),
});

const isUsefulSnapshot = (snapshot: ProgressiveCloneSnapshot): boolean => {
  if (snapshot.preview) return true;
  const profile = snapshot.settingsPatch.cloneProfile;
  return Boolean(
    profile?.richBio
    || profile?.timeline?.length
    || profile?.chatSnippets?.length
    || snapshot.settingsPatch.botBio
    || snapshot.settingsPatch.impersonationProfile
    || snapshot.memorySeeds.length
  );
};

export const progressiveSnapshotToSoulSynthesisResult = (
  snapshot: ProgressiveCloneSnapshot,
  base?: SoulSynthesisResult,
): SoulSynthesisResult | undefined => {
  const source = snapshot.preview || base;
  if (!source) return undefined;
  const cloneProfile = snapshot.settingsPatch.cloneProfile;
  return {
    ...structuredClone(source),
    settings: {
      ...source.settings,
      ...structuredClone(snapshot.settingsPatch),
    },
    blueprint: {
      ...source.blueprint,
      identity: {
        ...source.blueprint.identity,
        name: snapshot.settingsPatch.botName || cloneProfile?.targetName || source.blueprint.identity.name,
        bio: snapshot.settingsPatch.botBio || cloneProfile?.richBio || source.blueprint.identity.bio,
      },
      impersonationProfile: snapshot.settingsPatch.impersonationProfile || source.blueprint.impersonationProfile,
      memorySeeds: structuredClone(snapshot.memorySeeds),
    },
    memorySeeds: structuredClone(snapshot.memorySeeds),
    confidence: cloneProfile ? {
      ...source.confidence,
      overall: cloneProfile.overallConfidence,
    } : source.confidence,
  };
};

export class ProgressiveCloneJobOrchestrator {
  private readonly store: ProgressiveCloneJobStore;
  private readonly rpc: ProgressiveCloneBatchRpc;
  private readonly maxBatchBytes: number;
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly listeners = new Map<string, Set<ProgressiveCloneStatusListener>>();
  private readonly activeCompletions = new Map<string, Promise<ProgressiveCloneJobStatusView>>();

  constructor(dependencies: ProgressiveCloneJobDependencies = {}) {
    this.store = dependencies.store || dexieProgressiveCloneJobStore;
    this.rpc = dependencies.rpc || requestProgressiveCloneBatch;
    this.maxBatchBytes = dependencies.maxBatchBytes || PROGRESSIVE_CLONE_BATCH_BYTES;
    this.now = dependencies.now || (() => new Date());
    this.createId = dependencies.createId || (() => crypto.randomUUID());
  }

  subscribe(jobId: string, listener: ProgressiveCloneStatusListener): () => void {
    const listeners = this.listeners.get(jobId) || new Set<ProgressiveCloneStatusListener>();
    listeners.add(listener);
    this.listeners.set(jobId, listeners);
    void this.getStatus(jobId).then(status => {
      if (status && listeners.has(listener)) listener(status);
    });
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(jobId);
    };
  }

  async getStatus(jobId: string): Promise<ProgressiveCloneJobStatusView | undefined> {
    const job = await this.store.get(jobId);
    return job ? toStatusView(job) : undefined;
  }

  async start(input: StartProgressiveCloneJobInput): Promise<ProgressiveCloneJobHandle> {
    const batches = splitWhatsAppTextIntoBatches(input.text, this.maxBatchBytes);
    const now = this.now();
    const job: ProgressiveCloneJobRecord = {
      version: 1,
      id: this.createId(),
      chatId: input.chatId,
      targetName: input.targetName.trim(),
      status: 'initializing',
      processedBatches: 0,
      totalBatches: batches.length,
      nextBatchIndex: 0,
      batches,
      snapshot: {
        settingsPatch: structuredClone(input.initialSnapshot?.settingsPatch || {}),
        memorySeeds: structuredClone(input.initialSnapshot?.memorySeeds || []),
        preview: input.initialSnapshot?.preview
          ? structuredClone(input.initialSnapshot.preview)
          : undefined,
      },
      createdAt: now,
      updatedAt: now,
    };
    if (!job.targetName) throw new Error('Progressive clone target name is required.');
    await this.store.save(job);
    this.notify(job);

    let current = job;
    try {
      while (current.nextBatchIndex < current.totalBatches && !isUsefulSnapshot(current.snapshot)) {
        current = await this.processNextBatch(current);
      }
      if (!isUsefulSnapshot(current.snapshot)) {
        throw new Error('Progressive analysis completed without a usable clone snapshot.');
      }
    } catch (error) {
      const failed = await this.recordFailure(current.id, error);
      throw new ProgressiveCloneJobError(
        current.id,
        failed.error || 'Progressive clone analysis failed.',
        { cause: error },
      );
    }

    const completion = current.status === 'ready'
      ? Promise.resolve(toStatusView(current))
      : this.ensureContinuation(current.id);
    return {
      jobId: current.id,
      firstSnapshot: structuredClone(current.snapshot),
      status: toStatusView(current),
      completion,
    };
  }

  async continue(jobId: string): Promise<ProgressiveCloneJobHandle> {
    let job = await this.store.get(jobId);
    if (!job) throw new ProgressiveCloneJobError(jobId, 'Progressive clone job was not found.');

    if (job.status !== 'ready') {
      job = {
        ...job,
        status: 'analyzing',
        error: undefined,
        updatedAt: this.now(),
      };
      job.snapshot = withDurableAnalysis(job, job.snapshot);
      await this.store.save(job, job.snapshot.settingsPatch);
      this.notify(job);
    }

    if (!isUsefulSnapshot(job.snapshot) && job.status !== 'ready') {
      try {
        while (job.nextBatchIndex < job.totalBatches && !isUsefulSnapshot(job.snapshot)) {
          job = await this.processNextBatch(job);
        }
      } catch (error) {
        const failed = await this.recordFailure(job.id, error);
        throw new ProgressiveCloneJobError(job.id, failed.error || 'Progressive clone resume failed.', { cause: error });
      }
    }

    const completion = job.status === 'ready'
      ? Promise.resolve(toStatusView(job))
      : this.ensureContinuation(job.id);
    return {
      jobId: job.id,
      firstSnapshot: structuredClone(job.snapshot),
      status: toStatusView(job),
      completion,
    };
  }

  private async processNextBatch(job: ProgressiveCloneJobRecord): Promise<ProgressiveCloneJobRecord> {
    const batchIndex = job.nextBatchIndex;
    const result = parseProgressiveCloneBatchResult(await this.rpc({
      jobId: job.id,
      targetName: job.targetName,
      batchIndex,
      totalBatches: job.totalBatches,
      text: job.batches[batchIndex] || '',
      priorSnapshot: structuredClone(job.snapshot),
    }));
    const updatedAt = this.now();
    const processedBatches = batchIndex + 1;
    const status: ProgressiveCloneJobStatus = processedBatches >= job.totalBatches ? 'ready' : 'analyzing';
    let updated: ProgressiveCloneJobRecord = {
      ...job,
      status,
      processedBatches,
      nextBatchIndex: processedBatches,
      snapshot: mergeProgressiveCloneSnapshot(job.snapshot, result),
      error: undefined,
      updatedAt,
    };
    updated.snapshot = withDurableAnalysis(updated, updated.snapshot);
    const memories = buildProgressiveCloneMemoryRecords(updated.chatId, updated.snapshot.memorySeeds, updatedAt);
    await this.store.commitBatch({
      job: updated,
      settingsPatch: updated.snapshot.settingsPatch,
      ...memories,
    });
    this.notify(updated);
    return updated;
  }

  private ensureContinuation(jobId: string): Promise<ProgressiveCloneJobStatusView> {
    const active = this.activeCompletions.get(jobId);
    if (active) return active;
    const completion = this.runRemaining(jobId)
      .finally(() => this.activeCompletions.delete(jobId));
    this.activeCompletions.set(jobId, completion);
    return completion;
  }

  private async runRemaining(jobId: string): Promise<ProgressiveCloneJobStatusView> {
    let job = await this.store.get(jobId);
    if (!job) throw new ProgressiveCloneJobError(jobId, 'Progressive clone job was not found.');
    try {
      while (job.nextBatchIndex < job.totalBatches) {
        job = await this.processNextBatch(job);
      }
      return toStatusView(job);
    } catch (error) {
      return toStatusView(await this.recordFailure(jobId, error));
    }
  }

  private async recordFailure(jobId: string, error: unknown): Promise<ProgressiveCloneJobRecord> {
    const current = await this.store.get(jobId);
    if (!current) throw new ProgressiveCloneJobError(jobId, 'Progressive clone job was not found.', { cause: error });
    const message = error instanceof Error ? error.message : String(error || 'Unknown progressive clone error');
    const failed: ProgressiveCloneJobRecord = {
      ...current,
      status: isUsefulSnapshot(current.snapshot) ? 'partial' : 'error',
      error: message.slice(0, 1_000),
      updatedAt: this.now(),
    };
    failed.snapshot = withDurableAnalysis(failed, failed.snapshot);
    await this.store.save(
      failed,
      failed.snapshot.settingsPatch.cloneProfile ? failed.snapshot.settingsPatch : undefined,
    );
    this.notify(failed);
    return failed;
  }

  private notify(job: ProgressiveCloneJobRecord): void {
    const status = toStatusView(job);
    for (const listener of this.listeners.get(job.id) || []) listener(status);
  }
}

const defaultOrchestrator = new ProgressiveCloneJobOrchestrator();

export const startProgressiveCloneJob = (
  input: StartProgressiveCloneJobInput,
): Promise<ProgressiveCloneJobHandle> => defaultOrchestrator.start(input);

export const continueProgressiveCloneJob = (
  jobId: string,
): Promise<ProgressiveCloneJobHandle> => defaultOrchestrator.continue(jobId);

export const getProgressiveCloneJobStatus = (
  jobId: string,
): Promise<ProgressiveCloneJobStatusView | undefined> => defaultOrchestrator.getStatus(jobId);

export const subscribeToProgressiveCloneJob = (
  jobId: string,
  listener: ProgressiveCloneStatusListener,
): (() => void) => defaultOrchestrator.subscribe(jobId, listener);
