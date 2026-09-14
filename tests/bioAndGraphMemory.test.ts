import "./setupEnv.js";

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getRelevantBioSnippets } from "../services/personaEngine.js";
import { mergeIntoGraph, queryGraphContext, clearGraphCache } from "../services/graphMemory.server.js";

const TEST_CHAT_ID = "test-chat-graph-999";
const GRAPHS_DIR = path.join(os.tmpdir(), "chat_graphs");
const GRAPH_FILE_PATH = path.join(GRAPHS_DIR, `${TEST_CHAT_ID}.json`);

async function setup() {
  clearGraphCache(TEST_CHAT_ID);
  if (fs.existsSync(GRAPH_FILE_PATH)) {
    try {
      await fs.promises.unlink(GRAPH_FILE_PATH);
    } catch (_) {}
  }
}

async function teardown() {
  clearGraphCache(TEST_CHAT_ID);
  if (fs.existsSync(GRAPH_FILE_PATH)) {
    try {
      await fs.promises.unlink(GRAPH_FILE_PATH);
    } catch (_) {}
  }
}

async function runTests() {
  console.log("🚀 Running Bio Sharding & Semantic Graph Memory tests...");

  await setup();

  try {
    // ==========================================
    // 1. USER BIO SHARDING TESTS (getRelevantBioSnippets)
    // ==========================================
    console.log("🧪 Testing User Bio Sharding & Sentence Overlap Matching...");

    const fullBio = `
أحمد مهندس برمجيات شاطر وعنده 28 سنة وبيحب يسافر جداً.
بيحب جداً ياكل كشري وملوخية وبامية باللحمة الضاني.
عنده قطة صغيرة اسمها لولو لونها أبيض في مشمش وبيحب يلعب معاها.
بيدرس دايماً كورسات جديدة عن الذكاء الاصطناعي وبيروح الجيم كل يوم جمعة.
    `.trim();

    // Test Case A: Empty inputs
    assert.equal(getRelevantBioSnippets("", "كشري"), "");
    assert.equal(getRelevantBioSnippets(fullBio, ""), "");
    assert.equal(getRelevantBioSnippets(undefined, "كشري"), "");

    // Test Case B: Matching "كشري"
    const matchedBio1 = getRelevantBioSnippets(fullBio, "نفسي أكل كشري بجد بكرا");
    assert.ok(matchedBio1.includes("بيحب جداً ياكل كشري"), "Should return the sentence containing 'كشري'");
    assert.ok(!matchedBio1.includes("قطة صغيرة اسمها لولو"), "Should NOT contain unrelated details");

    // Test Case C: Matching "قطة"
    const matchedBio2 = getRelevantBioSnippets(fullBio, "أنا اشتريت قطة جديدة وعايز اسميها");
    assert.ok(matchedBio2.includes("قطة صغيرة اسمها لولو"), "Should match 'قطة'");
    assert.ok(!matchedBio2.includes("مهندس برمجيات"), "Should NOT match unrelated software engineer detail");

    // Test Case D: No overlap
    const matchedBio3 = getRelevantBioSnippets(fullBio, "الجو حر أوي النهاردة وعايز أشرب عصير مانجا");
    assert.equal(matchedBio3, "", "Should return empty string if no words overlap");

    console.log("✔ User Bio Sharding tests passed!");

    // ==========================================
    // 2. SEMANTIC GRAPH MEMORY TESTS (mergeIntoGraph & queryGraphContext)
    // ==========================================
    console.log("🧪 Testing Semantic Graph Memory Merge and Context Querying...");

    const newNodes = [
      { label: "ممدوح", type: "Person", description: "اليوزر اللميح صاحب رفيق المخلص وهو رائد أعمال مصري ذكي." },
      { label: "الكشري", type: "Preference", description: "أكلة ممدوح المفضلة على الإطلاق ومبيزهقش منها." },
      { label: "بريبايلوت", type: "Concept", description: "مشروع ممدوح الريادي وهو وكالة ذكاء اصطناعي إبداعية ثورية." }
    ];

    const newEdges = [
      { source: "ممدوح", target: "الكشري", relation: "بيحب جداً", weight: 0.95 },
      { source: "ممدوح", target: "بريبايلوت", relation: "مؤسس المشروع ومتحمس ليه جداً", weight: 0.9 }
    ];

    // Merge into graph store
    await mergeIntoGraph(TEST_CHAT_ID, newNodes, newEdges);

    // Verify Graph file exists
    assert.ok(fs.existsSync(GRAPH_FILE_PATH), "Graph JSON file should be created");

    // Verify queryGraphContext matches entities and adjacency list relations
    const queryContext1 = await queryGraphContext(TEST_CHAT_ID, "أنا نفسي أكل كشري بجد");
    assert.ok(queryContext1, "Query context must be defined");
    assert.ok(queryContext1.includes("الكشري"), "Should retrieve details about الكشري");
    assert.ok(queryContext1.includes("ممدوح"), "Should retrieve connected node ممدوح via relationship edge");
    assert.ok(queryContext1.includes("بيحب جداً"), "Should retrieve the connection relation between ممدوح and الكشري");

    const queryContext2 = await queryGraphContext(TEST_CHAT_ID, "كلمني كدا عن مشروع بريبايلوت");
    assert.ok(queryContext2, "Query context must be defined");
    assert.ok(queryContext2.includes("بريبايلوت"), "Should retrieve details about بريبايلوت");
    assert.ok(queryContext2.includes("مؤسس المشروع ومتحمس ليه جداً"), "Should retrieve the foundational relationship");

    // Verify queryGraphContext returns undefined on no matches
    const queryContext3 = await queryGraphContext(TEST_CHAT_ID, "عايز أسافر بكرا الغردقة");
    assert.equal(queryContext3, undefined, "Should return undefined if no nodes match the user message");

    console.log("✔ Semantic Graph Memory tests passed!");

  } finally {
    await teardown();
  }

  console.log("🎉 All Bio Sharding and Graph Memory tests passed successfully!");
}

runTests().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
