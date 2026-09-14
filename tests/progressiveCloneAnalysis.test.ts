import assert from "node:assert/strict";
import { CloneProfileSchema } from "../types.js";
import {
  MAX_PROGRESSIVE_BATCH_BYTES,
  PROGRESSIVE_CLONE_MODEL,
  ProgressiveCloneAnalysisError,
  createProgressiveCloneBatchAnalyzer,
  createProgressiveCloneBatchRouteAnalyzer,
  type ProgressiveCloneModelClient,
} from "../services/progressiveCloneAnalysis.server.js";

const emptyBioSections = () => ({
  identity: [],
  personality: [],
  interests: [],
  relationships: [],
  boundaries: [],
  aspirations: [],
});

const firstModelResult = {
  richBioSections: {
    ...emptyBioSections(),
    identity: [{
      text: "I make meetup plans explicitly and name the place.",
      evidence: "I will meet you at Cairo Cafe on Friday",
    }],
    personality: [{
      text: "I prefer concise practical plans.",
      evidence: "I prefer short plans",
    }],
  },
  timeline: [{
    title: "Friday meetup",
    details: "I planned a meetup at Cairo Cafe.",
    when: "Friday",
    location: "Cairo Cafe",
    evidence: ["I will meet you at Cairo Cafe on Friday"],
  }],
  speechStyle: {
    tone: [{ text: "I sound warm and direct", evidence: "ya salaam 😂" }],
    signaturePhrases: [{ text: "ya salaam", evidence: "ya salaam 😂" }],
    responsePatterns: [{ text: "I answer plans with a concrete place and time", evidence: "I will meet you at Cairo Cafe on Friday" }],
    emojiPatterns: [{ text: "I use 😂 after enthusiastic phrasing", evidence: "ya salaam 😂" }],
  },
  memorySeeds: [{
    text: "Target prefers short practical plans.",
    category: "preference",
    subject: "persona",
    salience: 80,
    evidence: "I prefer short plans",
  }],
};

const secondModelResult = {
  richBioSections: {
    ...emptyBioSections(),
    personality: [
      { text: "I prefer concise practical plans.", evidence: "I prefer short plans" },
      { text: "I keep regular contact with my family.", evidence: "I call my sister every Sunday" },
    ],
    relationships: [{
      text: "I maintain a weekly call with my sister.",
      evidence: "I call my sister every Sunday",
    }],
  },
  timeline: [{
    title: "Weekly family call",
    details: "I call my sister every Sunday.",
    when: "every Sunday",
    location: null,
    evidence: ["I call my sister every Sunday"],
  }],
  speechStyle: {
    tone: [{ text: "I sound warm and direct", evidence: "I prefer short plans" }],
    signaturePhrases: [],
    responsePatterns: [{ text: "I state recurring routines plainly", evidence: "I call my sister every Sunday" }],
    emojiPatterns: [],
  },
  memorySeeds: [{
    text: "Target calls their sister every Sunday.",
    category: "memory",
    subject: "persona",
    salience: 0.9,
    evidence: "I call my sister every Sunday",
  }],
};

const shortSignaturePhraseResult = {
  ...firstModelResult,
  speechStyle: {
    ...firstModelResult.speechStyle,
    signaturePhrases: [{ text: "آه", evidence: "آه" }],
  },
};

const responses = [firstModelResult, secondModelResult];
const requests: unknown[] = [];
const mockClient: ProgressiveCloneModelClient = {
  models: {
    async generateContent(request: unknown) {
      requests.push(request);
      const next = responses.shift();
      if (!next) throw new Error("unexpected model call");
      return { text: JSON.stringify(next) };
    },
  },
};

const analyze = createProgressiveCloneBatchAnalyzer(mockClient);
const longAuthenticMessage = `I remember the full story:${" meaningful detail".repeat(70)}`;
const firstBatch = [
  "01/02/2024, 10:00 AM - Other: Where should we meet?",
  "01/02/2024, 10:01 AM - Target: I will meet you at Cairo Cafe on Friday",
  "01/02/2024, 10:02 AM - Other: Sounds good",
  "01/02/2024, 10:03 AM - Target: ya salaam 😂",
  "01/02/2024, 10:04 AM - Target: I prefer short plans",
  `01/02/2024, 10:05 AM - Target: ${longAuthenticMessage}`,
  "01/02/2024, 10:06 AM - Target: api_key=sk-super-secret-value",
].join("\n");

const firstSnapshot = await analyze({
  batchText: firstBatch,
  targetName: "Target",
  batchIndex: 0,
  totalBatches: 2,
});

