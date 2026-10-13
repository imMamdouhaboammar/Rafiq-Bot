import type { BotSettings, UserProfile, PsychologicalState } from '../../types.js';
import { defaultCognitiveCoordinator } from './cognitiveCoordinator.server.js';
import { defaultGroundingVerifier } from './groundingVerifier.js';
import { resolveCognitiveMode } from './featureFlags.js';
import type { CognitiveTurnContext, GroundingDecision } from './types.js';

export interface CognitivePipelinePreparation {
  cognitiveContext?: CognitiveTurnContext;
  cognitiveXmlBlock?: string;
  advisorySocialInstruction?: string;
}

export interface CognitivePipelinePostProcess {
  processedText: string;
  groundingDecision?: GroundingDecision;
}

/**
 * Prepares cognitive context for the message generation pipeline.
 * Shared between sendMessageToGemini and sendMessageToGeminiStream to guarantee consistency.
 */
export async function prepareCognitivePipelineContext(params: {
  settings: BotSettings;
  userProfile: UserProfile | null;
  psychology?: PsychologicalState;
  newMessage: string;
  replyContextText?: string;
  memoryScopeId?: string;
  timeoutMs?: number;
}): Promise<CognitivePipelinePreparation> {
  const {
    settings,
    userProfile,
    psychology,
    newMessage,
    replyContextText,
    memoryScopeId,
    timeoutMs = 600,
  } = params;

  const mode = resolveCognitiveMode(settings, 'off');
  if (mode === 'off') {
    return {};
  }

  const ownerId = userProfile?.name || 'main_user';
  const companionId = memoryScopeId || settings.botName || 'companion';

  try {
    const turnPromise = defaultCognitiveCoordinator.prepareTurn({
      ownerId,
      companionId,
      userMessage: newMessage,
      replyContextText,
      mode,
      psychologicalState: psychology,
    });

    const cognitiveContext = await Promise.race([
      turnPromise,
      new Promise<CognitiveTurnContext>((_, reject) =>
        setTimeout(() => reject(new Error('Cognitive turn timeout')), timeoutMs)
      ),
    ]);

    let advisorySocialInstruction: string | undefined;
    if (cognitiveContext.socialMove && cognitiveContext.socialMove !== 'answer') {
      advisorySocialInstruction = `Advisory Conversational Move: ${cognitiveContext.socialMove.toUpperCase()} (Bubble budget: ${cognitiveContext.bubbleBudget}).`;
    }

    return {
      cognitiveContext,
      cognitiveXmlBlock: cognitiveContext.contextPrompt,
      advisorySocialInstruction,
    };
  } catch (err) {
    console.warn('[CognitivePipeline] Preparation failed or timed out; proceeding safely:', err);
    return {};
  }
}

/**
 * Post-processes generated reply text through the cognitive core:
 * - Strict factual grounding verification (with safe deflection in strict mode)
 * - Internal citation stripping ([ep_...] never exposed to user)
 * - Asynchronous idempotent turn observation
 */
export async function postProcessCognitiveReply(params: {
  rawReply: string;
  cognitiveContext?: CognitiveTurnContext;
  ownerId: string;
  companionId: string;
  userMessage: string;
}): Promise<CognitivePipelinePostProcess> {
  const { rawReply, cognitiveContext, ownerId, companionId, userMessage } = params;

  if (!cognitiveContext || cognitiveContext.mode === 'off') {
    return { processedText: defaultGroundingVerifier.stripInternalCitationTokens(rawReply) };
  }

  let finalReply = rawReply;
  let groundingDecision: GroundingDecision | undefined;

  try {
    groundingDecision = await defaultCognitiveCoordinator.verifyReply({
      runId: cognitiveContext.runId,
      ownerId,
      companionId,
      replyText: rawReply,
      deliveredEvidenceIds: cognitiveContext.deliveredEvidence.map(e => e.id),
      checkStrictGrounding: cognitiveContext.mode === 'strict',
    });

    // In strict mode, if ungrounded factual claims were made, deflect safely
    if (
      cognitiveContext.mode === 'strict' &&
      !groundingDecision.verified &&
      (groundingDecision.suggestedAction === 'deflect' || groundingDecision.suggestedAction === 'revise')
    ) {
      finalReply = 'مش متأكدة من تفاصيل الموضوع ده بصراحة، خلينا في اللي بنتكلم فيه.';
    }

    // Always strip internal citation tokens so the user never sees database keys
    finalReply = defaultGroundingVerifier.stripInternalCitationTokens(finalReply);

    // Asynchronously record turn observation
    const turnId = `turn_${cognitiveContext.runId}`;
    void defaultCognitiveCoordinator.observeTurn({
      turnId,
      ownerId,
      companionId,
      userMessage,
      replyText: finalReply,
      groundingDecision,
      deliveredEvidenceIds: cognitiveContext.deliveredEvidence.map(e => e.id),
    }).catch(err => {
      console.warn('[CognitivePipeline] observeTurn error:', err);
    });
  } catch (err) {
    console.warn('[CognitivePipeline] Verification post-process error:', err);
    finalReply = defaultGroundingVerifier.stripInternalCitationTokens(finalReply);
  }

  return {
    processedText: finalReply,
    groundingDecision,
  };
}
