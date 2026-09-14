import type { BotSettings, PsychologicalState } from '../../types.js';
import type {
  CompanionContinuityState,
  ContinuityThread,
} from '../companionContinuity.js';
import {
  classifyConversationRoute,
  type ConversationRouteId,
} from '../conversationRouter.js';
import { planConversation } from './planConversation.js';
import { compileDynamicsPrompt } from './dynamicsPromptCompiler.js';
import type {
  ContinuityCandidate,
  ConversationPlan,
  DynamicsInput,
  RelationshipEvidence,
  SensitivityLevel,
} from './types.js';

const CORRECTION_PATTERN = /(?:مش كدا|مش كدة|مش كدا خالص|غلط|مش قصدي|مش قصدى|انت فاهم غلط|أنت فاهم غلط|لا يا عم|لا انا قولت|لا أنا قولت|صحح|لا مش كده|مش ده اللي قولته|مش دا اللي قولته|\bwrong\b|\bnot what i meant\b)/i;
const SOCIAL_PING_PATTERN = /^(?:[؟?.]+|\s*(?:فينك|انت فين|إنت فين|انتي فين|إنتي فين|مبتردش(?:\s*ليه)?|مش بترد(?:\s*ليه)?|مش بتردي(?:\s*ليه)?|مبترديش(?:\s*ليه)?|يا بني|يا بنتي|روحت فين|روحتي فين|ازيك(?:\s+ازيك)+|جيجي|يا عم|يا سيدي)\s*[؟?.]*)$/i;
const HIGH_SENSITIVITY_PATTERN = /(?:مات|توفى|وفاة|انتحار|جنازة|كارثة|حادثة|مصيبة|مستشفى|عملية|مرض خبيث|كانسر|طلاق|فراق نهائي)/i;
const OPINION_PATTERN = /(?:شايف ان|شايف إن|رأيي|رايي|بحس ان|اعتقد|أعتقد|في نظري|مش مقتنع|من وجهة نظري|\bin my opinion\b|\bi think\b)/i;
const PRACTICAL_REQUEST_PATTERN = /(?:اعمل ايه|أعمل إيه|ازاي اعمل|ازاى اعمل|ساعدني في|خطوات|طريقة|لخصلي|كود|اكتبلي ايميل|اكتبلي رسالة|صلحلي|حل المشكلة|\bhow to\b|\bhelp me with\b)/i;

export interface DynamicsAdapterContext {
  messageText: string;
  routeId?: ConversationRouteId;
  replyContextText?: string;
  recentHistory?: { role: string; parts: { text: string }[] }[];
  continuityState?: CompanionContinuityState | null;
  psychology?: PsychologicalState;
  settings?: BotSettings;
  callbackBudgetAvailable?: boolean;
}

export function deriveSensitivity(
  text: string,
  routeId: ConversationRouteId,
  psychology?: PsychologicalState,
): SensitivityLevel {
  if (HIGH_SENSITIVITY_PATTERN.test(text)) return 'high';
  if (psychology?.breakpointState === 'disappointed') return 'high';
  if (routeId === 'conflict') return 'medium';
  if (routeId === 'venting') return 'medium';
  return 'low';
}

