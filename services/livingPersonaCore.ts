import type {
  AdaptivePersonalityEvidence,
  AdaptivePersonalityState,
  BotSettings,
  SoulTraits,
} from "../types.js";
import { AdaptivePersonalityStateSchema } from "../types.js";
import { SOUL_ARCHETYPES, getSoulById } from "./soulRegistry.js";

export const ADAPTIVE_FACETS = [
  "warmth",
  "humor",
  "directness",
  "expressiveness",
  "initiative",
] as const;

export type AdaptiveFacet = typeof ADAPTIVE_FACETS[number];
export type PersonalitySignalKind = "explicit_preference" | "correction" | "repeated_pattern";

export type PersonalitySignalProposal = {
  facet: AdaptiveFacet;
  direction: -1 | 1;
  strength: number;
  confidence: number;
  kind: PersonalitySignalKind;
  evidenceMessageIds: string[];
};

export type AdaptivePersonalityMutation =
  | { type: "set_enabled"; enabled: boolean }
  | { type: "reset"; enabled: boolean };

export type PersonalityEvidenceMessage = {
  id: string;
  sessionKey: string;
  timestamp: Date;
};

export type PersonalityReductionContext = {
  batchId: string;
  now: Date;
  messages: PersonalityEvidenceMessage[];
};

type ReductionAudit = {
  appliedFacets: AdaptiveFacet[];
  rejectedSignals: number;
  duplicateBatch: boolean;
};

export type ResolvedLivingPersona = {
  baselineTraits: SoulTraits;
  effectiveTraits: SoulTraits;
  adaptiveInstruction: string;
  revision: string;
};

const MAX_EVIDENCE = 60;
const MAX_PROCESSED_IDS = 120;
const MAX_OFFSET_BPS = 1500;
const MAX_BATCH_DELTA_BPS = 100;
const MAX_DAILY_DELTA_BPS = 300;
const EXPLICIT_PREFERENCE_DELTA_BPS = 50;
const EVIDENCE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const STYLE_HALF_LIFE_DAYS = 45;
const SIGNAL_KINDS: PersonalitySignalKind[] = ["explicit_preference", "correction", "repeated_pattern"];

const FACET_LABELS: Record<AdaptiveFacet, { positive: string; negative: string }> = {
  warmth: { positive: "warmer when the moment needs it", negative: "more emotionally reserved" },
  humor: { positive: "more playful", negative: "less likely to force jokes" },
  directness: { positive: "more direct", negative: "more tactful and indirect" },
  expressiveness: { positive: "a little more expressive", negative: "more concise and understated" },
  initiative: { positive: "slightly more willing to initiate", negative: "less likely to push the conversation" },
};

const FACET_SUMMARIES: Record<AdaptiveFacet, { positive: string; negative: string }> = {
  warmth: { positive: "أدفى وقت ما الموقف يحتاج", negative: "أهدى وأقل اندفاعًا عاطفيًا" },
  humor: { positive: "أخف في الهزار", negative: "أقل فرضًا للهزار" },
  directness: { positive: "أوضح وأدخل في الموضوع أسرع", negative: "ألطف وأقل مباشرة" },
  expressiveness: { positive: "أكثر تعبيرًا شوية", negative: "أقصر وأهدى في التعبير" },
  initiative: { positive: "أكثر مبادرة بشكل خفيف", negative: "أقل ضغطًا لاستمرار الكلام" },
};

const emptyFacet = () => ({ offsetBps: 0, confidenceBps: 0, evidenceCount: 0 });

export const createAdaptivePersonalityState = (
  enabled = true,
): AdaptivePersonalityState => ({
  enabled,
  version: 1,
  facets: {
    warmth: emptyFacet(),
    humor: emptyFacet(),
    directness: emptyFacet(),
    expressiveness: emptyFacet(),
    initiative: emptyFacet(),
  },
  evidence: [],
  processedMessageIds: [],
  runsToday: 0,
  dailyDeltaBps: {},
  observationCount: 0,
  summary: "لسه بيتعرف على إيقاع الكلام وحدوده.",
});

