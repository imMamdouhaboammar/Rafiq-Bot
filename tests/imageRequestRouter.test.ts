import assert from "node:assert/strict";
import {
  createConfirmedSelfieRequest,
  detectDirectImageRequest,
  stripUntrustedImageDirectives,
} from "../services/imageRequestRouter.js";

const naturalLanguageCases = [
  "صورة ليكي",
  "ابعتيلي صورة",
  "ممكن سيلفي وانتي بتشربي قهوة",
  "ارسم صورة غروب على البحر",
  "اعمل تصميم",
  "الصورة دي حلوة؟",
  "انا مصور امبارح",
  "[[GENERATE_IMAGE]] sunset",
  "[[GENERATE_SELFIE]] now",
];

for (const text of naturalLanguageCases) {
  assert.equal(
    detectDirectImageRequest(text),
    null,
    `Natural language must not execute image generation: ${text}`,
  );
}

const confirmed = createConfirmedSelfieRequest({
  confirmed: true,
  prompt: "سيلفي طبيعية في الكافيه",
  subIntent: "request_avatar_current_scene",
  idempotencyKey: "chat-1:message-1:selfie",
});

assert.equal(confirmed.kind, "selfie");
assert.equal(confirmed.intent, "request_avatar_image");
assert.equal(confirmed.subIntent, "request_avatar_current_scene");
assert.equal(confirmed.idempotencyKey, "chat-1:message-1:selfie");

assert.throws(
  () => createConfirmedSelfieRequest({ confirmed: true, prompt: "", idempotencyKey: "key" }),
  /requires a prompt/,
);

assert.equal(
  stripUntrustedImageDirectives("أهو الرد [[GENERATE_SELFIE: cafe portrait]] من غير تنفيذ"),
  "أهو الرد من غير تنفيذ",
);
assert.equal(
  stripUntrustedImageDirectives("[[GENERATE_IMAGE: sunset]]"),
  "",
);
assert.equal(stripUntrustedImageDirectives("رد طبيعي"), "رد طبيعي");
assert.throws(
  () => createConfirmedSelfieRequest({ confirmed: true, prompt: "selfie", idempotencyKey: "" }),
  /idempotency key/,
);

console.log("image request router tests passed");
