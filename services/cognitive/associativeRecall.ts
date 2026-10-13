import { EpistemicEvidence } from './types.js';
import { CognitiveEvidenceStore, defaultEvidenceStore } from './evidenceStore.js';

export interface ActivatedNode {
  evidence: EpistemicEvidence;
  activationScore: number;
}

export interface GraphCommunity {
  id: string;
  name: string;
  memberCount: number;
  memberIds: string[];
}

export interface CognitiveGraphSummary {
  companionId: string;
  nodesCount: number;
  edgesCount: number;
  hubNodeIds: string[];
  communities: GraphCommunity[];
}

export class AssociativeRecallEngine {
  constructor(private store: CognitiveEvidenceStore = defaultEvidenceStore) {}

  /**
   * Performs Hebbian Spreading Activation across synaptic associative links.
   * Traverses in < 5ms with bounded depth and threshold pruning.
   */
  public async spreadingActivation(
    ownerId: string,
    companionId: string,
    seedEpIds: string[],
    maxDepth: number = 2,
    decayFactor: number = 0.65,
    threshold: number = 0.30,
    topK: number = 5
  ): Promise<ActivatedNode[]> {
    if (!seedEpIds.length) return [];

    const activations: Map<string, number> = new Map();
    for (const id of seedEpIds) {
      activations.set(id, 1.0);
    }

    const visitedEdges = new Set<string>();
    let currentLayer = [...seedEpIds];

    for (let depth = 0; depth < maxDepth; depth++) {
      const nextLayer: Set<string> = new Set();

      for (const sourceId of currentLayer) {
        const sourceAct = activations.get(sourceId) || 0;
        if (sourceAct < threshold) continue;

        const edges = await this.store.getOutgoingEdges(ownerId, companionId, sourceId);

        for (const edge of edges) {
          const edgeKey = `${edge.sourceEpId}->${edge.targetEpId}:${edge.relationType}`;
          if (visitedEdges.has(edgeKey)) continue;
          visitedEdges.add(edgeKey);

          // Apply contradiction/supersession attenuation
          let weightMultiplier = edge.weight;
          if (edge.relationType === 'CONTRADICTS_SUPERSEDES') {
            weightMultiplier = 0.1; // heavily dampen superseded associations
          }

          const transferred = sourceAct * weightMultiplier * decayFactor;
          const currentTargetAct = activations.get(edge.targetEpId) || 0;
          const newTargetAct = currentTargetAct + transferred;
          activations.set(edge.targetEpId, newTargetAct);

          if (newTargetAct >= threshold) {
            nextLayer.add(edge.targetEpId);
          }
        }
      }

      currentLayer = Array.from(nextLayer);
      if (currentLayer.length === 0) break;
    }

    // Sort by activation score descending
    const sorted = Array.from(activations.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK);

    const results: ActivatedNode[] = [];
    for (const [epId, score] of sorted) {
      const ep = await this.store.getEvidence(ownerId, companionId, epId);
      if (ep && ep.status === 'active') {
        results.push({
          evidence: ep,
          activationScore: Math.round(score * 1000) / 1000,
        });
      }
    }

    return results;
  }

  /**
   * Computes graph summary with dynamic hub nodes and communities for any companion.
   */
  public async getGraphSummary(
    ownerId: string,
    companionId: string
  ): Promise<CognitiveGraphSummary> {
    const allEvidence = await this.store.listActiveEvidence(ownerId, companionId);
    const allEdges = await this.store.getAllEdges(ownerId, companionId);

    // Degree centrality
    const degreeMap: Map<string, number> = new Map();
    for (const edge of allEdges) {
      degreeMap.set(edge.sourceEpId, (degreeMap.get(edge.sourceEpId) || 0) + 1);
      degreeMap.set(edge.targetEpId, (degreeMap.get(edge.targetEpId) || 0) + 1);
    }

    const sortedByDegree = Array.from(degreeMap.entries()).sort((a, b) => b[1] - a[1]);
    const hubNodeIds = sortedByDegree.slice(0, 5).map(([id]) => id);

    // Community grouping
    const communityMap: Map<string, string[]> = new Map();
    for (const ep of allEvidence) {
      const grp = ep.group || 'core_identity';
      if (!communityMap.has(grp)) {
        communityMap.set(grp, []);
      }
      communityMap.get(grp)!.push(ep.id);
    }

    const communities: GraphCommunity[] = Array.from(communityMap.entries()).map(([id, members]) => ({
      id,
      name: id.replace(/_/g, ' ').toUpperCase(),
      memberCount: members.length,
      memberIds: members,
    }));

    return {
      companionId,
      nodesCount: allEvidence.length,
      edgesCount: allEdges.length,
      hubNodeIds,
      communities,
    };
  }
}

export const defaultAssociativeRecall = new AssociativeRecallEngine();