export const applyAdaptivePersonalityMutation = (
  current: AdaptivePersonalityState | undefined,
  mutation: AdaptivePersonalityMutation,
  now = new Date(),
): AdaptivePersonalityState => {
  const state = current || createAdaptivePersonalityState();
  if (mutation.type === "set_enabled") {
    return {
      ...cloneState(state),
      enabled: mutation.enabled,
      version: state.version + 1,
      ...(mutation.enabled ? { observeAfter: now } : {}),
    };
  }

  return {
    ...createAdaptivePersonalityState(mutation.enabled),
    version: state.version + 1,
    processedMessageIds: [...state.processedMessageIds],
    lastObservedUserAt: state.lastObservedUserAt,
    currentSessionKey: state.currentSessionKey,
    observeAfter: now,
  };
};

const clamp = (value: number, min: number, max: number): number => (
  Math.max(min, Math.min(max, value))
);

const cloneState = (state: AdaptivePersonalityState): AdaptivePersonalityState => ({
  ...state,
  facets: Object.fromEntries(
    ADAPTIVE_FACETS.map(facet => [facet, { ...state.facets[facet] }]),
  ) as AdaptivePersonalityState["facets"],
  evidence: state.evidence.map(item => ({ ...item })),
  processedMessageIds: [...state.processedMessageIds],
  dailyDeltaBps: { ...state.dailyDeltaBps },
});

const dayKey = (date: Date): string => date.toISOString().slice(0, 10);

const applyTimeDecay = (state: AdaptivePersonalityState, now: Date): void => {
  if (!state.updatedAt) return;
  const elapsedDays = Math.max(0, (now.getTime() - new Date(state.updatedAt).getTime()) / 86_400_000);
  if (elapsedDays < 1) return;

  const factor = Math.pow(0.5, elapsedDays / STYLE_HALF_LIFE_DAYS);
  for (const facet of ADAPTIVE_FACETS) {
    const current = state.facets[facet];
    current.offsetBps = Math.round(current.offsetBps * factor);
    current.confidenceBps = Math.round(current.confidenceBps * Math.max(0.75, factor));
  }
};

const reliabilityFor = (kind: PersonalitySignalKind): number => {
  if (kind === "correction") return 1;
  if (kind === "explicit_preference") return 0.95;
  return 0.7;
};

const summarize = (state: AdaptivePersonalityState): string => {
  const active = ADAPTIVE_FACETS
    .map(facet => ({ facet, ...state.facets[facet] }))
    .filter(item => Math.abs(item.offsetBps) >= 50)
    .sort((a, b) => Math.abs(b.offsetBps) - Math.abs(a.offsetBps))
    .slice(0, 3)
    .map(item => item.offsetBps > 0 ? FACET_SUMMARIES[item.facet].positive : FACET_SUMMARIES[item.facet].negative);

  if (active.length === 0) return "لسه بيتعرف على إيقاع الكلام وحدوده.";
  return `اتعلم تدريجيًا يبقى ${active.join("، و")}.`;
};

