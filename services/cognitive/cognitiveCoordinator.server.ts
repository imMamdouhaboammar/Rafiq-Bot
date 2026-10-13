import {
  CognitiveTurnInput,
  CognitiveTurnContext,
  GroundingVerificationInput,
  GroundingDecision,
  TurnObservationInput,
  IngestionInput,
  IngestionResult,
  EvidenceCorrectionInput,
  EvidenceInvalidationInput,
  EpistemicEvidence,
} from './types.js';
import { CognitiveEvidenceStore, defaultEvidenceStore } from './evidenceStore.js';
import { EpisodicRecallEngine, defaultEpisodicRecall } from './episodicRecall.js';
import { AssociativeRecallEngine, defaultAssociativeRecall } from './associativeRecall.js';
import { SocialMovePlanner, defaultSocialMovePlanner } from './socialMovePlanner.js';
import { CognitiveContextCompiler, defaultContextCompiler } from './contextCompiler.js';
import { GroundingVerifier, defaultGroundingVerifier } from './groundingVerifier.js';
import { CognitiveIngestionAdapter, defaultIngestionAdapter } from './ingestionAdapter.js';
import { resolveCognitiveMode } from './featureFlags.js';

export interface CognitiveCoordinatorOptions {
  evidenceStore?: CognitiveEvidenceStore;
  episodicRecall?: EpisodicRecallEngine;
  associativeRecall?: AssociativeRecallEngine;
  socialMovePlanner?: SocialMovePlanner;
  contextCompiler?: CognitiveContextCompiler;
  groundingVerifier?: GroundingVerifier;
  ingestionAdapter?: CognitiveIngestionAdapter;
}

export class CognitiveCoordinator {
  private evidenceStore: CognitiveEvidenceStore;
  private episodicRecall: EpisodicRecallEngine;
  private associativeRecall: AssociativeRecallEngine;
  private socialMovePlanner: SocialMovePlanner;
  private contextCompiler: CognitiveContextCompiler;
  private groundingVerifier: GroundingVerifier;
  private ingestionAdapter: CognitiveIngestionAdapter;

  // Cache to guarantee turn observation idempotency
  private observedTurnIds: Set<string> = new Set();

  constructor(options: CognitiveCoordinatorOptions = {}) {
    this.evidenceStore = options.evidenceStore || defaultEvidenceStore;
    this.episodicRecall = options.episodicRecall || new EpisodicRecallEngine(this.evidenceStore);
    this.associativeRecall = options.associativeRecall || new AssociativeRecallEngine(this.evidenceStore);
    this.socialMovePlanner = options.socialMovePlanner || defaultSocialMovePlanner;
    this.contextCompiler = options.contextCompiler || defaultContextCompiler;
    this.groundingVerifier = options.groundingVerifier || new GroundingVerifier(this.evidenceStore);
    this.ingestionAdapter = options.ingestionAdapter || defaultIngestionAdapter;
  }

