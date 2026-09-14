import assert from "node:assert/strict";
import {
  GroupTurnCoordinator,
  calculateGroupReplyScore,
  containsGroupMention,
  getGroupReplyThreshold,
} from "../services/groupConversation.js";
import { RelationType } from "../types.js";
import { GroupEngine, groupEngine } from "../services/groupEngine.js";
import { eventBus } from "../services/eventBus.js";
import { useGroupStore } from "../stores/groupStore.js";

const coordinator = new GroupTurnCoordinator({
  maxPrimaryReplies: 2,
  maxFollowUpReplies: 1,
  maxBotMessages: 3,
});

assert.equal(
  coordinator.tryReserve({
    rootMessageId: "user-1",
    triggerMessageId: "user-1",
    triggerDepth: 0,
    senderId: "user",
    personaId: "bot-a",
  }),
  true,
  "The first primary bot reply should be allowed",
);

assert.equal(
  coordinator.tryReserve({
    rootMessageId: "user-1",
    triggerMessageId: "user-1",
    triggerDepth: 0,
    senderId: "user",
    personaId: "bot-a",
  }),
  false,
  "A persona must not reserve the same trigger twice",
);

assert.equal(
  coordinator.tryReserve({
    rootMessageId: "user-1",
    triggerMessageId: "user-1",
    triggerDepth: 0,
    senderId: "user",
    personaId: "bot-b",
  }),
  true,
  "A second primary bot reply should be allowed",
);

assert.equal(
  coordinator.tryReserve({
    rootMessageId: "user-1",
    triggerMessageId: "user-1",
    triggerDepth: 0,
    senderId: "user",
    personaId: "bot-c",
  }),
  false,
  "Primary replies must respect their per-turn budget",
);

assert.equal(
  coordinator.tryReserve({
    rootMessageId: "user-1",
    triggerMessageId: "bot-a-1",
    triggerDepth: 1,
    senderId: "bot-a",
    personaId: "bot-c",
  }),
  true,
  "One bot-to-bot follow-up should be allowed",
);

assert.equal(
  coordinator.tryReserve({
    rootMessageId: "user-1",
    triggerMessageId: "bot-b-1",
    triggerDepth: 1,
    senderId: "bot-b",
    personaId: "bot-a",
  }),
  false,
  "Only one bot-to-bot follow-up should be allowed per user turn",
);

const extendedCoordinator = new GroupTurnCoordinator({
  maxPrimaryReplies: 1,
  maxFollowUpReplies: 3,
  maxBotMessages: 4,
});
assert.equal(extendedCoordinator.tryReserve({
  rootMessageId: "long-thread",
  triggerMessageId: "long-thread",
  triggerDepth: 0,
  senderId: "user",
  personaId: "bot-a",
}), true);
assert.equal(extendedCoordinator.tryReserve({
  rootMessageId: "long-thread",
  triggerMessageId: "long-thread-bot-a",
  triggerDepth: 1,
  senderId: "bot-a",
  personaId: "bot-b",
}), true);
assert.equal(
  extendedCoordinator.tryReserve({
    rootMessageId: "long-thread",
    triggerMessageId: "long-thread-bot-b",
    triggerDepth: 2,
    senderId: "bot-b",
    personaId: "bot-c",
  }),
  true,
  "A group turn can continue naturally past the first bot-to-bot layer",
);
assert.equal(
  extendedCoordinator.tryReserve({
    rootMessageId: "long-thread",
    triggerMessageId: "long-thread-bot-c",
    triggerDepth: 3,
    senderId: "bot-c",
    personaId: "bot-a",
  }),
  true,
  "A long group discussion remains bounded but can include several exchanges",
);

assert.equal(
  coordinator.tryReserve({
    rootMessageId: "user-2",
    triggerMessageId: "bot-a-self",
    triggerDepth: 1,
    senderId: "bot-a",
    personaId: "bot-a",
  }),
  false,
  "A bot must never answer its own message",
);

const retryableReservation = {
  rootMessageId: "user-3",
  triggerMessageId: "user-3",
  triggerDepth: 0,
  senderId: "user",
  personaId: "bot-a",
};
assert.equal(coordinator.tryReserve(retryableReservation), true);
coordinator.release(retryableReservation);
assert.equal(
  coordinator.tryReserve(retryableReservation),
  true,
  "A failed generation must release its reply slot for retry",
);