export const reduceAdaptivePersonality = (
  current: AdaptivePersonalityState,
  proposals: PersonalitySignalProposal[],
  context: PersonalityReductionContext,
): { next: AdaptivePersonalityState; audit: ReductionAudit } => {
  if (!current.enabled || current.lastBatchId === context.batchId) {
    return {
      next: current,
      audit: { appliedFacets: [], rejectedSignals: 0, duplicateBatch: current.lastBatchId === context.batchId },
    };
  }

  const next = cloneState(current);
  applyTimeDecay(next, context.now);

  const today = dayKey(context.now);
  if (next.runDay !== today) {
    next.runDay = today;
    next.runsToday = 0;
    next.dailyDeltaBps = {};
  }

  const processed = new Set(next.processedMessageIds);
  const messageMap = new Map(
    context.messages
      .filter(item => !processed.has(item.id))
      .map(item => [item.id, item]),
  );
  const existingEvidenceKeys = new Set(next.evidence.map(item => `${item.messageId}:${item.facet}`));
  const acceptedFacets = new Set<AdaptiveFacet>();
  const acceptedCorrections = new Map<AdaptiveFacet, AdaptivePersonalityEvidence>();
  let rejectedSignals = 0;

  for (const rawProposal of proposals.slice(0, 20)) {
    if (!rawProposal || typeof rawProposal !== "object") {
      rejectedSignals += 1;
      continue;
    }
    const proposal = rawProposal as PersonalitySignalProposal;
    if (!ADAPTIVE_FACETS.includes(proposal.facet)
      || ![-1, 1].includes(proposal.direction)
      || !SIGNAL_KINDS.includes(proposal.kind)
      || !Array.isArray(proposal.evidenceMessageIds)
      || !Number.isFinite(proposal.strength)
      || !Number.isFinite(proposal.confidence)) {
      rejectedSignals += 1;
      continue;
    }

    const confidence = clamp(proposal.confidence, 0, proposal.kind === "repeated_pattern" ? 0.8 : 1);
    if (confidence < 0.65) {
      rejectedSignals += 1;
      continue;
    }

    let acceptedEvidence = 0;
    for (const messageId of [...new Set(proposal.evidenceMessageIds)].slice(0, 5)) {
      const source = messageMap.get(messageId);
      const evidenceKey = `${messageId}:${proposal.facet}`;
      if (!source || existingEvidenceKeys.has(evidenceKey)) continue;

      const evidence: AdaptivePersonalityEvidence = {
        messageId,
        sessionKey: source.sessionKey,
        facet: proposal.facet,
        direction: proposal.direction,
        strength: Math.round(clamp(proposal.strength, 1, 3)),
        confidenceBps: Math.round(confidence * 10_000),
        kind: proposal.kind,
        observedAt: source.timestamp,
      };
      next.evidence.push(evidence);
      existingEvidenceKeys.add(evidenceKey);
      if (evidence.kind === "correction") acceptedCorrections.set(evidence.facet, evidence);
      acceptedEvidence += 1;
    }

    if (acceptedEvidence === 0) rejectedSignals += 1;
    else acceptedFacets.add(proposal.facet);
  }

  const cutoff = context.now.getTime() - EVIDENCE_RETENTION_MS;
  next.evidence = next.evidence
    .filter(item => new Date(item.observedAt).getTime() >= cutoff)
    .slice(-MAX_EVIDENCE);

  const appliedFacets: AdaptiveFacet[] = [];
  for (const facet of ADAPTIVE_FACETS) {
    const evidence = next.evidence.filter(item => item.facet === facet);
    if (evidence.length === 0) continue;

    let signedWeight = 0;
    let totalWeight = 0;
    for (const item of evidence) {
      const weight = item.strength * (item.confidenceBps / 10_000) * reliabilityFor(item.kind);
      signedWeight += item.direction * weight;
      totalWeight += weight;
    }

    const agreement = totalWeight > 0 ? Math.abs(signedWeight) / totalWeight : 0;
    const support = 1 - Math.exp(-totalWeight / 3);
    const confidence = agreement * support;
    const distinctMessages = new Set(evidence.map(item => item.messageId)).size;
    const distinctSessions = new Set(evidence.map(item => item.sessionKey)).size;
    const explicitDirection = evidence
      .filter(item => item.kind === "explicit_preference" || item.kind === "correction")
      .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime())[0]?.direction;
    const acceptedCorrection = acceptedCorrections.get(facet);
    const hasContradiction = new Set(evidence.map(item => item.direction)).size > 1;

    const currentFacet = next.facets[facet];
    currentFacet.confidenceBps = Math.round(clamp(confidence * 10_000, 0, 10_000));
    currentFacet.evidenceCount = distinctMessages;

    let delta = 0;
    if (!acceptedFacets.has(facet)) {
      delta = 0;
    } else if (hasContradiction && !acceptedCorrection) {
      delta = 0;
    } else if (acceptedCorrection) {
      delta = acceptedCorrection.direction * EXPLICIT_PREFERENCE_DELTA_BPS;
    } else if (explicitDirection && distinctMessages === 1) {
      delta = explicitDirection * EXPLICIT_PREFERENCE_DELTA_BPS;
    } else if (distinctMessages >= 3 && distinctSessions >= 2 && confidence >= 0.7 && agreement >= 0.7) {
      const target = Math.round(Math.sign(signedWeight) * agreement * MAX_OFFSET_BPS);
      delta = clamp(target - currentFacet.offsetBps, -MAX_BATCH_DELTA_BPS, MAX_BATCH_DELTA_BPS);
    }

    const usedToday = Math.abs(next.dailyDeltaBps[facet] || 0);
    const remainingToday = Math.max(0, MAX_DAILY_DELTA_BPS - usedToday);
    delta = clamp(delta, -remainingToday, remainingToday);
    if (delta !== 0) {
      currentFacet.offsetBps = Math.round(clamp(currentFacet.offsetBps + delta, -MAX_OFFSET_BPS, MAX_OFFSET_BPS));
      next.dailyDeltaBps[facet] = (next.dailyDeltaBps[facet] || 0) + Math.abs(delta);
      appliedFacets.push(facet);
    }
  }

  const newlyProcessed = [...messageMap.keys()];
  next.processedMessageIds = [...next.processedMessageIds, ...newlyProcessed].slice(-MAX_PROCESSED_IDS);
  const latestObservedMessage = [...messageMap.values()]
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    .at(-1);
  if (latestObservedMessage) {
    next.lastObservedUserAt = latestObservedMessage.timestamp;
    next.currentSessionKey = latestObservedMessage.sessionKey;
  }
  next.observationCount += newlyProcessed.length;
  next.lastBatchId = context.batchId;
  next.lastRunAt = context.now;
  next.updatedAt = context.now;
  next.runsToday += 1;
  next.version += 1;
  next.summary = summarize(next);

  return {
    next,
    audit: { appliedFacets, rejectedSignals, duplicateBatch: false },
  };
};