  /**
   * Prepares cognitive context for the current turn.
   * Side-effect-free with respect to authoritative state.
   */
  public async prepareTurn(input: CognitiveTurnInput): Promise<CognitiveTurnContext> {
    const {
      ownerId,
      companionId,
      userMessage,
      replyContextText,
      psychologicalState,
      continuityState,
      timeScopeYear,
    } = input;

    const mode = input.mode || 'off';
    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // If disabled, return zero-overhead context
    if (mode === 'off') {
      return {
        runId,
        companionId,
        mode: 'off',
        socialMove: 'answer',
        bubbleBudget: 1,
        deliveredEvidence: [],
        activeConcerns: [],
        activeThreads: [],
        relationalPermissions: {
          teasingPermitted: false,
          vulnerabilityPermitted: false,
          disagreePermitted: true,
          romanticPermitted: false,
          trustScore: 0.5,
          closenessScore: 0.5,
        },
        contextPrompt: '',
        tokenEstimate: 0,
      };
    }

    try {
      // 1. Social Move Planning
      const socialPlan = this.socialMovePlanner.planMove(
        userMessage,
        replyContextText,
        psychologicalState,
        continuityState
      );

      // 2. Candidate Recall (Strictly scoped to ownerId + companionId)
      const scoredCandidates = await this.episodicRecall.recallCandidates(
        ownerId,
        companionId,
        userMessage,
        3
      );
      const seedEvidence = scoredCandidates.map(sc => sc.evidence);

      // 3. Associative Spreading Activation
      let activatedNodes: EpistemicEvidence[] = [];
      if (seedEvidence.length > 0) {
        const activated = await this.associativeRecall.spreadingActivation(
          ownerId,
          companionId,
          seedEvidence.map(e => e.id),
          2,
          0.65,
          0.35,
          3
        );
        activatedNodes = activated.map(a => a.evidence);
      }

      // Merge and deduplicate delivery slice (max 4 items for prompt economy)
      const deliveryMap = new Map<string, EpistemicEvidence>();
      for (const ep of [...seedEvidence, ...activatedNodes]) {
        deliveryMap.set(ep.id, ep);
      }
      const deliveredEvidence = Array.from(deliveryMap.values()).slice(0, 4);

      // Record delivery slice in evidence store for "No ID, No Claim" verification
      this.evidenceStore.recordDeliverySlice(
        runId,
        ownerId,
        companionId,
        deliveredEvidence.map(ep => ep.id)
      );

      // 4. Milestone Check
      let eraMilestone = undefined;
      if (timeScopeYear) {
        eraMilestone = await this.evidenceStore.getMilestoneForYear(
          ownerId,
          companionId,
          timeScopeYear
        );
      }

      // 5. Context Compilation (<400 tokens)
      const compiled = this.contextCompiler.compile({
        runId,
        companionId,
        socialMove: socialPlan.socialMove,
        bubbleBudget: socialPlan.bubbleCount,
        deliveredEvidence,
        eraMilestone,
        relationalPermissions: socialPlan.relationalPermissions,
        psychologicalState,
        continuityState,
      });

      return {
        runId,
        companionId,
        mode,
        socialMove: socialPlan.socialMove,
        bubbleBudget: socialPlan.bubbleCount,
        deliveredEvidence,
        eraMilestone,
        activeConcerns: (continuityState?.opinions || []).slice(0, 3).map(o => o.topic),
        activeThreads: (continuityState?.threads || []).slice(0, 3).map(t => t.summary),
        relationalPermissions: socialPlan.relationalPermissions,
        contextPrompt: compiled.xmlBlock,
        tokenEstimate: compiled.tokenEstimate,
      };
    } catch (err) {
      console.warn('[CognitiveCoordinator] Error preparing turn; falling back safely:', err);
      return {
        runId,
        companionId,
        mode,
        socialMove: 'answer',
        bubbleBudget: 1,
        deliveredEvidence: [],
        activeConcerns: [],
        activeThreads: [],
        relationalPermissions: {
          teasingPermitted: false,
          vulnerabilityPermitted: false,
          disagreePermitted: true,
          romanticPermitted: false,
          trustScore: 0.5,
          closenessScore: 0.5,
        },
        contextPrompt: '',
        tokenEstimate: 0,
      };
    }
  }

  /**
   * Verifies reply text against delivered evidence and claim classification.
   */
  public async verifyReply(input: GroundingVerificationInput): Promise<GroundingDecision> {
    return this.groundingVerifier.verifyReply(input);
  }

  /**
   * Observes turn completion. Idempotent per turnId.
   */
  public async observeTurn(input: TurnObservationInput): Promise<void> {
    const { turnId } = input;
    if (!turnId) return;

    if (this.observedTurnIds.has(turnId)) {
      return; // already processed
    }
    this.observedTurnIds.add(turnId);

    // Keep cache bounded
    if (this.observedTurnIds.size > 2000) {
      const firstEntry = this.observedTurnIds.values().next().value;
      if (firstEntry) this.observedTurnIds.delete(firstEntry);
    }
  }

  /**
   * Character-independent ingestion.
   */
  public async ingestPersona(input: IngestionInput): Promise<IngestionResult> {
    const result = await this.ingestionAdapter.ingestPersona(input);

    // Persist extracted facts
    for (const ep of result.extractedFacts) {
      await this.evidenceStore.insertEvidence(ep);
    }

    return result;
  }

  /**
   * Correct evidence.
   */
  public async correctEvidence(input: EvidenceCorrectionInput): Promise<void> {
    await this.evidenceStore.correctEvidence(
      input.ownerId,
      input.companionId,
      input.targetEvidenceId,
      input.correctedText,
      input.newConfidence
    );
  }

  /**
   * Invalidate evidence.
   */
  public async invalidateEvidence(input: EvidenceInvalidationInput): Promise<void> {
    await this.evidenceStore.invalidateEvidence(
      input.ownerId,
      input.companionId,
      input.targetEvidenceId,
      input.reason
    );
  }

  public getEvidenceStore(): CognitiveEvidenceStore {
    return this.evidenceStore;
  }
}

export const defaultCognitiveCoordinator = new CognitiveCoordinator();
