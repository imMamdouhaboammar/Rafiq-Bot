import fs from "node:fs";
import path from "node:path";

export interface GraphNode {
  id: string;
  label: string;      // Name/title in Arabic or English (e.g. "ممدوح", "الكشري")
  type: string;       // e.g. "Person", "Preference", "Concept", "Event", "Location"
  description: string; // Brief description of who/what this is in Egyptian Arabic
}

export interface GraphEdge {
  source: string;     // Normalized source node ID
  target: string;     // Normalized target node ID
  relation: string;   // Description of relation (e.g. "بيحب جداً", "صاحب طفولة")
  weight: number;     // Weight/strength from 0.1 to 1.0
  lastUpdated: string;
}

export interface GraphData {
  nodes: Record<string, GraphNode>; // Node ID -> GraphNode for O(1) lookup
  edges: GraphEdge[];
}

import os from "os";

const GRAPHS_DIR = path.join(os.tmpdir(), "chat_graphs");

// Ensure folder exists
const ensureGraphsDir = () => {
  try {
    if (!fs.existsSync(GRAPHS_DIR)) {
      fs.mkdirSync(GRAPHS_DIR, { recursive: true });
    }
  } catch (err) {
    // Ignore read-only fallback in constrained environments
  }
};

// In-memory graph cache to guarantee microsecond lookup speeds
const graphCaches = new Map<string, GraphData>();

// Promise write chains per chatId to ensure absolute concurrency safety
const graphWriteChains = new Map<string, Promise<void>>();

/**
 * Normalizes text to a clean node ID format (lowercase, alphanumeric, joined with underscores)
 */
export const normalizeNodeId = (text: string): string => {
  if (!text) return "";
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_]+/gu, "_")
    .replace(/^_+|_+$/g, "");
};

/**
 * Loads the Graph Memory JSON for a specific chatId.
 */
export const loadGraph = async (chatId: string): Promise<GraphData> => {
  if (graphCaches.has(chatId)) {
    return graphCaches.get(chatId)!;
  }

  ensureGraphsDir();
  const filePath = path.join(GRAPHS_DIR, `${chatId}.json`);
  let graph: GraphData = { nodes: {}, edges: [] };

  try {
    if (fs.existsSync(filePath)) {
      const content = await fs.promises.readFile(filePath, "utf8");
      graph = JSON.parse(content);
    }
  } catch (err) {
    console.warn(`[GraphMemory] Failed to load graph file for chat ${chatId}:`, err);
  }

  graphCaches.set(chatId, graph);
  return graph;
};

/**
 * Saves the Graph Memory JSON for a specific chatId.
 */
export const saveGraph = async (chatId: string, graph: GraphData): Promise<void> => {
  graphCaches.set(chatId, graph);
  ensureGraphsDir();
  const filePath = path.join(GRAPHS_DIR, `${chatId}.json`);

  let chain = graphWriteChains.get(chatId) || Promise.resolve();
  const nextWrite = chain.then(async () => {
    try {
      await fs.promises.writeFile(filePath, JSON.stringify(graph, null, 2), "utf8");
    } catch (err) {
      console.warn(`[GraphMemory] Failed to save graph file for chat ${chatId}:`, err);
    }
  });

  graphWriteChains.set(chatId, nextWrite);
  return nextWrite;
};

/**
 * Merges extracted nodes and edges into a chat's graph store.
 * If nodes/edges exist, they are enriched or strengthened.
 */
export const mergeIntoGraph = async (
  chatId: string,
  newNodes: { label: string; type: string; description: string }[],
  newEdges: { source: string; target: string; relation: string; weight?: number }[]
): Promise<void> => {
  const graph = await loadGraph(chatId);

  // 1. Merge Nodes
  for (const node of newNodes) {
    const id = normalizeNodeId(node.label);
    if (!id) continue;

    const existing = graph.nodes[id];
    if (existing) {
      // Update description only if the new description is richer or longer
      if (node.description && node.description.length > (existing.description?.length || 0)) {
        existing.description = node.description;
      }
      if (node.type) {
        existing.type = node.type;
      }
    } else {
      graph.nodes[id] = {
        id,
        label: node.label,
        type: node.type || "General",
        description: node.description || "",
      };
    }
  }

  // 2. Merge Edges
  for (const edge of newEdges) {
    const sourceId = normalizeNodeId(edge.source);
    const targetId = normalizeNodeId(edge.target);
    if (!sourceId || !targetId || sourceId === targetId) continue;

    // Create default nodes if they don't exist yet
    if (!graph.nodes[sourceId]) {
      graph.nodes[sourceId] = {
        id: sourceId,
        label: edge.source,
        type: "General",
        description: "كيان تم اكتشافه من خلال سياق العلاقات.",
      };
    }
    if (!graph.nodes[targetId]) {
      graph.nodes[targetId] = {
        id: targetId,
        label: edge.target,
        type: "General",
        description: "كيان تم اكتشافه من خلال سياق العلاقات.",
      };
    }

    // Check if duplicate relationship exists (ignoring order for bi-directional warmth)
    const existingEdge = graph.edges.find(e => {
      const eSrc = normalizeNodeId(e.source);
      const eTgt = normalizeNodeId(e.target);
      return (
        (eSrc === sourceId && eTgt === targetId && e.relation === edge.relation) ||
        (eSrc === targetId && eTgt === sourceId && e.relation === edge.relation)
      );
    });

    if (existingEdge) {
      // Strengthen edge weight
      existingEdge.weight = Math.min(1.0, existingEdge.weight + 0.15);
      existingEdge.lastUpdated = new Date().toISOString();
    } else {
      graph.edges.push({
        source: sourceId,
        target: targetId,
        relation: edge.relation,
        weight: edge.weight ?? 0.5,
        lastUpdated: new Date().toISOString(),
      });
    }
  }

  await saveGraph(chatId, graph);
};

