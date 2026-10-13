import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createDuplicateCompanionSession,
  duplicateCompanion,
} from '../services/companionDuplication.js';
import {
  BotMood,
  Dialect,
  MessageRole,
  RelationType,
  type ChatSession,
} from '../types.js';

// --- Test 1: Session Cloning & Settings Integrity ---

const mockOriginalCompanion: ChatSession = {
  id: 'original-companion-123',
  settings: {
    botName: 'سارة الذكية',
    botGender: 'female',
    botAge: 25,
    botBio: 'مهندسة برمجيات بتحب القهوة والكتب.',
    avatarUrl: 'data:image/png;base64,mockAvatarData',
    chattiness: 'high',
    fragmentedMessages: true,
    relationshipWithUser: RelationType.BEST_FRIEND,
    model: 'gemini-2.5-pro',
    thinkingLevel: 'medium',
    boostRafiq: true,
    attachmentStyle: 'secure',
    soulId: 'sarah_archetype',
    soulTraits: {
      chaos: 15,
      empathy: 85,
      slang: 40,
      intellect: 90,
      positivity: 75,
    },
    dialect: Dialect.CAIRO_MODERN,
    voiceConfig: {
      pitch: 1.1,
      speed: 1.0,
      tone: 'sweet',
    },
    visualSeed: {
      palette: 'warm-teal',
      lighting: 'soft-studio',
      tone: 'friendly',
      seed: 'seed-456',
    },
    adaptivePersonality: {
      enabled: true,
      version: 1,
      facets: {
        warmth: { offsetBps: 250, confidenceBps: 8000, evidenceCount: 12 },
        humor: { offsetBps: 150, confidenceBps: 6000, evidenceCount: 8 },
        directness: { offsetBps: -50, confidenceBps: 4000, evidenceCount: 5 },
        expressiveness: { offsetBps: 300, confidenceBps: 7500, evidenceCount: 10 },
        initiative: { offsetBps: 100, confidenceBps: 5000, evidenceCount: 6 },
      },
      evidence: [
        {
          messageId: 'old-msg-1',
          sessionKey: 'old-session',
          facet: 'warmth',
          direction: 1,
          strength: 2,
          confidenceBps: 8000,
          kind: 'repeated_pattern',
          observedAt: new Date(),
        },
      ],
      processedMessageIds: ['old-msg-1', 'old-msg-2'],
      currentSessionKey: 'old-session',
      lastBatchId: 'batch-99',
      dailyDeltaBps: { warmth: 50 },
      runsToday: 3,
      observationCount: 15,
      lastObservedUserAt: new Date(),
      lastRunAt: new Date(),
      summary: 'شخصية دافية ومبادرة',
    },
    cloneProfile: {
      version: 1,
      source: 'whatsapp',
      targetName: 'سارة',
      sourceMessageCount: 1200,
      overallConfidence: 92,
      replyExamples: [
        { context: 'صباح الخير', response: 'صباح الورد! عامل إيه النهاردة؟' },
      ],
      richBio: 'سارة بتحب الصباح الهادي والمذاكرة بدري.',
      speechStyle: {
        toneSummary: 'ودودة وهادية',
        signaturePhrases: ['صباح الورد', 'يا سيدي'],
        responsePatterns: ['بتسأل الأول عن الحال'],
        emojiPatterns: ['🌸', '☕'],
      },
      memorySeeds: [
        {
          text: 'سارة بتحب القهوة السادة كل صباح.',
          category: 'preference',
          salience: 0.9,
          subject: 'persona',
        },
      ],
      analysis: {
        jobId: 'job-analysis-123',
        status: 'ready',
        processedBatches: 5,
        totalBatches: 5,
        capturedMemories: 10,
        capturedEvents: 4,
        capturedSnippets: 6,
        updatedAt: new Date().toISOString(),
      },
    },
  },
  psychology: {
    mood: BotMood.EXCITED,
    energyLevel: 9,
    socialMeter: 8,
    emotionalLedger: 45,
    intimacyLevel: 70,
    currentScenario: 'Deep Talk',
    secretUnlocked: true,
    tier: 'pro',
    isPro: true,
    isBlocked: false,
  },
  lastMessage: 'أشوفك بكرة على خير يا فنان!',
  lastMessageTimestamp: new Date('2026-05-10T20:00:00Z'),
  unreadCount: 4,
};

// 1.1 Duplicating companion with default name
const defaultDuplicate = createDuplicateCompanionSession(mockOriginalCompanion);

