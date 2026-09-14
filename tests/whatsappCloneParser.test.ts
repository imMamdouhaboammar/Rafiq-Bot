import assert from "node:assert/strict";
import {
  MAX_WHATSAPP_EXPORT_BYTES,
  WhatsAppExportTooLargeError,
  parseWhatsAppChat,
} from "../services/whatsappImporter.server.js";
import {
  TargetParticipantError,
  assertTargetEvidenceFloor,
  computeStatistics,
  extractTargetReplyExamples,
  resolveTargetName,
} from "../services/chatStatistics.js";

const exportText = [
  "01/02/2024, 10:00 AM - Mona: first line",
  "  indented continuation",
  "2024 goals stay on this message",
  "01/02/2024, 10:01 AM - Mona Ali: reply with +20 100 123 4567",
  "01/02/2024, 10:02 AM - Mona: صورة محذوفة",
].join("\n");

const messages = parseWhatsAppChat(exportText);
assert.equal(messages.length, 2, "Arabic omitted-media lines must not become clone evidence");
assert.equal(messages[0].sender, "Mona");
assert.equal(messages[0].date.getFullYear(), 2024);
assert.equal(messages[0].date.getMonth(), 1, "ambiguous dates use deterministic DD/MM order");
assert.equal(messages[0].date.getDate(), 1);
assert.equal(
  messages[0].content,
  "first line\n  indented continuation\n2024 goals stay on this message",
  "multiline content and indentation must be preserved",
);

const statistics = computeStatistics(messages);
assert.equal(resolveTargetName(messages, statistics, "Mona"), "Mona");
assert.throws(
  () => resolveTargetName(messages, statistics, "Mon"),
  TargetParticipantError,
  "partial participant names must never select a clone target",
);
assert.throws(
  () => resolveTargetName(messages, statistics, "Missing"),
  /was not found exactly/,
);
assert.throws(
  () => assertTargetEvidenceFloor(messages, "Mona"),
  /Not enough messages/,
  "a sparse participant must not produce a supposedly reliable clone",
);

const replyExamples = extractTargetReplyExamples(messages, "Mona Ali", 24);
assert.deepEqual(replyExamples, [{
  context: "first line\n  indented continuation\n2024 goals stay on this message",
  response: "reply with [PHONE]",
}]);
assert.deepEqual(
  extractTargetReplyExamples(messages, "Mona Ali", 24),
  replyExamples,
  "reply examples must be deterministic",
);

const delayedReplyMessages = parseWhatsAppChat([
  "01/02/2024, 10:00 AM - Mona: are you coming?",
  "01/02/2024, 03:00 PM - Mona Ali: yes, after work",
].join("\n"));
assert.equal(
  extractTargetReplyExamples(delayedReplyMessages, "Mona Ali", 24).length,
  1,
  "a genuine delayed WhatsApp reply must remain usable evidence",
);

const continuationWithTimestamp = parseWhatsAppChat([
  "01/02/2024, 10:00 AM - Mona: خلينا نتقابل",
  "meet 03/02/2024, 10:30 AM - Location: Cairo",
  "01/02/2024, 10:01 AM - Mona Ali: تمام",
].join("\n"));
assert.equal(continuationWithTimestamp.length, 2);
assert.equal(continuationWithTimestamp[0].sender, "Mona");
assert.match(continuationWithTimestamp[0].content, /Location: Cairo/);
assert.equal(
  continuationWithTimestamp.some(message => message.sender === "Location"),
  false,
  "a timestamp inside multiline content must not fabricate a participant",
);

const arabicLocalizedTimestamps = parseWhatsAppChat([
  "١٧/٠٧/٢٠٢٦، ١٠:٣٠ م - جهاد: مساء الخير، الساعة ٣ م",
  "١٨/٠٧/٢٠٢٦، ٠٩:١٥ ص - ممدوح: صباح النور",
  "[١٩/٠٧/٢٠٢٦، ٠٨:٠٥ ص] جهاد: صباحًا، معادنا ٨ ص",
  "‎٢٠/٠٧/٢٠٢٦، ١١:٠٠ ص - ممدوح: من غير تغيير ٢٠٢٦، تمام؟",
  "٢٠/٠٧/٢٠٢٦، ١١:٠٠ ص - جهاد: <تم استبعاد الوسائط>",
].join("\n"));
assert.equal(arabicLocalizedTimestamps.length, 4, "Arabic AM/PM exports must be parsed and omitted media filtered");
assert.equal(arabicLocalizedTimestamps[0].sender, "جهاد");
assert.equal(arabicLocalizedTimestamps[0].date.getHours(), 22);
assert.equal(arabicLocalizedTimestamps[1].date.getHours(), 9);
assert.equal(arabicLocalizedTimestamps[2].date.getHours(), 8, "localized iOS timestamps must be parsed");
assert.equal(
  arabicLocalizedTimestamps[0].content,
  "مساء الخير، الساعة ٣ م",
  "timestamp normalization must not rewrite Arabic words, punctuation, digits, or marker-like body text",
);
assert.equal(
  arabicLocalizedTimestamps[2].content,
  "صباحًا، معادنا ٨ ص",
  "iOS message bodies must also remain byte-for-byte unchanged after trimming",
);
assert.equal(
  arabicLocalizedTimestamps[3].content,
  "من غير تغيير ٢٠٢٦، تمام؟",
  "directional marks in the timestamp must not require normalizing the message body",
);

const embeddedDirectionalDateMarks = parseWhatsAppChat([
  "22\u200f/4\u200f/2025، 1:14 ص - \u200fالرسائل والمكالمات مشفرة تمامًا بين الطرفين.",
  "22\u200f/4\u200f/2025، 1:15 ص - \u200fGehad: رسالة فعلية بعد علامات الاتجاه",
].join("\n"));
assert.equal(embeddedDirectionalDateMarks.length, 1, "directional marks inside localized dates must parse");
assert.equal(embeddedDirectionalDateMarks[0]?.sender, "Gehad");
assert.equal(embeddedDirectionalDateMarks[0]?.content, "رسالة فعلية بعد علامات الاتجاه");

assert.throws(
  () => parseWhatsAppChat("x".repeat(MAX_WHATSAPP_EXPORT_BYTES + 1)),
  WhatsAppExportTooLargeError,
  "oversize exports must be rejected instead of silently truncated",
);

console.log("WhatsApp clone parser tests passed.");
