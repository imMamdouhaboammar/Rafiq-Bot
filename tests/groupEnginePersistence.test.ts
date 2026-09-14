import assert from 'node:assert/strict';
import { GroupEngine } from '../services/groupEngine.js';
import {
  PersistentGroupTurnCoordinator,
  type CoordinatedGroupTurnJob,
  type GroupTurnJobStore,
} from '../services/groupTurnCoordinator.js';
import { eventBus } from '../services/eventBus.js';
import type { ChatSession } from '../types.js';

const jobs = new Map<string, CoordinatedGroupTurnJob>();
const jobStore: GroupTurnJobStore = {
  get: async id => jobs.get(id),
  put: async job => { jobs.set(job.id, structuredClone(job)); },
  list: async () => Array.from(jobs.values()).map(job => structuredClone(job)),
};
let now = new Date('2026-07-13T12:00:00.000Z');
const turnCoordinator = new PersistentGroupTurnCoordinator(
  jobStore,
  () => new Date(now),
  () => 'persisted-job-1',
);

await turnCoordinator.enqueue({
  groupId: 'group-recovery',
  rootMessageId: 'user-root',
  causalMessageId: 'user-root',
  triggerDepth: 0,
  triggerSenderId: 'user',
  triggerSenderName: 'Mamdouh',
  triggerText: 'عايز رأي واضح في الخطة',
  speakerBotId: 'bot-a',
  idempotencyKey: 'group-recovery:user-root:bot-a',
  modelCallBudget: 1,
});

const bot: ChatSession = {
  id: 'bot-a',
  settings: {
    botName: 'سارة',
    botGender: 'female',
    botBio: 'زميلة عملية تقول رأيها بوضوح.',
    chattiness: 'balanced',
    fragmentedMessages: true,
    soulId: 'amira_default',
  },
};
const group: ChatSession = {
  id: 'group-recovery',
  isGroup: true,
  groupName: 'اختبار الاستعادة',
  memberIds: ['bot-a', 'bot-b'],
  settings: {
    botName: 'اختبار الاستعادة',
    botGender: 'female',
    chattiness: 'balanced',
    fragmentedMessages: true,
    soulId: 'amira_default',
  },
};
const botMap = new Map<string, ChatSession>([['bot-a', bot]]);
const savedMessages: any[] = [];
const emittedMessages: any[] = [];
const handleMessage = (payload: any) => {
  if (payload.groupId === group.id && payload.senderId === bot.id) emittedMessages.push(payload);
};
eventBus.on('group:message_send', handleMessage);

const engine = new GroupEngine({
  turnCoordinator,
  getChatSession: async id => botMap.get(id),
  saveGroupMessage: async message => { savedMessages.push(message); },
  deleteGroupMessage: async messageId => {
    const index = savedMessages.findIndex(message => message.id === messageId);
    if (index >= 0) savedMessages.splice(index, 1);
  },
  saveGroupReaction: async () => undefined,
  personaMind: {
    generateGroupResponse: async prompt => {
      assert.match(prompt, /عايز رأي واضح في الخطة/);
      return 'الخطة واضحة بس محتاجة ترتيب أولويات';
    },
  },
});

await engine.initGroupSession(group, [bot]);
for (let index = 0; index < 20 && savedMessages.length === 0; index++) {
  await new Promise(resolve => setTimeout(resolve, 0));
}

assert.equal(savedMessages.length, 1, 'queued job should execute after the group session is restored');
assert.equal(savedMessages[0].id, 'group-turn-persisted-job-1');
assert.equal(savedMessages[0].rootMessageId, 'user-root');
assert.equal(savedMessages[0].replyToMessageId, 'user-root');
assert.equal(emittedMessages.length, 1);
assert.equal(jobs.get('persisted-job-1')?.status, 'completed');
assert.equal(jobs.get('persisted-job-1')?.outputMessageId, 'group-turn-persisted-job-1');

await engine.initGroupSession(group, [bot]);
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(savedMessages.length, 1, 'completed jobs must never be executed twice');

engine.dispose();
eventBus.off('group:message_send', handleMessage);

const raceJobs = new Map<string, CoordinatedGroupTurnJob>();
let releaseInitialDrain!: () => void;
let markInitialDrainStarted!: () => void;
const initialDrainStarted = new Promise<void>(resolve => { markInitialDrainStarted = resolve; });
const initialDrainGate = new Promise<void>(resolve => { releaseInitialDrain = resolve; });
let raceListCalls = 0;
const raceStore: GroupTurnJobStore = {
  get: async id => raceJobs.get(id),
  put: async job => { raceJobs.set(job.id, structuredClone(job)); },
  list: async () => {
    const snapshot = Array.from(raceJobs.values()).map(job => structuredClone(job));
    if (raceListCalls++ === 0) {
      markInitialDrainStarted();
      await initialDrainGate;
    }
    return snapshot;
  },
};
const raceCoordinator = new PersistentGroupTurnCoordinator(
  raceStore,
  () => new Date('2026-07-13T12:05:00.000Z'),
  () => 'race-job-1',
);
const raceGroup: ChatSession = {
  ...group,
  id: 'group-drain-race',
  groupName: 'اختبار تزامن الاستعادة',
};
const raceMessages: any[] = [];
const raceEngine = new GroupEngine({
  turnCoordinator: raceCoordinator,
  getChatSession: async id => botMap.get(id),
  saveGroupMessage: async message => { raceMessages.push(message); },
  deleteGroupMessage: async messageId => {
    const index = raceMessages.findIndex(message => message.id === messageId);
    if (index >= 0) raceMessages.splice(index, 1);
  },
  saveGroupReaction: async () => undefined,
  personaMind: {
    generateGroupResponse: async () => 'الطلب وصل مرة واحدة بعد انتهاء الاستعادة',
  },
});

await raceEngine.initGroupSession(raceGroup, [bot]);
await initialDrainStarted;
await raceCoordinator.enqueue({
  groupId: raceGroup.id,
  rootMessageId: 'race-root',
  causalMessageId: 'race-root',
  triggerDepth: 0,
  triggerSenderId: 'user',
  triggerSenderName: 'Mamdouh',
  triggerText: 'اختبر عدم ضياع طلب التصريف المتزامن',
  speakerBotId: bot.id,
  idempotencyKey: `${raceGroup.id}:race-root:${bot.id}`,
  modelCallBudget: 1,
});

await raceEngine.initGroupSession(raceGroup, [bot]);
releaseInitialDrain();
for (let index = 0; index < 20 && raceMessages.length === 0; index++) {
  await new Promise(resolve => setTimeout(resolve, 0));
}

assert.equal(raceMessages.length, 1, 'a drain request arriving during an empty drain must be replayed');
assert.equal(raceMessages[0].id, 'group-turn-race-job-1');
assert.equal(raceJobs.get('race-job-1')?.status, 'completed');
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(raceMessages.length, 1, 'the replayed drain must not execute a job twice');

raceEngine.dispose();
console.log('Group engine persistence tests passed.');
