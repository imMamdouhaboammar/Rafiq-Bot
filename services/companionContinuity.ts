import { z } from "zod";

export const ContinuityThreadStatusSchema = z.enum([
  "candidate",
  "active",
  "due",
  "dormant",
  "resolved",
  "expired",
]);

export const ContinuityThreadKindSchema = z.enum([
  "outcome",
  "commitment",
  "follow_up",
  "shared_interest",
  "disagreement",
  "inside_joke",
]);

const isoDate = z.string().datetime();
const sourceIds = z.array(z.string().min(1)).min(1).max(6);
const compactText = z.string().trim().min(1).max(200);

export const ContinuityThreadSchema = z.object({
  id: z.string().min(1).max(240),
  kind: ContinuityThreadKindSchema,
  summary: compactText,
  sourceMessageIds: sourceIds,
  salience: z.number().min(0).max(1),
  status: ContinuityThreadStatusSchema,
  createdAt: isoDate,
  updatedAt: isoDate,
  dueAt: isoDate.optional(),
  expiresAt: isoDate.optional(),
  resolvedAt: isoDate.optional(),
}).strict();

export const CompanionOpinionSchema = z.object({
  topic: compactText,
  stance: compactText,
  confidence: z.number().min(0).max(1),
  sourceMessageIds: sourceIds,
  status: z.enum(["stable", "reconsidering"]),
  updatedAt: isoDate,
}).strict();

export const RelationshipExpectationSchema = z.object({
  key: z.string().trim().min(1).max(120),
  statement: compactText,
  confidence: z.number().min(0).max(1),
  evidenceCount: z.number().int().min(1).max(6),
  sourceMessageIds: sourceIds,
  updatedAt: isoDate,
}).strict();

export const SharedRitualSchema = z.object({
  key: z.string().trim().min(1).max(120),
  description: compactText,
  evidenceCount: z.number().int().min(2).max(99),
  lastSeenAt: isoDate,
  nextEligibleAt: isoDate.optional(),
}).strict();

export const CompanionContinuityStateSchema = z.object({
  version: z.literal(1),
  threads: z.array(ContinuityThreadSchema).max(18),
  opinions: z.array(CompanionOpinionSchema).max(12),
  expectations: z.array(RelationshipExpectationSchema).max(8),
  rituals: z.array(SharedRitualSchema).max(6),
  updatedAt: isoDate,
}).strict();

export type ContinuityThread = z.infer<typeof ContinuityThreadSchema>;
export type CompanionOpinion = z.infer<typeof CompanionOpinionSchema>;
export type RelationshipExpectation = z.infer<typeof RelationshipExpectationSchema>;
export type SharedRitual = z.infer<typeof SharedRitualSchema>;
export type CompanionContinuityState = z.infer<typeof CompanionContinuityStateSchema>;

const ThreadUpsertSchema = z.object({
  type: z.literal("thread_upsert"),
  kind: ContinuityThreadKindSchema,
  summary: compactText,
  sourceMessageIds: sourceIds,
  salience: z.number().min(0).max(1),
  dueAt: isoDate.optional(),
  expiresAt: isoDate.optional(),
}).strict();

const ThreadResolveSchema = z.object({
  type: z.literal("thread_resolve"),
  threadId: z.string().min(1),
  sourceMessageIds: sourceIds,
}).strict();

const OpinionUpsertSchema = z.object({
  type: z.literal("opinion_upsert"),
  topic: compactText,
  stance: compactText,
  confidence: z.number().min(0).max(1),
  sourceMessageIds: sourceIds,
  status: z.enum(["stable", "reconsidering"]).default("stable"),
}).strict();

const ExpectationUpsertSchema = z.object({
  type: z.literal("expectation_upsert"),
  key: z.string().trim().min(1).max(120),
  statement: compactText,
  confidence: z.number().min(0).max(1),
  sourceMessageIds: sourceIds,
}).strict();

const ExpectationRetireSchema = z.object({
  type: z.literal("expectation_retire"),
  key: z.string().trim().min(1).max(120),
  sourceMessageIds: sourceIds,
}).strict();

