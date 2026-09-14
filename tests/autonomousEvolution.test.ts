import './setupEnv.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { db } from '../services/db.js';
import {
  cancelBackgroundSelfEvolution,
  normalizeAutonomousMood,
  runSelfEvolutionStep,
  triggerBackgroundSelfEvolution,
} from '../services/autonomousEvolution.server.js';
import { BotMood, MessageRole, type ChatMessage, type ChatSession } from '../types.js';
import { loadLocalStore } from '../services/redisVectorMemory.server.js';

Object.defineProperty(GoogleGenAI.prototype, 'models', {
  get() {
    return {
      embedContent: async (params: any) => {
        const text = String(params.contents || '');
        const dimension = params.config?.outputDimensionality || 768;
        const values = new Array(dimension).fill(0);
        for (let index = 0; index < Math.min(text.length, dimension); index++) {
          values[index] = text.charCodeAt(index) / 255;
        }
        const norm = Math.sqrt(values.reduce((total, value) => total + value * value, 0));
        if (norm > 0) {
          for (let index = 0; index < values.length; index++) values[index] /= norm;
        }
        return { embeddings: [{ values }] };
      },
      generateContent: async (params: any) => {
        const prompt = String(params.contents?.[0]?.parts?.[0]?.text || '');
        if (prompt.includes('gradual background persona learning')) {
          return {
            text: JSON.stringify({
              consolidatedFacts: [
                { text: 'أحمد بيحب الكشري والملوخية', category: 'preference', salience: 8 },
                { text: 'أحمد ناوي يتعلم لغة برمجة جديدة', category: 'fact', salience: 6 },
              ],
              psychologyUpdate: {
                intimacyChange: 12,
                moodUpdate: 'happy',
                reason: 'المحادثة فيها مشاركة واضحة ومستمرة',
              },
              mistakesToAvoid: ['متفتحش موضوع الدايت بدون سبب'],
              curiosityGaps: ['سر خلطة الكشري المصري'],
            }),
          };
        }
        return { text: 'رد افتراضي' };
      },
    };
  },
  set() {},
  configurable: true,
});

const testChatId = 'test-chat-evolution-777';
const localStorePath = path.join(process.cwd(), 'tmp', 'local_vector_memory.json');
let originalStoreBackup: string | null = null;
let savedChats: ChatSession[] = [];
let savedMessages: ChatMessage[] = [];

const mockDatabase = () => {
  db.chats = {
    get: async (id: string) => savedChats.find(chat => chat.id === id),
    put: async (session: ChatSession) => {
      const index = savedChats.findIndex(chat => chat.id === session.id);
      if (index >= 0) savedChats[index] = session;
      else savedChats.push(session);
      return session.id;
    },
  } as any;

  db.messages = {
    where: (field: string) => ({
      equals: (value: unknown) => ({
        sortBy: async (sortField: keyof ChatMessage) => (
          field === 'chatId'
            ? savedMessages
                .filter(message => message.chatId === value)
                .sort((left, right) => new Date(left[sortField] as any).getTime() - new Date(right[sortField] as any).getTime())
            : []
        ),
      }),
    }),
  } as any;
  db.groupMessages = db.messages;
};

const setup = async () => {
  mockDatabase();
  savedChats = [{
    id: testChatId,
    isGroup: false,
    settings: {
      botName: 'رفيق',
      botGender: 'male',
      chattiness: 'balanced',
      fragmentedMessages: true,
      soulId: 'amira_default',
    },
    psychology: {
      mood: BotMood.NEUTRAL,
      energyLevel: 5,
      socialMeter: 5,
      emotionalLedger: 10,
      currentScenario: 'Standard Routine',
      intimacyLevel: 20,
      secretUnlocked: false,
    },
  }];
  savedMessages = [
    {
      id: 'msg-1',
      chatId: testChatId,
      role: MessageRole.USER,
      text: 'أنا بحب الكشري والملوخية ونفسي أتعلم برمجة',
      timestamp: new Date('2026-06-27T10:00:00.000Z'),
    },
    {
      id: 'msg-2',
      chatId: testChatId,
      role: MessageRole.MODEL,
      text: 'الكشري المصري ملوش حل',
      timestamp: new Date('2026-06-27T10:01:00.000Z'),
    },
  ];

  if (fs.existsSync(localStorePath)) {
    originalStoreBackup = await fs.promises.readFile(localStorePath, 'utf8');
    await fs.promises.unlink(localStorePath);
  }
  const store = await loadLocalStore();
  delete store[testChatId];
};

const teardown = async () => {
  if (fs.existsSync(localStorePath)) await fs.promises.unlink(localStorePath);
  if (originalStoreBackup !== null) {
    await fs.promises.mkdir(path.dirname(localStorePath), { recursive: true });
    await fs.promises.writeFile(localStorePath, originalStoreBackup, 'utf8');
  }
};

assert.equal(normalizeAutonomousMood('hangry'), BotMood.NEUTRAL);
assert.equal(normalizeAutonomousMood('broke'), BotMood.NEUTRAL);
assert.equal(normalizeAutonomousMood('happy'), BotMood.HAPPY);
assert.equal(normalizeAutonomousMood('invented-mood'), null);

await setup();
try {
  await runSelfEvolutionStep(testChatId);

  const updatedSession = savedChats.find(chat => chat.id === testChatId)!;
  assert.equal(updatedSession.psychology?.mood, BotMood.HAPPY);
  assert.equal(
    updatedSession.psychology?.intimacyLevel,
    25,
    'a single background run must clamp the requested +12 change to +5',
  );
  assert.equal(updatedSession.psychology?.lastMoodChangeReason, 'المحادثة فيها مشاركة واضحة ومستمرة');
  assert.equal(updatedSession.psychology?.hungerLevel, undefined);
  assert.equal(updatedSession.psychology?.financialStress, undefined);
  assert.equal(updatedSession.psychology?.sleepiness, undefined);

  const records = (await loadLocalStore())[testChatId];
  assert.ok(records.length >= 3, 'facts and correction evidence should be indexed');
  assert.ok(records.some(record => record.category === 'preference'));
  assert.ok(records.some(record => record.category === 'gotcha'));
  assert.equal(
    records.some(record => record.text.includes('البصل المقرمش')),
    false,
    'an unavailable search provider must not create fabricated knowledge',
  );

  assert.equal(await triggerBackgroundSelfEvolution(testChatId), true);
  assert.equal(cancelBackgroundSelfEvolution(testChatId), true);
  assert.equal(cancelBackgroundSelfEvolution(testChatId), false);
} finally {
  await teardown();
}

console.log('Autonomous evolution tests passed.');