const totalCapCoordinator = new GroupTurnCoordinator({
  maxPrimaryReplies: 10,
  maxFollowUpReplies: 10,
  maxBotMessages: 2,
});
assert.equal(totalCapCoordinator.tryReserve({
  rootMessageId: "cap-root",
  triggerMessageId: "cap-user",
  triggerDepth: 0,
  senderId: "user",
  personaId: "bot-a",
}), true);
assert.equal(totalCapCoordinator.tryReserve({
  rootMessageId: "cap-root",
  triggerMessageId: "cap-bot-a",
  triggerDepth: 1,
  senderId: "bot-a",
  personaId: "bot-b",
}), true);
assert.equal(totalCapCoordinator.tryReserve({
  rootMessageId: "cap-root",
  triggerMessageId: "cap-bot-b",
  triggerDepth: 1,
  senderId: "bot-b",
  personaId: "bot-c",
}), false, "The total bot-message cap must apply independently of depth budgets");
assert.equal(totalCapCoordinator.tryReserve({
  rootMessageId: "fresh-root",
  triggerMessageId: "fresh-user",
  triggerDepth: 0,
  senderId: "user",
  personaId: "bot-a",
}), true, "A full turn must not consume the next user turn's budget");

assert.equal(containsGroupMention("يا مَــريم قولي رأيك", "مريم"), true);
assert.equal(
  containsGroupMention("الدنيا منورة النهارده", "نور"),
  false,
  "A bot name inside another word must not count as a direct mention",
);

const balancedUserScore = calculateGroupReplyScore({
  botName: "مريم",
  chattiness: "balanced",
  relationshipWithUser: undefined,
  relationshipsWithBots: [],
  trigger: { text: "عاملين إيه؟", fromId: "user" },
  random: () => 0,
});

assert.ok(
  balancedUserScore > getGroupReplyThreshold("balanced"),
  "A default balanced bot must be able to answer a normal user message",
);

const partnerReplyScore = calculateGroupReplyScore({
  botName: "سارة",
  chattiness: "balanced",
  relationshipWithUser: undefined,
  relationshipsWithBots: [{ targetBotId: "bot-a", type: RelationType.PARTNER }],
  trigger: { text: "أنا شايف إن ده أحسن", fromId: "bot-a" },
  random: () => 0,
});

assert.ok(
  partnerReplyScore > getGroupReplyThreshold("balanced"),
  "A bot with a strong relationship must be able to answer another bot",
);

const acquaintanceReplyScore = calculateGroupReplyScore({
  botName: "نور",
  chattiness: "balanced",
  relationshipsWithBots: [],
  trigger: { text: "طب وإنتِ رأيك إيه؟", fromId: "bot-b" },
  random: () => 0.5,
});

assert.ok(
  acquaintanceReplyScore > getGroupReplyThreshold("balanced"),
  "A balanced bot should sometimes join a bot-to-bot exchange without a configured relationship",
);

const groupId = "group-perception-regression";
const quietBot = (id: string, name: string) => ({
  id,
  settings: {
    botName: name,
    botGender: "female",
    chattiness: "low",
    fragmentedMessages: true,
    soulId: "amira_default",
    thinkingLevel: "low",
  },
});

await groupEngine.initGroupSession(
  {
    id: groupId,
    isGroup: true,
    groupName: "اختبار",
    memberIds: ["bot-a", "bot-b", "bot-c"],
    settings: {
      botName: "اختبار",
      botGender: "female",
      chattiness: "balanced",
      fragmentedMessages: true,
      soulId: "amira_default",
      thinkingLevel: "low",
    },
  } as any,
  [quietBot("bot-a", "مريم"), quietBot("bot-b", "سارة"), quietBot("bot-c", "نور")] as any,
);

let perceptionCount = 0;
const countPerception = (payload: { groupId: string }) => {
  if (payload.groupId === groupId) perceptionCount += 1;
};
eventBus.on("persona:perceive_message", countPerception as any);

eventBus.emit("group:message_send", {
  groupId,
  senderId: "user",
  senderName: "You",
  text: "عاملين إيه؟",
  msgId: "perception-1",
  rootMessageId: "perception-1",
  depth: 0,
});

assert.equal(
  perceptionCount,
  1,
  "One room message must emit one perception event, regardless of bot count",
);

eventBus.off("persona:perceive_message", countPerception as any);
groupEngine.destroyGroupSession(groupId);