const RitualUpsertSchema = z.object({
  type: z.literal("ritual_upsert"),
  key: z.string().trim().min(1).max(120),
  description: compactText,
  sourceMessageIds: z.array(z.string().min(1)).min(2).max(6),
  lastSeenAt: isoDate.optional(),
  nextEligibleAt: isoDate.optional(),
}).strict();

export const ContinuityProposalSchema = z.discriminatedUnion("type", [
  ThreadUpsertSchema,
  ThreadResolveSchema,
  OpinionUpsertSchema,
  ExpectationUpsertSchema,
  ExpectationRetireSchema,
  RitualUpsertSchema,
]);

export type ContinuityProposal = z.infer<typeof ContinuityProposalSchema>;
export type ContinuityEvidence = { messageIds: readonly string[] };

const iso = (date: Date): string => date.toISOString();

const stableKey = (parts: string[]): string => {
  const input = parts.join("|").toLowerCase();
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const uniq = (values: readonly string[]): string[] => [...new Set(values)].slice(0, 6);

const assertEvidence = (sourceMessageIds: readonly string[], evidence: ContinuityEvidence): void => {
  const allowed = new Set(evidence.messageIds);
  if (sourceMessageIds.some(id => !allowed.has(id))) {
    throw new Error("Continuity proposal references unknown message evidence.");
  }
};

const eligibleStatuses = new Set<ContinuityThread["status"]>(["active", "due", "dormant"]);

const threadRank = (thread: ContinuityThread): number => {
  const statusWeight = thread.status === "due" ? 3 : thread.status === "active" ? 2 : 1;
  return statusWeight + thread.salience;
};

const boundThreads = (threads: ContinuityThread[]): ContinuityThread[] => {
  const eligible = threads
    .filter(thread => eligibleStatuses.has(thread.status))
    .sort((left, right) => threadRank(right) - threadRank(left) || right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 12);
  const terminal = threads
    .filter(thread => !eligibleStatuses.has(thread.status))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 6);
  return [...eligible, ...terminal];
};

const boundState = (state: CompanionContinuityState): CompanionContinuityState => CompanionContinuityStateSchema.parse({
  ...state,
  threads: boundThreads(state.threads),
  opinions: state.opinions.slice(0, 12),
  expectations: state.expectations.slice(0, 8),
  rituals: state.rituals.slice(0, 6),
});

export const createInitialContinuityState = (now = new Date()): CompanionContinuityState => ({
  version: 1,
  threads: [],
  opinions: [],
  expectations: [],
  rituals: [],
  updatedAt: iso(now),
});

export const advanceContinuityTime = (
  input: CompanionContinuityState,
  now = new Date(),
): CompanionContinuityState => {
  const state = CompanionContinuityStateSchema.parse(input);
  const timestamp = now.getTime();
  let changed = false;
  const threads = state.threads.map(thread => {
    if (thread.status === "resolved" || thread.status === "expired") return thread;
    if (thread.expiresAt && new Date(thread.expiresAt).getTime() <= timestamp) {
      changed = true;
      return { ...thread, status: "expired" as const, updatedAt: iso(now) };
    }
    if (thread.dueAt && new Date(thread.dueAt).getTime() <= timestamp && thread.status !== "due") {
      changed = true;
      return { ...thread, status: "due" as const, updatedAt: iso(now) };
    }
    return thread;
  });
  return boundState({ ...state, threads, updatedAt: changed ? iso(now) : state.updatedAt });
};

