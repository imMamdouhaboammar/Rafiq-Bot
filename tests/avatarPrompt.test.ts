import assert from "node:assert/strict";
import { buildProfileAvatarPrompt, PROFILE_AVATAR_MODEL_CHAIN } from "../services/avatarEngine";

const prompt = buildProfileAvatarPrompt({
  botName: "سليم",
  botGender: "male",
  botAge: 29,
  botBio: "شاب مصري هادي بيشتغل في التصميم وبيحب القهوة والمشي بالليل.",
  chattiness: "balanced",
  fragmentedMessages: true,
  visualSeed: {
    palette: "neutral",
    lighting: "window daylight",
    tone: "natural",
    seed: "test-seed",
  },
});

assert.equal(PROFILE_AVATAR_MODEL_CHAIN[0], "gemini-3.1-flash-image");
assert.equal(PROFILE_AVATAR_MODEL_CHAIN.length, 1, "Avatar model chain must contain only the locked image model");
assert.match(prompt, /social profile lifestyle portrait/i);
assert.match(prompt, /Instagram story photo/i);
assert.match(prompt, /WhatsApp profile picture/i);
assert.match(prompt, /Arab \/ Middle Eastern \/ North African/i);
assert.match(prompt, /friend-taken phone photo/i);
assert.match(prompt, /Three-quarter or full-body lifestyle portrait/i);
assert.match(prompt, /Modern modest fashion/i);
assert.match(prompt, /coordinated colors/i);
assert.match(prompt, /lifestyle micro-action/i);
assert.match(prompt, /holding coffee/i);
assert.match(prompt, /sunny residential sidewalk/i);
assert.match(prompt, /Bright natural daylight/i);
assert.match(prompt, /sharp real shadows/i);
assert.match(prompt, /shallow depth of field/i);
assert.match(prompt, /Square 1:1 composition/i);
assert.match(prompt, /No cartoon/i);
assert.match(prompt, /No dark moody portrait/i);
assert.match(prompt, /no black-and-white photo/i);
assert.match(prompt, /no passport photo/i);
assert.match(prompt, /no stiff centered ID portrait/i);
assert.match(prompt, /No extreme close-up/i);
assert.match(prompt, /No text/i);
assert.match(prompt, /سليم/);
assert.match(prompt, /شاب مصري/);

console.log("avatar prompt tests passed");
