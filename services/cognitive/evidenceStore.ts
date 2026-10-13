import {
  EpistemicEvidence,
  EpistemicEvidenceSchema,
  AssociativeEdge,
  AssociativeEdgeSchema,
  LifeMilestone,
  LifeMilestoneSchema,
} from './types.js';

interface DeliveryRunRecord {
  runId: string;
  ownerId: string;
  companionId: string;
  deliveredEpIds: string[];
  createdAt: string;
}

export class CognitiveEvidenceStore {
  // Primary stores indexed strictly by composite scope key: `${ownerId}:${companionId}`
  private evidenceByScope: Map<string, Map<string, EpistemicEvidence>> = new Map();
  private milestonesByScope: Map<string, Map<string, LifeMilestone>> = new Map();
  private edgesByScope: Map<string, AssociativeEdge[]> = new Map();
  private runs: Map<string, DeliveryRunRecord> = new Map();

  private getScopeKey(ownerId: string, companionId: string): string {
    if (!ownerId?.trim() || !companionId?.trim()) {
      throw new Error(`Security Violation: ownerId and companionId must be non-empty strings. Got: owner='${ownerId}', companion='${companionId}'`);
    }
    return `${ownerId.trim()}::${companionId.trim()}`;
  }

  // --- EVIDENCE CRUD ---

  public async insertEvidence(evidence: EpistemicEvidence): Promise<EpistemicEvidence> {
    const validated = EpistemicEvidenceSchema.parse(evidence);
    const scopeKey = this.getScopeKey(validated.ownerId, validated.companionId);

    if (!this.evidenceByScope.has(scopeKey)) {
      this.evidenceByScope.set(scopeKey, new Map());
    }

    const scopeMap = this.evidenceByScope.get(scopeKey)!;
    scopeMap.set(validated.id, validated);
    return validated;
  }

  public async getEvidence(
    ownerId: string,
    companionId: string,
    evidenceId: string
  ): Promise<EpistemicEvidence | undefined> {
    const scopeKey = this.getScopeKey(ownerId, companionId);
    const scopeMap = this.evidenceByScope.get(scopeKey);
    return scopeMap?.get(evidenceId);
  }

  public async listActiveEvidence(
    ownerId: string,
    companionId: string
  ): Promise<EpistemicEvidence[]> {
    const scopeKey = this.getScopeKey(ownerId, companionId);
    const scopeMap = this.evidenceByScope.get(scopeKey);
    if (!scopeMap) return [];
    return Array.from(scopeMap.values()).filter(ep => ep.status === 'active');
  }

  public async invalidateEvidence(
    ownerId: string,
    companionId: string,
    evidenceId: string,
    reason: string
  ): Promise<boolean> {
    const ep = await this.getEvidence(ownerId, companionId, evidenceId);
    if (!ep) return false;

    const updated: EpistemicEvidence = {
      ...ep,
      status: 'invalidated',
      updatedAt: new Date().toISOString(),
    };
    await this.insertEvidence(updated);
    return true;
  }

  public async correctEvidence(
    ownerId: string,
    companionId: string,
    targetEvidenceId: string,
    correctedText: string,
    newConfidence?: number
  ): Promise<EpistemicEvidence | undefined> {
    const oldEp = await this.getEvidence(ownerId, companionId, targetEvidenceId);
    if (!oldEp) return undefined;

    const nowIso = new Date().toISOString();

    // Mark old evidence superseded
    const supersededEp: EpistemicEvidence = {
      ...oldEp,
      status: 'superseded',
      updatedAt: nowIso,
    };
    await this.insertEvidence(supersededEp);

    // Insert new corrected evidence linking to old one
    const newId = `ep_corr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newEp: EpistemicEvidence = {
      ...oldEp,
      id: newId,
      text: correctedText,
      confidence: newConfidence !== undefined ? newConfidence : oldEp.confidence,
      supersedesId: oldEp.id,
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    return this.insertEvidence(newEp);
  }

  // --- MILESTONES CRUD ---

  public async addMilestone(milestone: LifeMilestone): Promise<LifeMilestone> {
    const validated = LifeMilestoneSchema.parse(milestone);
    const scopeKey = this.getScopeKey(validated.ownerId, validated.companionId);

    if (!this.milestonesByScope.has(scopeKey)) {
      this.milestonesByScope.set(scopeKey, new Map());
    }

    this.milestonesByScope.get(scopeKey)!.set(validated.id, validated);
    return validated;
  }

  public async listMilestones(ownerId: string, companionId: string): Promise<LifeMilestone[]> {
    const scopeKey = this.getScopeKey(ownerId, companionId);
    const map = this.milestonesByScope.get(scopeKey);
    if (!map) return [];
    return Array.from(map.values()).sort((a, b) => a.startYear - b.startYear);
  }

  public async getMilestoneForYear(
    ownerId: string,
    companionId: string,
    year: number
  ): Promise<LifeMilestone | undefined> {
    const milestones = await this.listMilestones(ownerId, companionId);
    return milestones.find(m => year >= m.startYear && year <= m.endYear);
  }

  // --- ASSOCIATIVE EDGES ---

  public async addEdge(
    ownerId: string,
    companionId: string,
    edge: AssociativeEdge
  ): Promise<AssociativeEdge> {
    const validated = AssociativeEdgeSchema.parse(edge);
    const scopeKey = this.getScopeKey(ownerId, companionId);

    if (!this.edgesByScope.has(scopeKey)) {
      this.edgesByScope.set(scopeKey, []);
    }

    const edges = this.edgesByScope.get(scopeKey)!;
    const existingIndex = edges.findIndex(
      e => e.sourceEpId === validated.sourceEpId &&
           e.targetEpId === validated.targetEpId &&
           e.relationType === validated.relationType
    );

    if (existingIndex >= 0) {
      edges[existingIndex] = validated;
    } else {
      edges.push(validated);
    }
    return validated;
  }

  public async getOutgoingEdges(
    ownerId: string,
    companionId: string,
    sourceEpId: string
  ): Promise<AssociativeEdge[]> {
    const scopeKey = this.getScopeKey(ownerId, companionId);
    const edges = this.edgesByScope.get(scopeKey) || [];
    return edges.filter(e => e.sourceEpId === sourceEpId).sort((a, b) => b.weight - a.weight);
  }

  public async getAllEdges(ownerId: string, companionId: string): Promise<AssociativeEdge[]> {
    const scopeKey = this.getScopeKey(ownerId, companionId);
    return this.edgesByScope.get(scopeKey) || [];
  }

  // --- RUN DELIVERY SLICES (No ID, No Claim Ledger) ---

  public recordDeliverySlice(
    runId: string,
    ownerId: string,
    companionId: string,
    deliveredEpIds: string[]
  ): void {
    this.runs.set(runId, {
      runId,
      ownerId,
      companionId,
      deliveredEpIds: [...deliveredEpIds],
      createdAt: new Date().toISOString(),
    });
  }

  public getDeliverySlice(runId: string): DeliveryRunRecord | undefined {
    return this.runs.get(runId);
  }

  // --- CLEAR / TEARDOWN (Useful for tests) ---
  public clear(): void {
    this.evidenceByScope.clear();
    this.milestonesByScope.clear();
    this.edgesByScope.clear();
    this.runs.clear();
  }
}

// Global default singleton instance
export const defaultEvidenceStore = new CognitiveEvidenceStore();