assert.notEqual(defaultDuplicate.id, mockOriginalCompanion.id, 'Duplicate must have a unique ID');
assert.equal(defaultDuplicate.settings.botName, 'سارة الذكية (نسخة)', 'Default duplicated name must append (نسخة)');
assert.equal(defaultDuplicate.settings.botGender, 'female');
assert.equal(defaultDuplicate.settings.botAge, 25);
assert.equal(defaultDuplicate.settings.botBio, mockOriginalCompanion.settings.botBio);
assert.equal(defaultDuplicate.settings.avatarUrl, mockOriginalCompanion.settings.avatarUrl);
assert.equal(defaultDuplicate.settings.chattiness, 'high');
assert.equal(defaultDuplicate.settings.fragmentedMessages, true);
assert.equal(defaultDuplicate.settings.relationshipWithUser, RelationType.BEST_FRIEND);
assert.equal(defaultDuplicate.settings.model, 'gemini-2.5-pro');
assert.equal(defaultDuplicate.settings.thinkingLevel, 'medium');
assert.equal(defaultDuplicate.settings.boostRafiq, true);
assert.equal(defaultDuplicate.settings.attachmentStyle, 'secure');
assert.equal(defaultDuplicate.settings.soulId, 'sarah_archetype');
assert.deepEqual(defaultDuplicate.settings.soulTraits, mockOriginalCompanion.settings.soulTraits);
assert.equal(defaultDuplicate.settings.dialect, Dialect.CAIRO_MODERN);
assert.deepEqual(defaultDuplicate.settings.voiceConfig, mockOriginalCompanion.settings.voiceConfig);
assert.deepEqual(defaultDuplicate.settings.visualSeed, mockOriginalCompanion.settings.visualSeed);

// Message isolation: must not carry messages or unread count
assert.equal(defaultDuplicate.lastMessage, undefined, 'Duplicate must have no lastMessage');
assert.equal(defaultDuplicate.unreadCount, 0, 'Duplicate unread count must be 0');
assert.equal(defaultDuplicate.isGroup, undefined, 'Duplicate is not a group');

// Psychological state reset: fresh baseline
assert.equal(defaultDuplicate.psychology?.mood, BotMood.NEUTRAL, 'Mood must reset to neutral baseline');
assert.equal(defaultDuplicate.psychology?.intimacyLevel, 5, 'Intimacy must reset to baseline');
assert.equal(defaultDuplicate.psychology?.secretUnlocked, false, 'Secret unlocked must reset to false');
assert.equal(defaultDuplicate.psychology?.tier, 'pro', 'Tier must be preserved');

// Adaptive personality clean state
assert.deepEqual(
  defaultDuplicate.settings.adaptivePersonality?.facets,
  mockOriginalCompanion.settings.adaptivePersonality?.facets,
  'Calibrated personality facets must be preserved',
);
assert.deepEqual(defaultDuplicate.settings.adaptivePersonality?.evidence, [], 'Evidence from old chat messages must be wiped');
assert.deepEqual(defaultDuplicate.settings.adaptivePersonality?.processedMessageIds, [], 'Processed message IDs must be wiped');
assert.equal(defaultDuplicate.settings.adaptivePersonality?.currentSessionKey, undefined);
assert.equal(defaultDuplicate.settings.adaptivePersonality?.runsToday, 0);

// Clone profile clean state
assert.equal(defaultDuplicate.settings.cloneProfile?.richBio, mockOriginalCompanion.settings.cloneProfile?.richBio);
assert.deepEqual(defaultDuplicate.settings.cloneProfile?.speechStyle, mockOriginalCompanion.settings.cloneProfile?.speechStyle);
assert.equal(defaultDuplicate.settings.cloneProfile?.analysis?.status, 'ready');
assert.notEqual(defaultDuplicate.settings.cloneProfile?.analysis?.jobId, mockOriginalCompanion.settings.cloneProfile?.analysis?.jobId);

// 1.2 Custom name option
const customDuplicate = createDuplicateCompanionSession(mockOriginalCompanion, {
  newName: 'سارة - نسخة تجريبية',
});
assert.equal(customDuplicate.settings.botName, 'سارة - نسخة تجريبية');

// 1.3 Group rejection
const mockGroup: ChatSession = {
  id: 'group-chat-1',
  isGroup: true,
  groupName: 'شلة الصحاب',
  memberIds: ['bot-1', 'bot-2'],
  settings: {
    botName: 'شلة الصحاب',
    botGender: 'male',
    chattiness: 'balanced',
    fragmentedMessages: true,
    soulId: 'amira_default',
  },
};
assert.throws(
  () => createDuplicateCompanionSession(mockGroup),
  /لا يمكن نسخ مجموعة/,
  'Group chats cannot be duplicated as companions',
);