const integrationGroupId = "group-causal-integration";
const integrationBots = Array.from({ length: 20 }, (_, index) => quietBot(
  `integration-${index + 1}`,
  `بوت ${index + 1}`,
)).map(bot => ({
  ...bot,
  settings: {
    ...bot.settings,
    chattiness: "balanced",
    botBio: "صيدلانية هادية بتحب الكتب والكلام المباشر من غير دراما.",
    impersonationProfile: "ردود قصيرة وواضحة، وبتبني رأيها على الكلام اللي حصل في المحادثة.",
  },
  psychology: {
    mood: "hangry",
    energyLevel: 1,
    socialMeter: 5,
    emotionalLedger: 0,
    currentScenario: "Standard Routine",
    intimacyLevel: 25,
    secretUnlocked: false,
    hungerLevel: 100,
    financialStress: 100,
    sleepiness: 100,
    lastInteractionTime: new Date(),
  },
})) as any[];
const integrationBotMap = new Map(integrationBots.map(bot => [bot.id, bot]));
const savedBotMessages: any[] = [];
const emittedBotMessages: any[] = [];
let generatedReplyCount = 0;
const generatedPrompts: string[] = [];
let nextMessageId = 0;
let resolveThreeMessages!: () => void;
const threeMessagesSaved = new Promise<void>(resolve => {
  resolveThreeMessages = resolve;
});

const integrationEngine = new GroupEngine({
  getChatSession: async chatId => integrationBotMap.get(chatId),
  saveGroupMessage: async message => {
    savedBotMessages.push(message);
    if (savedBotMessages.length === 3) resolveThreeMessages();
  },
  deleteGroupMessage: async messageId => {
    const index = savedBotMessages.findIndex(message => message.id === messageId);
    if (index >= 0) savedBotMessages.splice(index, 1);
  },
  createMessageId: () => `generated-${++nextMessageId}`,
  personaMind: {
    random: () => 0.5,
    generateGroupResponse: async (prompt, _history, _latest, senderName) => {
      generatedReplyCount += 1;
      generatedPrompts.push(prompt);
      return senderName === 'You'
        ? 'أنا أفضل الكتب. وإنتِ رأيك إيه؟'
        : `رد على ${senderName}`;
    },
  },
  coordinatorOptions: {
    maxPrimaryReplies: 2,
    maxFollowUpReplies: 1,
    maxBotMessages: 3,
  },
});

await integrationEngine.initGroupSession({
  id: integrationGroupId,
  isGroup: true,
  groupName: "تكامل",
  memberIds: integrationBots.map(bot => bot.id),
  settings: {
    botName: "تكامل",
    botGender: "female",
    chattiness: "balanced",
    fragmentedMessages: true,
    soulId: "amira_default",
    thinkingLevel: "low",
  },
} as any, integrationBots as any);

const captureBotMessage = (payload: any) => {
  if (payload.groupId === integrationGroupId && payload.senderId !== "user") {
    emittedBotMessages.push(payload);
  }
};
eventBus.on("group:message_send", captureBotMessage);
eventBus.emit("group:message_send", {
  groupId: integrationGroupId,
  senderId: "user",
  senderName: "You",
  text: "نتكلم في إيه؟",
  msgId: "integration-user-1",
  rootMessageId: "integration-user-1",
  depth: 0,
});

await Promise.race([
  threeMessagesSaved,
  new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out waiting for group replies")), 2_000)),
]);
await new Promise(resolve => setTimeout(resolve, 0));

assert.equal(generatedReplyCount, 3, "The causal pipeline must cap Gemini calls at three");
assert.equal(generatedPrompts.length, 3, "Every generated group reply must have an inspectable persona prompt");
assert.ok(generatedPrompts.every(prompt => prompt.includes("CONVERSATION-SHAPED PERSONA")));
assert.ok(generatedPrompts.every(prompt => prompt.includes("صيدلانية هادية")));
assert.ok(generatedPrompts.every(prompt => prompt.includes("ردود قصيرة وواضحة")));
assert.ok(generatedPrompts.every(prompt => !/MASLOW|SURVIVAL MODE|هموت من الجوع|COGNITIVE BIO-SLIPS|THE SURVIVOR|Mamdouh|Kenzy|El Sand|emotional spending|campaigns|moderation/i.test(prompt)), "Group prompts must not revive legacy bodily drama or default archetype lore");
assert.equal(savedBotMessages.length, 3, "The causal pipeline must persist at most three bot messages");
assert.ok(savedBotMessages.every(message => message.rootMessageId === "integration-user-1"));
assert.equal(savedBotMessages.filter(message => message.depth === 1).length, 2);
assert.equal(savedBotMessages.filter(message => message.depth === 2).length, 1);
const persistedFollowUp = savedBotMessages.find(message => message.depth === 2);
assert.ok(
  savedBotMessages.some(message => message.id === persistedFollowUp.replyToMessageId),
  "Persisted lineage must connect the follow-up to its primary reply",
);
assert.equal(emittedBotMessages.filter(message => message.depth === 1).length, 2);
assert.equal(emittedBotMessages.filter(message => message.depth === 2).length, 1);
assert.ok(emittedBotMessages.every(message => message.rootMessageId === "integration-user-1"));
const followUp = emittedBotMessages.find(message => message.depth === 2);
assert.ok(
  emittedBotMessages.some(message => message.depth === 1 && message.msgId === followUp.replyToMessageId),
  "The bot-to-bot follow-up must point to a primary bot reply",
);

