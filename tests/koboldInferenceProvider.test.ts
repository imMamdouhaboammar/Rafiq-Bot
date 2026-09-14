import assert from "node:assert/strict";
import {
  probeKoboldEndpoint,
  buildPsychologicalStateGBNF,
  KoboldEndpointConfigSchema,
} from "../services/koboldInferenceProvider.js";

// 1. Default config validation
const config = KoboldEndpointConfigSchema.parse({});
assert.equal(config.endpointUrl, "http://localhost:5001/v1");
assert.equal(config.modelName, "local-model");
assert.equal(config.temperature, 0.8);

// 2. Offline probe handling
const result = await probeKoboldEndpoint("http://127.0.0.1:59999/v1");
assert.equal(result.online, false);
assert.ok(result.error);

// 3. Valid GBNF grammar
const gbnf = buildPsychologicalStateGBNF();
assert.ok(gbnf.includes("root ::="));
assert.ok(gbnf.includes("mood ::="));
assert.ok(gbnf.includes("happy"));
assert.ok(gbnf.includes("playful"));

console.log("Kobold Inference Provider tests passed successfully!");