// --- Test 2: Database Persistence & Message Isolation via Adapter ---

let savedChat: ChatSession | null = null;
let savedLegacyEntries: any[] = [];
let savedMemoryRecords: any[] = [];

const mockDbAdapter = {
  saveChatSession: async (chat: ChatSession) => {
    savedChat = chat;
  },
  saveClonedChatSession: async (chat: ChatSession, legacy: any[], records: any[]) => {
    savedChat = chat;
    savedLegacyEntries = legacy;
    savedMemoryRecords = records;
  },
};

// 2.1 Companion with memorySeeds (should use saveClonedChatSession)
const duplicatedWithSeeds = await duplicateCompanion(mockOriginalCompanion, undefined, mockDbAdapter);
assert.ok(savedChat, 'duplicateCompanion must persist the session');
assert.equal(savedChat.id, duplicatedWithSeeds.id);
assert.equal(savedChat.settings.botName, 'سارة الذكية (نسخة)');
assert.equal(savedChat.lastMessage, undefined, 'Duplicated session must have no lastMessage');
assert.equal(savedChat.unreadCount, 0, 'Duplicated session unread count must be 0');
assert.ok(savedLegacyEntries.length > 0, 'Seeds must be re-indexed as legacy memory entries');
assert.ok(savedMemoryRecords.length > 0, 'Seeds must be re-indexed as V6 memory records');
assert.ok(savedMemoryRecords.every(r => r.scopeId === duplicatedWithSeeds.id), 'All re-indexed memories must belong to the new chat id');

// 2.2 Companion without memorySeeds (should use saveChatSession)
const simpleCompanion: ChatSession = {
  ...mockOriginalCompanion,
  id: 'simple-123',
  settings: {
    ...mockOriginalCompanion.settings,
    cloneProfile: undefined,
  },
};
savedChat = null;
const duplicatedSimple = await duplicateCompanion(simpleCompanion, { newName: 'نسخة مخصصة' }, mockDbAdapter);
assert.ok(savedChat, 'duplicateCompanion must persist the simple companion');
assert.equal(savedChat.id, duplicatedSimple.id);
assert.equal(savedChat.settings.botName, 'نسخة مخصصة');
assert.equal(savedChat.lastMessage, undefined);
assert.equal(savedChat.unreadCount, 0);

// --- Test 3: UI Contract & Reachability ---

const drawerSource = await readFile(new URL('../components/WhatsAppContactInfoDrawer.tsx', import.meta.url), 'utf8');
assert.match(drawerSource, /onDuplicateChat\?: \(\) => void/);
assert.match(drawerSource, /<Copy/);
assert.match(drawerSource, /نسخ الرفيق \(الإعدادات فقط\)/);
assert.match(drawerSource, /إنشاء رفيق جديد بنفس الإعدادات وبدون أي رسائل سابقة/);

const sidebarSource = await readFile(new URL('../components/Sidebar.tsx', import.meta.url), 'utf8');
assert.match(sidebarSource, /onDuplicateChat\?: \(chat: ChatSession\) => void/);
assert.match(sidebarSource, /!chat\.isGroup && onDuplicateChat/);
assert.match(sidebarSource, /title="نسخ الرفيق \(الإعدادات فقط\)"/);
assert.match(sidebarSource, /aria-label="نسخ الرفيق"/);

const chatInterfaceSource = await readFile(new URL('../components/ChatInterface.tsx', import.meta.url), 'utf8');
assert.match(chatInterfaceSource, /onDuplicate\?: \(\) => void/);
assert.match(chatInterfaceSource, /!isGroup && onDuplicate/);
assert.match(chatInterfaceSource, /نسخ الرفيق \(الإعدادات فقط\)/);
assert.match(chatInterfaceSource, /onDuplicateChat=\{!isGroup && onDuplicate/);

const appSource = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');
assert.match(appSource, /import \{ duplicateCompanion \} from '\.\/services\/companionDuplication\.js'/);
assert.match(appSource, /const handleDuplicateChat = async/);
assert.match(appSource, /onDuplicateChat=\{chat => void handleDuplicateChat\(chat\)\}/);
assert.match(appSource, /onDuplicate=\{\(\) => void handleDuplicateChat\(activeChat\)\}/);

console.log('Companion duplication tests passed successfully.');
