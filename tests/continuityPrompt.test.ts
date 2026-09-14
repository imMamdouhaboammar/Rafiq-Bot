import assert from "node:assert/strict";
import { compileContinuityContextInstruction } from "../services/continuityPrompt.js";

const instruction = compileContinuityContextInstruction([
  { kind: "thread", text: "نتيجة الانترفيو لسه معلقة", priority: 3.9 },
  { kind: "opinion", text: "الفيلم: حلو بس طويل زيادة", priority: 1.7 },
  { kind: "expectation", text: "مواعيد الخطط ساعات بتتأجل", priority: 1.1 },
  { kind: "ritual", text: "بنهزر قبل البريزنتيشن", priority: 1.4 },
  { kind: "thread", text: "عنصر خامس لازم ما يدخلش", priority: 0.5 },
]);

assert.ok(instruction.includes("RELATIONSHIP CONTINUITY"));
assert.ok(instruction.includes("نتيجة الانترفيو"));
assert.ok(instruction.includes("الفيلم"));
assert.equal(instruction.includes("عنصر خامس"), false);
assert.ok(instruction.includes("Do not invent the outcome"));
assert.ok(instruction.includes("Do not mention memory systems"));

assert.equal(compileContinuityContextInstruction([]), "");

console.log("Continuity prompt tests passed successfully!");