export function deriveDynamicsInput(
  context: DynamicsAdapterContext,
): DynamicsInput {
  const text = (context.messageText || '').trim();
  const route = context.routeId || classifyConversationRoute(text, context.replyContextText).id;
  const sensitivity = deriveSensitivity(text, route, context.psychology);

  const isSocialPing = SOCIAL_PING_PATTERN.test(text) || (text.length <= 15 && /^[؟?.!]+$/.test(text));
  const asksConcreteQuestion = /[؟?]/.test(text) || /(?:ايه|إيه|ازاي|ازاى|ليه|متى|امتى|فين|هل|مين)\b/.test(text);
  const requestsPracticalHelp = route === 'decision' || PRACTICAL_REQUEST_PATTERN.test(text);
  const expressesDistress = route === 'venting' || route === 'conflict';
  const containsCorrection = CORRECTION_PATTERN.test(text);
  const activeConflict = route === 'conflict' || (context.psychology?.emotionalLedger ?? 0) < -25;
  const userInvitesPlayfulness = route === 'banter' || /(?:😂|🤣|🌚|بهزر|بترول|هزار|ضحك|\blol\b)/i.test(text);
  const userExpressesOpinion = OPINION_PATTERN.test(text);

  // Derive burst and verbosity from recent history
  const history = context.recentHistory || [];
  let recentSameSpeakerBurst = 1;
  let recentAssistantVerbosity: 'micro' | 'short' | 'normal' | 'long' = 'short';

  if (history.length > 0) {
    let userRun = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === 'user') {
        userRun++;
      } else {
        break;
      }
    }
    if (userRun > 0) {
      recentSameSpeakerBurst = Math.min(5, userRun);
    }

    const lastModelTurn = [...history].reverse().find(h => h.role === 'model');
    if (lastModelTurn) {
      const modelText = lastModelTurn.parts.map(p => p.text).join(' ');
      const len = modelText.length;
      if (len < 30) recentAssistantVerbosity = 'micro';
      else if (len < 100) recentAssistantVerbosity = 'short';
      else if (len < 300) recentAssistantVerbosity = 'normal';
      else recentAssistantVerbosity = 'long';
    }
  }

  // Check if assistant has a stable contrasting opinion from continuity state
  let assistantHasDifferentStableOpinion = false;
  if (context.continuityState?.opinions && userExpressesOpinion) {
    const stableOpinion = context.continuityState.opinions.find(
      op => op.status === 'stable' && text.toLowerCase().includes(op.topic.toLowerCase())
    );
    if (stableOpinion && stableOpinion.confidence >= 0.7) {
      assistantHasDifferentStableOpinion = true;
    }
  }

  return {
    messageTextLength: text.length,
    isSocialPing,
    asksConcreteQuestion,
    requestsPracticalHelp,
    expressesDistress,
    containsCorrection,
    activeConflict,
    sensitivity,
    userInvitesPlayfulness,
    userExpressesOpinion,
    assistantHasDifferentStableOpinion,
    recentAssistantVerbosity,
    recentSameSpeakerBurst,
    allowTopicShift: !asksConcreteQuestion && !requestsPracticalHelp && !containsCorrection,
  };
}

export function deriveRelationshipEvidence(
  continuityState?: CompanionContinuityState | null,
  psychology?: PsychologicalState,
): RelationshipEvidence {
  const intimacy = psychology?.intimacyLevel ?? 5;
  const ledger = psychology?.emotionalLedger ?? 0;
  const breakpoint = psychology?.breakpointState === 'disappointed';

  // Base evidence derived from intimacy and expectations
  let teasingPositive = intimacy >= 70 ? 4 : intimacy >= 40 ? 2 : 0;
  let teasingNegative = (breakpoint || ledger < -20) ? 2 : 0;
  let nicknameUses = 0;
  let nicknameSessions = 0;
  let codeSwitchCount = 0;
  let codeSwitchSessions = 0;
  let sharedReferences = 0;
  let directnessEvidence = intimacy >= 50 ? 2 : 0;

  if (continuityState) {
    for (const exp of continuityState.expectations || []) {
      const key = exp.key.toLowerCase();
      if (key.includes('teas') || key.includes('banter') || key.includes('هزار')) {
        teasingPositive = Math.max(teasingPositive, exp.evidenceCount);
      }
      if (key.includes('boundary') || key.includes('correction') || key.includes('زعل')) {
        teasingNegative = Math.max(teasingNegative, exp.evidenceCount);
      }
      if (key.includes('nickname') || key.includes('لقب') || key.includes('دلع')) {
        nicknameUses = Math.max(nicknameUses, exp.evidenceCount);
        nicknameSessions = Math.max(nicknameSessions, Math.min(3, exp.evidenceCount));
      }
      if (key.includes('code_switch') || key.includes('franco') || key.includes('انجليزي')) {
        codeSwitchCount = Math.max(codeSwitchCount, exp.evidenceCount);
        codeSwitchSessions = Math.max(codeSwitchSessions, 2);
      }
      if (key.includes('direct') || key.includes('صراحة')) {
        directnessEvidence = Math.max(directnessEvidence, exp.evidenceCount);
      }
    }

    for (const ritual of continuityState.rituals || []) {
      sharedReferences += ritual.evidenceCount;
    }
  }

  return {
    teasingPositiveReciprocations: teasingPositive,
    teasingNegativeCorrections: teasingNegative,
    nicknameReciprocatedUses: nicknameUses,
    nicknameSessions,
    codeSwitchUserExamples: codeSwitchCount,
    codeSwitchSessions,
    sharedReferenceReciprocations: sharedReferences,
    directnessPositiveEvidence: directnessEvidence,
  };
}

