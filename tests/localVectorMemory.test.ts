import './setupEnv.js';
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import {
  cosineSimilarity,
  indexLocalVectorMemory,
  retrieveLocalVectorMemory,
  loadLocalStore,
} from "../services/redisVectorMemory.server.js";

Object.defineProperty(GoogleGenAI.prototype, "models", {
  get() {
    return {
      embedContent: async (params: any) => {
        const text = params.contents || "";
        const dim = params.config?.outputDimensionality || 768;
        const values = new Array(dim).fill(0);

        for (let i = 0; i < Math.min(text.length, dim); i++) {
          values[i] = text.charCodeAt(i) / 255;
        }

        let norm = 0;
        for (const value of values) norm += value * value;
        if (norm > 0) {
          const standardDeviation = Math.sqrt(norm);
          for (let i = 0; i < dim; i++) values[i] /= standardDeviation;
        }

        return { embeddings: [{ values }] };
      },
    };
  },
  set() {},
  configurable: true,
});

const TEST_CHAT_ID = "test-chat-local-vector-memory-999";
const LOCAL_STORE_PATH = path.join(process.cwd(), "tmp", "local_vector_memory.json");
let originalStoreBackup: string | null = null;

async function setup() {
  if (fs.existsSync(LOCAL_STORE_PATH)) {
    originalStoreBackup = await fs.promises.readFile(LOCAL_STORE_PATH, "utf8");
    await fs.promises.unlink(LOCAL_STORE_PATH);
  }
  const store = await loadLocalStore();
  delete store[TEST_CHAT_ID];
}

async function teardown() {
  if (fs.existsSync(LOCAL_STORE_PATH)) {
    await fs.promises.unlink(LOCAL_STORE_PATH);
  }
  if (originalStoreBackup !== null) {
    await fs.promises.writeFile(LOCAL_STORE_PATH, originalStoreBackup, "utf8");
  }
}

async function runTests() {
  console.log("Running Local Vector Memory tests...");
  await setup();

  try {
    const vecA = [1, 0, 0];
    const vecB = [1, 0, 0];
    const vecC = [0, 1, 0];
    const vecD = [-1, 0, 0];

    assert.equal(Math.round(cosineSimilarity(vecA, vecB) * 100) / 100, 1);
    assert.equal(Math.round(cosineSimilarity(vecA, vecC) * 100) / 100, 0);
    assert.equal(Math.round(cosineSimilarity(vecA, vecD) * 100) / 100, -1);

    const records = [
      { role: "user" as const, text: "اسمي أحمد وعندي ٢٥ سنة وبحب الرسم" },
      { role: "model" as const, text: "أنا رفيق، صديقك الاصطناعي وبحب أساعدك" },
      { role: "user" as const, text: "أكلتي المفضلة هي الكشري والمحشي والمروخية" },
    ];

    await indexLocalVectorMemory(TEST_CHAT_ID, records);
    assert.equal(fs.existsSync(LOCAL_STORE_PATH), true);

    const store = await loadLocalStore();
    assert.equal(TEST_CHAT_ID in store, true);
    assert.equal(store[TEST_CHAT_ID].length, 3);
    const identityRecord = store[TEST_CHAT_ID].find(record => record.text === "اسمي أحمد وعندي ٢٥ سنة وبحب الرسم");
    const preferenceRecord = store[TEST_CHAT_ID].find(record => record.text === "أكلتي المفضلة هي الكشري والمحشي والمروخية");
    assert.equal(identityRecord?.category, "identity");
    assert.equal(preferenceRecord?.category, "preference");

    await indexLocalVectorMemory(TEST_CHAT_ID, [
      { role: "user" as const, text: "اسمي أحمد وعندي ٢٥ سنة وبحب الرسم" },
    ]);
    const storeAfterDuplicate = await loadLocalStore();
    assert.equal(storeAfterDuplicate[TEST_CHAT_ID].length, 3);

    const responseAhmed = await retrieveLocalVectorMemory(TEST_CHAT_ID, "أنت مين واسمك إيه؟ أحمد وسنك كام؟");
    assert.equal(responseAhmed.hasStrongMatch, true);
    assert.equal(responseAhmed.externalContext?.includes("أحمد وعندي ٢٥ سنة"), true);

    const responseFood = await retrieveLocalVectorMemory(TEST_CHAT_ID, "إيه هي الأكلات والوجبات اللي بتحبها؟ كشري");
    assert.equal(responseFood.hasStrongMatch, true);
    assert.equal(responseFood.externalContext?.includes("الكشري والمحشي"), true);

    const responseEmpty = await retrieveLocalVectorMemory("non-existent-chat-12345", "أي كلام خالص");
    assert.equal(responseEmpty.hasStrongMatch, false);
    assert.equal(responseEmpty.externalContext, undefined);
  } finally {
    await teardown();
  }

  console.log("All Local Vector Memory tests completed successfully.");
}

runTests().catch(error => {
  console.error("Local vector memory test failed:", error);
  process.exit(1);
});