eventBus.off("group:message_send", captureBotMessage);
integrationEngine.dispose();

const ongoingGroupId = 'group-ongoing-discussion';
const ongoingBots = [quietBot('ongoing-a', 'أميرة'), quietBot('ongoing-b', 'نور')].map(bot => ({
  ...bot,
  settings: { ...bot.settings, chattiness: 'balanced' },
})) as any[];
const ongoingBotMap = new Map(ongoingBots.map(bot => [bot.id, bot]));
const ongoingMessages: any[] = [];
let resolveOngoingMessages!: () => void;
const twoOngoingMessages = new Promise<void>(resolve => {
  resolveOngoingMessages = resolve;
});
const ongoingEngine = new GroupEngine({
  getChatSession: async chatId => ongoingBotMap.get(chatId),
  saveGroupMessage: async message => {
    ongoingMessages.push(message);
    if (ongoingMessages.length === 2) resolveOngoingMessages();
  },
  continuationDelayMs: 1,
  personaMind: {
    generateGroupResponse: async (_prompt, _history, latestMessage, senderName) => (
      `رد من ${senderName} على ${latestMessage}`
    ),
  },
  coordinatorOptions: {
    maxPrimaryReplies: 1,
    maxFollowUpReplies: 0,
    maxBotMessages: 1,
  },
});

await ongoingEngine.initGroupSession({
  id: ongoingGroupId,
  isGroup: true,
  groupName: 'نقاش مستمر',
  memberIds: ongoingBots.map(bot => bot.id),
  settings: {
    botName: 'نقاش مستمر',
    botGender: 'female',
    chattiness: 'balanced',
    fragmentedMessages: true,
    soulId: 'amira_default',
    thinkingLevel: 'low',
  },
} as any, ongoingBots);

eventBus.emit('group:message_send', {
  groupId: ongoingGroupId,
  senderId: 'user',
  senderName: 'You',
  text: 'ابدأوا النقاش',
  msgId: 'ongoing-user-1',
  rootMessageId: 'ongoing-user-1',
  depth: 0,
});

await Promise.race([
  twoOngoingMessages,
  new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for the group continuation')), 2_000)),
]);
assert.equal(ongoingMessages.length, 2, 'The group should open a new thread after a bounded exchange ends');
assert.equal(ongoingMessages[1].rootMessageId, ongoingMessages[0].id, 'The continuation must reply to the last bot message as a fresh thread');
ongoingEngine.dispose();

const storeGroupId = "group-store-regression";
const optimisticMessage = {
  id: "optimistic-1",
  chatId: storeGroupId,
  senderId: "user",
  role: "user",
  text: "رسالة سريعة",
  timestamp: new Date("2026-01-01T10:00:00Z"),
} as any;
useGroupStore.getState().addGroupMessage(storeGroupId, optimisticMessage);
useGroupStore.getState().addGroupMessage(storeGroupId, optimisticMessage);
useGroupStore.getState().setGroupMessages(storeGroupId, []);
assert.deepEqual(
  useGroupStore.getState().messages[storeGroupId].map(message => message.id),
  ["optimistic-1"],
  "A late history load must merge with, not erase or duplicate, an optimistic message",
);
useGroupStore.getState().removeGroupMessage(storeGroupId, "optimistic-1");
assert.equal(
  useGroupStore.getState().messages[storeGroupId].length,
  0,
  "Deleting a group message must remove it from the group store",
);

console.log("Group conversation coordination tests passed");