const HEALTH_WORDS = ['دكتور', 'علاج', 'تعب', 'صداع', 'مرض', 'دوا', 'عملية', 'مستشفى', 'عيادة', 'كشف'];

function mapThreadKindToCandidateKind(thread: ContinuityThread): ContinuityCandidate['kind'] {
  if (thread.kind === 'outcome') return 'outcome';
  if (thread.kind === 'commitment') return 'plan';
  if (thread.kind === 'shared_interest') return 'shared_interest';
  if (thread.kind === 'inside_joke') return 'ritual';
  if (HEALTH_WORDS.some(w => thread.summary.includes(w))) return 'health';
  return 'practical_task';
}

function computeWordRelevance(summary: string, messageText: string): number {
  if (!messageText || !summary) return 0.2;
  const messageWords = messageText.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
  if (messageWords.length === 0) return 0.2;
  const summaryLower = summary.toLowerCase();
  let hits = 0;
  for (const word of messageWords) {
    if (summaryLower.includes(word)) hits++;
  }
  return hits > 0 ? Math.min(0.95, 0.5 + hits * 0.2) : 0.25;
}

export function deriveContinuityCandidates(
  continuityState?: CompanionContinuityState | null,
  messageText: string = '',
): ContinuityCandidate[] {
  if (!continuityState?.threads || continuityState.threads.length === 0) {
    return [];
  }

  return continuityState.threads
    .filter(t => t.status !== 'expired' && t.status !== 'resolved')
    .map(thread => ({
      id: thread.id,
      kind: mapThreadKindToCandidateKind(thread),
      summary: thread.summary,
      salience: thread.salience,
      relevance: computeWordRelevance(thread.summary, messageText),
      due: thread.status === 'due' || thread.status === 'active',
      expired: thread.status === 'expired',
      resolved: thread.status === 'resolved',
      sourceEvidenceCount: thread.sourceMessageIds?.length || 1,
    }));
}

export interface ConversationDynamicsResult {
  plan: ConversationPlan;
  dynamicsInstruction: string;
}

export function resolveConversationDynamics(
  context: DynamicsAdapterContext,
): ConversationDynamicsResult {
  try {
    const input = deriveDynamicsInput(context);
    const evidence = deriveRelationshipEvidence(context.continuityState, context.psychology);
    const continuityCandidates = deriveContinuityCandidates(context.continuityState, context.messageText);

    const plan = planConversation({
      input,
      evidence,
      continuityCandidates,
      callbackBudgetAvailable: context.callbackBudgetAvailable ?? true,
    });

    const dynamicsInstruction = compileDynamicsPrompt(plan);

    return {
      plan,
      dynamicsInstruction,
    };
  } catch (err) {
    console.warn('[ConversationDynamics] Fallback due to adapter error:', err);
    const fallbackPlan: ConversationPlan = {
      move: 'acknowledge',
      shape: {
        bubbleCount: 1,
        verbosity: 'short',
        askQuestion: false,
        allowTopicShift: true,
        relationshipSignal: 'none',
      },
      safetyReasons: ['dynamics_adapter_fallback'],
    };
    return {
      plan: fallbackPlan,
      dynamicsInstruction: '',
    };
  }
}
