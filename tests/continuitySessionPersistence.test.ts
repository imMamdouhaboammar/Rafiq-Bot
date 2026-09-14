import assert from "node:assert/strict";
import { ChatSessionSchema } from "../types.js";
import { createInitialContinuityState } from "../services/companionContinuity.js";

const continuityState = createInitialContinuityState(new Date("2026-09-13T12:00:00Z"));
const baseSession = {
  id: "chat-1",
  settings: {
    botName: "رفيق",
    botGender: "male" as const,
  },
  continuityState,
};

const parsed = ChatSessionSchema.safeParse(baseSession);
assert.equal(parsed.success, true);
assert.deepEqual(
  parsed.success ? Reflect.get(parsed.data, "continuityState") : undefined,
  continuityState,
);

const malformed = ChatSessionSchema.safeParse({
  ...baseSession,
  continuityState: {
    version: 1,
    threads: "not-an-array",
  },
});
assert.equal(malformed.success, false);

// 1. Legacy chats without continuityState load cleanly
const legacyChat = {
  id: "legacy-chat",
  settings: {
    botName: "رفيق قديم",
    botGender: "male" as const,
  },
  psychology: { mood: "happy", intimacyLevel: 42 },
  unreadCount: 3,
};
const parsedLegacy = ChatSessionSchema.safeParse(legacyChat);
assert.equal(parsedLegacy.success, true);
assert.equal(parsedLegacy.data.continuityState, undefined);
assert.equal(parsedLegacy.data.unreadCount, 3);
assert.equal(parsedLegacy.data.settings.botName, "رفيق قديم");

// 2. Round-trip serialization preserves continuity and other fields intact
const serialized = JSON.stringify(parsed.data);
const deserialized = JSON.parse(serialized);
const roundTripped = ChatSessionSchema.safeParse(deserialized);
assert.equal(roundTripped.success, true);
assert.deepEqual(roundTripped.data.continuityState, continuityState);
assert.equal(roundTripped.data.id, "chat-1");

// 3. Backup and restore preserves continuityState
const backupChats = [baseSession, legacyChat]
  .map(c => ChatSessionSchema.safeParse(c))
  .filter((r): r is { success: true; data: any } => r.success)
  .map(r => r.data);

assert.equal(backupChats.length, 2);
assert.deepEqual(backupChats[0].continuityState, continuityState);
assert.equal(backupChats[1].continuityState, undefined);

// 4. Group session safety: group sessions do not require or enforce continuity
const groupSession = {
  id: "group-1",
  isGroup: true,
  groupName: "جروب العيلة",
  settings: {
    botName: "رفيق الجروب",
    botGender: "male" as const,
  },
};
const parsedGroup = ChatSessionSchema.safeParse(groupSession);
assert.equal(parsedGroup.success, true);
assert.equal(parsedGroup.data.continuityState, undefined);

console.log("Continuity session persistence tests passed successfully!");