export const applyContinuityProposal = (
  input: CompanionContinuityState,
  rawProposal: unknown,
  evidence: ContinuityEvidence,
  now = new Date(),
): CompanionContinuityState => {
  const state = CompanionContinuityStateSchema.parse(input);
  const proposal = ContinuityProposalSchema.parse(rawProposal);
  assertEvidence(proposal.sourceMessageIds, evidence);
  const updatedAt = iso(now);

  if (proposal.type === "thread_upsert") {
    const id = `thread:${stableKey([proposal.kind, ...uniq(proposal.sourceMessageIds), proposal.summary])}`;
    const existing = state.threads.find(thread => thread.id === id);
    const next: ContinuityThread = {
      id,
      kind: proposal.kind,
      summary: proposal.summary,
      sourceMessageIds: uniq(proposal.sourceMessageIds),
      salience: proposal.salience,
      status: existing?.status === "due" ? "due" : "active",
      createdAt: existing?.createdAt ?? updatedAt,
      updatedAt,
      dueAt: proposal.dueAt,
      expiresAt: proposal.expiresAt,
      resolvedAt: existing?.status === "resolved" ? undefined : existing?.resolvedAt,
    };
    return boundState({
      ...state,
      threads: [next, ...state.threads.filter(thread => thread.id !== id)],
      updatedAt,
    });
  }

  if (proposal.type === "thread_resolve") {
    return boundState({
      ...state,
      threads: state.threads.map(thread => thread.id === proposal.threadId
        ? { ...thread, status: "resolved" as const, resolvedAt: updatedAt, updatedAt }
        : thread),
      updatedAt,
    });
  }

  if (proposal.type === "opinion_upsert") {
    const topic = proposal.topic.trim();
    const next: CompanionOpinion = {
      topic,
      stance: proposal.stance,
      confidence: proposal.confidence,
      sourceMessageIds: uniq(proposal.sourceMessageIds),
      status: proposal.status,
      updatedAt,
    };
    return boundState({
      ...state,
      opinions: [next, ...state.opinions.filter(item => item.topic.toLowerCase() !== topic.toLowerCase())],
      updatedAt,
    });
  }

  if (proposal.type === "expectation_retire") {
    return boundState({
      ...state,
      expectations: state.expectations.filter(item => item.key !== proposal.key),
      updatedAt,
    });
  }

  if (proposal.type === "expectation_upsert") {
    const ids = uniq(proposal.sourceMessageIds);
    const confidence = ids.length === 1 ? Math.min(proposal.confidence, 0.35) : proposal.confidence;
    const next: RelationshipExpectation = {
      key: proposal.key,
      statement: proposal.statement,
      confidence,
      evidenceCount: ids.length,
      sourceMessageIds: ids,
      updatedAt,
    };
    return boundState({
      ...state,
      expectations: [next, ...state.expectations.filter(item => item.key !== proposal.key)],
      updatedAt,
    });
  }

  const ritualIds = uniq(proposal.sourceMessageIds);
  if (ritualIds.length < 2) {
    return state;
  }
  const ritual: SharedRitual = {
    key: proposal.key,
    description: proposal.description,
    evidenceCount: ritualIds.length,
    lastSeenAt: proposal.lastSeenAt ?? updatedAt,
    nextEligibleAt: proposal.nextEligibleAt,
  };
  return boundState({
    ...state,
    rituals: [ritual, ...state.rituals.filter(item => item.key !== proposal.key)],
    updatedAt,
  });
};

export type ContinuityContextItem = {
  kind: "thread" | "opinion" | "expectation" | "ritual";
  text: string;
  priority: number;
};

export const selectContinuityContext = (
  input: CompanionContinuityState,
  now = new Date(),
  limit = 4,
): ContinuityContextItem[] => {
  const state = advanceContinuityTime(input, now);
  const items: ContinuityContextItem[] = [];

  for (const thread of state.threads) {
    if (!eligibleStatuses.has(thread.status)) continue;
    items.push({
      kind: "thread",
      text: thread.summary,
      priority: threadRank(thread),
    });
  }
  for (const opinion of state.opinions) {
    items.push({
      kind: "opinion",
      text: `${opinion.topic}: ${opinion.stance}`.slice(0, 200),
      priority: 1 + opinion.confidence,
    });
  }
  for (const expectation of state.expectations) {
    items.push({
      kind: "expectation",
      text: expectation.statement,
      priority: 0.8 + expectation.confidence,
    });
  }
  for (const ritual of state.rituals) {
    const due = !ritual.nextEligibleAt || new Date(ritual.nextEligibleAt).getTime() <= now.getTime();
    if (!due) continue;
    items.push({
      kind: "ritual",
      text: ritual.description,
      priority: 1 + Math.min(ritual.evidenceCount, 6) / 10,
    });
  }

  return items
    .sort((left, right) => right.priority - left.priority)
    .slice(0, Math.max(0, Math.min(4, limit)));
};