/**
 * Strips Arabic definite article prefixes (e.g. الـ) and trims/lowercases to improve matching accuracy.
 */
const cleanArabicWord = (word: string): string => {
  let cleaned = word.trim().toLowerCase();
  if (cleaned.startsWith("ال") && cleaned.length > 3) {
    cleaned = cleaned.slice(2);
  }
  return cleaned;
};

/**
 * Searches the local JSON graph memory for entities mentioned in the user message.
 * Returns a highly-tailored Arabic relationship description context block in milliseconds.
 */
export const queryGraphContext = async (chatId: string, userMessage: string): Promise<string | undefined> => {
  if (!userMessage || !userMessage.trim()) return undefined;

  const graph = await loadGraph(chatId);
  const matchedNodeIds = new Set<string>();

  const normalizedMsg = userMessage.toLowerCase();
  const msgWords = normalizedMsg.split(/\s+/).map(cleanArabicWord).filter(w => w.length >= 2);

  // 1. Scan for exact or substring matches of node labels inside user message
  for (const [id, node] of Object.entries(graph.nodes)) {
    const labelLower = node.label.toLowerCase();
    const labelWords = labelLower.split(/\s+/).map(cleanArabicWord).filter(w => w.length >= 2);
    
    // Check if any cleaned word from the label matches a cleaned word in the message
    const hasLabelWordMatch = labelWords.some(lw => msgWords.some(mw => mw.includes(lw) || lw.includes(mw)));

    if (
      normalizedMsg.includes(labelLower) || 
      normalizedMsg.includes(id) || 
      hasLabelWordMatch ||
      (labelLower.length >= 3 && id.split("_").some(part => part.length >= 3 && normalizedMsg.includes(part)))
    ) {
      matchedNodeIds.add(id);
    }
  }

  if (matchedNodeIds.size === 0) return undefined;

  // 2. Fetch descriptions of matched nodes
  const nodeContextLines: string[] = [];
  const processedEdges = new Set<string>();

  for (const id of matchedNodeIds) {
    const node = graph.nodes[id];
    nodeContextLines.push(`- الكيان [${node.label}] (${node.type}): ${node.description}`);

    // 3. Fetch immediate relationships (1-degree adjacency)
    const adjacentEdges = graph.edges.filter(
      e => normalizeNodeId(e.source) === id || normalizeNodeId(e.target) === id
    );

    for (const edge of adjacentEdges) {
      const edgeKey = `${normalizeNodeId(edge.source)}-${normalizeNodeId(edge.target)}-${edge.relation}`;
      if (processedEdges.has(edgeKey)) continue;
      processedEdges.add(edgeKey);

      const srcNode = graph.nodes[normalizeNodeId(edge.source)] || { label: edge.source };
      const tgtNode = graph.nodes[normalizeNodeId(edge.target)] || { label: edge.target };

      nodeContextLines.push(`  * علاقة: [${srcNode.label}] و [${tgtNode.label}] بينهما علاقة (${edge.relation}) بمستوى قوة ${edge.weight.toFixed(2)}`);
    }
  }

  if (nodeContextLines.length === 0) return undefined;

  return `سياق العلاقات والروابط الرسومية المسترجعة من الذاكرة (Graph Memory Context):\n${nodeContextLines.join("\n")}`;
};

/**
 * Clears the in-memory cache for a chatId (useful in unit testing)
 */
export const clearGraphCache = (chatId: string) => {
  graphCaches.delete(chatId);
};