assert.equal((requests[0] as { model: string }).model, PROGRESSIVE_CLONE_MODEL);
assert.match(firstSnapshot.richBio, /## My identity/);
assert.match(firstSnapshot.richBio, /## My personality/);
assert.equal(firstSnapshot.timeline[0].location, "Cairo Cafe");
assert.equal(firstSnapshot.timeline[0].when, "Friday");
assert.deepEqual(firstSnapshot.processedBatches, [0]);
assert.equal(firstSnapshot.analysis.status, "partial");
assert.equal(firstSnapshot.analysis.processedBatches, 1);
assert.equal(firstSnapshot.memorySeeds[0].salience, 0.8, "0-100 model salience must normalize before snapshot validation");
assert.ok(firstSnapshot.replyExamples.length > 0, "first batch should immediately yield reply evidence");
assert.ok(firstSnapshot.confidence.overall > 0, "first batch should immediately yield useful confidence");
assert.deepEqual(
  firstSnapshot.chatSnippets.map((snippet) => snippet.text),
  [
    "I will meet you at Cairo Cafe on Friday",
    "ya salaam 😂",
    "I prefer short plans",
    longAuthenticMessage,
  ],
  "chat snippets must come exactly from safe target-authored messages",
);
assert.doesNotMatch(JSON.stringify(firstSnapshot), /super-secret-value/);
assert.doesNotMatch(JSON.stringify(requests[0]), /super-secret-value/);
assert.ok(longAuthenticMessage.length > 500 && longAuthenticMessage.length < 2_000);
assert.doesNotMatch(JSON.stringify(requests[0]), /I remember the full story/,
  "long authentic snippets must not expand the model evidence payload");

const secondBatch = [
  "08/02/2024, 09:00 AM - Other: Do you like long plans?",
  "08/02/2024, 09:01 AM - Target: I prefer short plans",
  "08/02/2024, 09:02 AM - Other: What is your Sunday routine?",
  "08/02/2024, 09:03 AM - Target: I call my sister every Sunday",
].join("\n");

const finalSnapshot = await analyze({
  batchText: secondBatch,
  targetName: "Target",
  batchIndex: 1,
  totalBatches: 2,
  previousSnapshot: firstSnapshot,
});

assert.deepEqual(finalSnapshot.processedBatches, [0, 1]);
assert.equal(finalSnapshot.analysis.status, "ready");
assert.equal(finalSnapshot.analysis.processedBatches, 2);
assert.equal(
  finalSnapshot.richBioSections.personality.filter(
    (claim) => claim.text === "I prefer concise practical plans.",
  ).length,
  1,
  "cumulative merge must deterministically dedupe repeated claims",
);
assert.match(finalSnapshot.richBio, /I keep regular contact with my family/);
assert.equal(finalSnapshot.timeline.length, 2);
assert.equal(finalSnapshot.memorySeeds.length, 2);
assert.equal(finalSnapshot.speechStyle.toneSummary, "I sound warm and direct");
assert.equal(finalSnapshot.overallConfidence, finalSnapshot.confidence.overall);

const routeResult = await createProgressiveCloneBatchRouteAnalyzer({
  models: {
    async generateContent() {
      return { text: JSON.stringify(firstModelResult) };
    },
  },
})({
  jobId: "clone-job-1",
  targetName: "Target",
  batchIndex: 0,
  totalBatches: 1,
  text: firstBatch,
});
assert.equal(routeResult.settingsPatch.botName, "Target");
assert.equal(routeResult.settingsPatch.cloneProfile?.analysis?.jobId, "clone-job-1");
assert.equal(routeResult.memorySeeds[0].subject, "persona");
assert.deepEqual(routeResult.settingsPatch.cloneProfile?.memorySeeds, routeResult.memorySeeds);
assert.match(routeResult.settingsPatch.impersonationProfile || "", /My signature phrases:/);
assert.equal(routeResult.serverSnapshot.analysis.jobId, "clone-job-1");
const validatedCloneProfile = CloneProfileSchema.parse(routeResult.settingsPatch.cloneProfile);
assert.equal(
  validatedCloneProfile.chatSnippets?.find((snippet) => snippet.text === longAuthenticMessage)?.text,
  longAuthenticMessage,
  "shared clone profile validation must retain complete authentic snippets over 500 characters",
);
assert.deepEqual(validatedCloneProfile.memorySeeds, routeResult.memorySeeds);

const arabicRequests: unknown[] = [];
const arabicModelResult = {
  richBioSections: {
    ...emptyBioSections(),
    identity: [{
      text: "أنا بحب الكلام المختصر والواضح.",
      evidence: "أنا بحب الكلام المختصر",
    }],
  },
  timeline: [],
  speechStyle: {
    tone: [{
      text: "أنا أسلوبي مباشر وخفيف.",
      evidence: "أنا برد بسرعة وبقول يا صاحبي 😂",
    }],
    signaturePhrases: [{
      text: "يا صاحبي",
      evidence: "أنا برد بسرعة وبقول يا صاحبي 😂",
    }],
    responsePatterns: [{
      text: "أنا برد بسرعة ومن غير لف.",
      evidence: "أنا برد بسرعة وبقول يا صاحبي 😂",
    }],
    emojiPatterns: [{
      text: "أنا بستخدم 😂 مع الهزار.",
      evidence: "أنا برد بسرعة وبقول يا صاحبي 😂",
    }],
  },
  memorySeeds: [{
    text: "أنا بحب الكلام المختصر.",
    category: "preference",
    subject: "persona",
    salience: 0.8,
    evidence: "أنا بحب الكلام المختصر",
  }],
};
const arabicBatch = [
  "01/03/2024, 10:00 AM - Other: عامل إيه؟",
  "01/03/2024, 10:01 AM - Target: أنا بحب الكلام المختصر",
  "01/03/2024, 10:02 AM - Other: بترد إزاي؟",
  "01/03/2024, 10:03 AM - Target: أنا برد بسرعة وبقول يا صاحبي 😂",
].join("\n");
const analyzeArabicRoute = createProgressiveCloneBatchRouteAnalyzer({
  models: {
    async generateContent(request: unknown) {
      arabicRequests.push(request);
      return { text: JSON.stringify(arabicModelResult) };
    },
  },
});
const arabicRouteResult = await analyzeArabicRoute({
  jobId: "arabic-clone-job",
  targetName: "Target",
  batchIndex: 0,
  totalBatches: 1,
  text: arabicBatch,
});
assert.match(arabicRouteResult.serverSnapshot.richBio, /## هويتي/);
assert.doesNotMatch(arabicRouteResult.serverSnapshot.richBio, /## My identity/);
assert.match(arabicRouteResult.settingsPatch.impersonationProfile || "", /عباراتي المميزة:/);
assert.match(arabicRouteResult.settingsPatch.impersonationProfile || "", /طريقتي في الرد:/);
assert.match(JSON.stringify(arabicRequests[0]), /first-person Arabic/);
assert.equal(
  arabicRouteResult.serverSnapshot.richBioSections.identity[0].evidence,
  "أنا بحب الكلام المختصر",
  "localized analysis must preserve exact evidence verbatim",
);

const francoRequests: unknown[] = [];
const francoBatch = [
  "01/03/2024, 11:00 AM - Other: enta بتحب ايه؟",
  "01/03/2024, 11:01 AM - Target: ana ba7eb el kalam el mokhtasar",
  "01/03/2024, 11:02 AM - Other: btrod ezay?",
  "01/03/2024, 11:03 AM - Target: ana barod saree3 w ba2ol ya sa7by 😂",
].join("\n");
const francoModelResult = {
  richBioSections: {
    ...emptyBioSections(),
    identity: [{
      text: "Ana ba7eb el kalam el mokhtasar.",
      evidence: "ana ba7eb el kalam el mokhtasar",
    }],
  },
  timeline: [],
  speechStyle: {
    tone: [{ text: "Ana oslooby saree3 w mobasher.", evidence: "ana barod saree3 w ba2ol ya sa7by 😂" }],
    signaturePhrases: [{ text: "ya sa7by", evidence: "ana barod saree3 w ba2ol ya sa7by 😂" }],
    responsePatterns: [{ text: "Ana barod saree3.", evidence: "ana barod saree3 w ba2ol ya sa7by 😂" }],
    emojiPatterns: [{ text: "Ana bastakhdem 😂 fel hezar.", evidence: "ana barod saree3 w ba2ol ya sa7by 😂" }],
  },
  memorySeeds: [{
    text: "Ana ba7eb el kalam el mokhtasar.",
    category: "preference",
    subject: "persona",
    salience: 0.8,
    evidence: "ana ba7eb el kalam el mokhtasar",
  }],
};
const francoRouteResult = await createProgressiveCloneBatchRouteAnalyzer({
  models: {
    async generateContent(request: unknown) {
      francoRequests.push(request);
      return { text: JSON.stringify(francoModelResult) };
    },
  },
})({
  jobId: "franco-clone-job",
  targetName: "Target",
  batchIndex: 0,
  totalBatches: 1,
  text: francoBatch,
});
assert.match(francoRouteResult.serverSnapshot.richBio, /## Haweyty/);
assert.match(francoRouteResult.settingsPatch.impersonationProfile || "", /Kalematy el momayaza:/);
assert.match(JSON.stringify(francoRequests[0]), /first-person Franco-Arab/);

const thirdPersonClient: ProgressiveCloneModelClient = {
  models: {
    async generateContent() {
      return {
        text: JSON.stringify({
          ...firstModelResult,
          richBioSections: {
            ...firstModelResult.richBioSections,
            personality: [{
              text: "Target prefers concise practical plans.",
              evidence: "I prefer short plans",
            }],
          },
        }),
      };
    },
  },
};
await assert.rejects(
  () => createProgressiveCloneBatchAnalyzer(thirdPersonClient)({
    batchText: firstBatch,
    targetName: "Target",
    batchIndex: 0,
    totalBatches: 1,
  }),
  (error: unknown) => {
    assert.ok(error instanceof ProgressiveCloneAnalysisError);
    assert.equal(error.stage, "validation");
    assert.match(error.message, /first-person english/);
    return true;
  },
  "supported analytical prose must stay in the target's first-person voice",
);

const callsBeforeReplay = requests.length;
const replayedSnapshot = await analyze({
  batchText: secondBatch,
  targetName: "Target",
  batchIndex: 1,
  totalBatches: 2,
  previousSnapshot: finalSnapshot,
});
assert.deepEqual(replayedSnapshot, finalSnapshot, "replaying a processed batch must be idempotent");
assert.equal(requests.length, callsBeforeReplay, "idempotent replay must not call Gemini again");

const inventedEvidenceClient: ProgressiveCloneModelClient = {
  models: {
    async generateContent() {
      return {
        text: JSON.stringify({
          ...firstModelResult,
          richBioSections: {
            ...emptyBioSections(),
            identity: [{ text: "Invented biography", evidence: "I grew up in Alexandria" }],
          },
          speechStyle: {
            ...firstModelResult.speechStyle,
            signaturePhrases: [{ text: "ya salaam / ya salaam", evidence: "ya salaam 😂" }],
          },
        }),
      };
    },
  },
};

const filteredEvidenceSnapshot = await createProgressiveCloneBatchAnalyzer(inventedEvidenceClient)({
    batchText: firstBatch,
    targetName: "Target",
    batchIndex: 0,
    totalBatches: 1,
});
assert.doesNotMatch(filteredEvidenceSnapshot.richBio, /Invented biography/);
assert.deepEqual(filteredEvidenceSnapshot.speechStyle.signaturePhrases, []);
assert.ok(filteredEvidenceSnapshot.chatSnippets.length > 0);

const shortSignatureSnapshot = await createProgressiveCloneBatchAnalyzer({
  models: { async generateContent() { return { text: JSON.stringify(shortSignaturePhraseResult) }; } },
})({
  batchText: firstBatch,
  targetName: "Target",
  batchIndex: 0,
  totalBatches: 1,
});
assert.deepEqual(shortSignatureSnapshot.speechStyle.signaturePhrases, [],
  "a short unsupported signature must be discarded without aborting a progressive clone batch");

const malformedClient: ProgressiveCloneModelClient = {
  models: { async generateContent() { return { text: "{}" }; } },
};
await assert.rejects(
  () => createProgressiveCloneBatchAnalyzer(malformedClient)({
    batchText: firstBatch,
    targetName: "Target",
    batchIndex: 0,
    totalBatches: 1,
  }),
  (error: unknown) => {
    assert.ok(error instanceof ProgressiveCloneAnalysisError);
    assert.equal(error.stage, "validation");
    return true;
  },
);

const offlineClient: ProgressiveCloneModelClient = {
  models: { async generateContent() { throw new Error("provider offline"); } },
};
await assert.rejects(
  () => createProgressiveCloneBatchAnalyzer(offlineClient)({
    batchText: firstBatch,
    targetName: "Target",
    batchIndex: 0,
    totalBatches: 1,
  }),
  (error: unknown) => {
    assert.ok(error instanceof ProgressiveCloneAnalysisError);
    assert.equal(error.stage, "model");
    assert.match(error.message, /provider offline/);
    return true;
  },
);

await assert.rejects(
  () => analyze({
    batchText: firstBatch,
    targetName: "Tar",
    batchIndex: 0,
    totalBatches: 1,
  }),
  /not found exactly/,
);

await assert.rejects(
  () => analyze({
    batchText: "x".repeat(MAX_PROGRESSIVE_BATCH_BYTES + 1),
    targetName: "Target",
    batchIndex: 0,
    totalBatches: 1,
  }),
  (error: unknown) => {
    assert.ok(error instanceof ProgressiveCloneAnalysisError);
    assert.equal(error.stage, "input");
    return true;
  },
  "batch payloads must be bounded before parsing or model calls",
);

console.log("Progressive clone analysis tests passed.");