export const compileAdaptivePersonalityInstruction = (
  state?: AdaptivePersonalityState,
): string => {
  if (!state?.enabled) return "";
  const tendencies = ADAPTIVE_FACETS
    .map(facet => ({ facet, state: state.facets[facet] }))
    .filter(item => Math.abs(item.state.offsetBps) >= 50)
    .sort((a, b) => Math.abs(b.state.offsetBps) - Math.abs(a.state.offsetBps))
    .slice(0, 4)
    .map(item => `- ${item.state.offsetBps > 0 ? FACET_LABELS[item.facet].positive : FACET_LABELS[item.facet].negative}.`);

  if (tendencies.length === 0) return "";
  return `### ADAPTIVE PERSONALITY\n${tendencies.join("\n")}\nThese are subtle relationship-specific tendencies, not a role to perform every turn. Core identity, boundaries, current mood, and the user's actual request always take priority.`.slice(0, 800);
};

export const getEffectiveAdaptivePersonality = (
  state: AdaptivePersonalityState | undefined,
  now = new Date(),
): AdaptivePersonalityState | undefined => {
  if (!state) return undefined;
  const parsed = AdaptivePersonalityStateSchema.safeParse(state);
  if (!parsed.success) return undefined;
  const effective = cloneState(parsed.data);
  applyTimeDecay(effective, now);
  return effective;
};

export const resolveLivingPersona = (settings: BotSettings, now = new Date()): ResolvedLivingPersona => {
  const activeSoul = getSoulById(settings.soulId || "amira_default") || SOUL_ARCHETYPES[0];
  const baselineTraits = (settings.soulTraits || activeSoul.baseTraits) as SoulTraits;
  const effectiveAdaptiveState = getEffectiveAdaptivePersonality(settings.adaptivePersonality, now);
  const adaptiveInstruction = compileAdaptivePersonalityInstruction(effectiveAdaptiveState);
  return {
    baselineTraits,
    effectiveTraits: { ...baselineTraits },
    adaptiveInstruction,
    revision: `${settings.soulId || "amira_default"}:${settings.adaptivePersonality?.version || 0}`,
  };
};
