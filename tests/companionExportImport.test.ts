import assert from 'node:assert/strict';
import {
  COMPANION_PACKAGE_FORMAT,
  COMPANION_PACKAGE_VERSION,
  exportCompanionPackage,
  importCompanionPackage,
  sanitizeMessagesWithoutMedia,
  validateCompanionPackage,
  validateLegacyExportFile,
  type RafiqCompanionPackage,
} from '../services/chatTransfer.js';
import {
  BotMood,
  Dialect,
  MessageRole,
  RelationType,
  type ChatMessage,
  type ChatSession,
  type MemoryEntry,
} from '../types.js';

// --- Test Data Fixtures ---

const mockOriginalSession: ChatSession = {
  id: 'orig-companion-101',
  settings: {
    botName: 'نورا الساحرة',
    botGender: 'female',
    botAge: 23,
    botBio: 'عاشقة للرسم والمزيكا وبتتكلم مصري خفيف ولذيذ.',
    avatarUrl: 'data:image/png;base64,mockAvatarUrl',
    chattiness: 'high',
    fragmentedMessages: true,
    relationshipWithUser: RelationType.FRIEND,
    model: 'gemini-2.5-flash',
    thinkingLevel: 'low',
    boostRafiq: true,
    attachmentStyle: 'secure',
    soulId: 'nora_soul',
    soulTraits: {
      chaos: 20,
      empathy: 90,
      slang: 50,
      intellect: 80,
      positivity: 85,
    },
    dialect: Dialect.CAIRO_MODERN,
    voiceConfig: {
      pitch: 1.0,
      speed: 1.0,
      tone: 'sweet',
    },
    visualSeed: {
      palette: 'emerald',
      lighting: 'ambient',
      tone: 'cheerful',
      seed: 'seed-789',
    },
    adaptivePersonality: {
      enabled: true,
      version: 2,
      facets: {
        warmth: { offsetBps: 200, confidenceBps: 7000, evidenceCount: 5 },
        humor: { offsetBps: 100, confidenceBps: 5000, evidenceCount: 3 },
        directness: { offsetBps: 0, confidenceBps: 3000, evidenceCount: 2 },
        expressiveness: { offsetBps: 150, confidenceBps: 6000, evidenceCount: 4 },
        initiative: { offsetBps: 50, confidenceBps: 4000, evidenceCount: 2 },
      },
      evidence: [
        {
          messageId: 'msg-ev-1',
          sessionKey: 'sess-1',
          facet: 'warmth',
          direction: 1,
          strength: 2,
          confidenceBps: 7000,
          kind: 'repeated_pattern',
          observedAt: new Date(),
        },
      ],
      processedMessageIds: ['msg-1', 'msg-2'],
      currentSessionKey: 'sess-1',
      lastBatchId: 'batch-1',
      dailyDeltaBps: { warmth: 30 },
      runsToday: 2,
      observationCount: 8,
      lastObservedUserAt: new Date(),
      lastRunAt: new Date(),
      summary: 'أسلوبها هادي وبتحب تهتم بالتفاصيل',
    },
    cloneProfile: {
      version: 1,
      source: 'whatsapp',
      targetName: 'نورا',
      sourceMessageCount: 500,
      overallConfidence: 88,
      replyExamples: [
        { context: 'إيه الأخبار؟', response: 'الحمد لله كلو تمام، إنت عامل إيه؟' },
      ],
      richBio: 'نورا إنسانة بتحب القراءة والقهوة.',
      speechStyle: {
        toneSummary: 'لطيفة وعفوية',
        signaturePhrases: ['يا باشا', 'تمام يا غالي'],
        responsePatterns: ['بتطمن قبل أي كلام'],
        emojiPatterns: ['😊', '☕'],
      },
      memorySeeds: [
        {
          text: 'بتحب تشرب شاي بلبن الصبح بدري',
          category: 'preference',
          salience: 0.8,
        },
      ],
      analysis: {
        jobId: 'job-orig',
        status: 'ready',
        processedBatches: 5,
        totalBatches: 5,
        capturedMemories: 1,
        capturedEvents: 0,
        capturedSnippets: 0,
        updatedAt: new Date().toISOString(),
      },
    },
  },
  psychology: {
    mood: BotMood.HAPPY,
    intimacyLevel: 45,
    socialMeter: 8,
    energyLevel: 9,
    emotionalLedger: 25,
    currentScenario: 'Deep Conversation',
    lastInteractionTime: new Date('2026-10-08T12:00:00Z'),
    secretUnlocked: true,
    hungerLevel: 10,
    financialStress: 20,
    sleepiness: 5,
    tier: 'pro',
    isPro: true,
    isBlocked: false,
  },
  lastMessage: 'تمام يا غالي، نتقابل بكرة؟',
  lastMessageTimestamp: new Date('2026-10-08T12:30:00Z'),
  unreadCount: 2,
};

const mockMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    chatId: 'orig-companion-101',
    role: MessageRole.USER,
    text: 'صباح الخير يا نورا، شوفي الصورة دي كده',
    timestamp: new Date('2026-10-08T10:00:00Z'),
    attachments: [
      {
        mimeType: 'image/jpeg',
        previewUrl: 'blob:http://localhost:3000/some-blob-url',
        base64: '/9j/4AAQSkZJRgABAQEASABIAAD/heavyBase64DataString...',
        fileName: 'nature.jpg',
        fileSize: 102400,
        category: 'image',
      },
    ],
  },
  {
    id: 'msg-2',
    chatId: 'orig-companion-101',
    role: MessageRole.MODEL,
    text: 'الله، ما شاء الله حلوة جداً وهادية! 🌸',
    timestamp: new Date('2026-10-08T10:01:00Z'),
    replyTo: {
      id: 'msg-1',
      text: 'صباح الخير يا نورا، شوفي الصورة دي كده',
      senderName: 'المستخدم',
      senderId: 'user',
    },
    reactions: [
      { emoji: '❤️', senderId: 'user', senderName: 'أنا' },
    ],
  },
];

const mockMemories: MemoryEntry[] = [
  {
    id: 'mem-1-orig-companion-101',
    chatId: 'orig-companion-101',
    sourceMessageId: 'msg-1',
    sourceRole: MessageRole.USER,
    text: 'بيحب المناظر الطبيعية وشروق الشمس',
    summary: 'تفضيل المناظر الطبيعية',
    normalizedText: 'بيحب المناظر الطبيعية',
    keywords: ['مناظر', 'شروق', 'طبيعة'],
    category: 'preference',
    salience: 0.9,
    createdAt: new Date('2026-10-08T10:02:00Z'),
    updatedAt: new Date('2026-10-08T10:02:00Z'),
  },
];

// In-Memory DB Adapter Mock for Unit Testing
function createMockDbAdapter() {
  const sessions = new Map<string, ChatSession>([[mockOriginalSession.id, mockOriginalSession]]);
  const messages = new Map<string, ChatMessage[]>();
  messages.set(mockOriginalSession.id, [...mockMessages]);
  const memories = new Map<string, MemoryEntry[]>();
  memories.set(mockOriginalSession.id, [...mockMemories]);
  const clonedSessionsSaved: ChatSession[] = [];

  return {
    sessions,
    messages,
    memories,
    clonedSessionsSaved,
    adapter: {
      getChatSession: async (id: string) => sessions.get(id),
      getMessagesForChat: async (id: string) => messages.get(id) || [],
      getMemoryEntriesForChat: async (id: string) => memories.get(id) || [],
      getUserProfile: async () => ({
        name: 'ممدوح',
        gender: 'male' as const,
        age: 28,
        tier: 'pro' as const,
        isPro: true,
      }),
      saveChatSession: async (session: ChatSession) => {
        sessions.set(session.id, session);
      },
      saveClonedChatSession: async (session: ChatSession, legacyEntries: any[], memoryRecords: any[]) => {
        sessions.set(session.id, session);
        clonedSessionsSaved.push(session);
      },
      saveMessage: async (msg: ChatMessage) => {
        const list = messages.get(msg.chatId) || [];
        list.push(msg);
        messages.set(msg.chatId, list);
      },
      saveGroupMessage: async (msg: ChatMessage) => {
        const list = messages.get(msg.chatId) || [];
        list.push(msg);
        messages.set(msg.chatId, list);
      },
      bulkUpsertMemoryEntries: async (entries: MemoryEntry[]) => {
        for (const entry of entries) {
          const list = memories.get(entry.chatId) || [];
          list.push(entry);
          memories.set(entry.chatId, list);
        }
      },
    },
  };
}

async function runTests() {
  console.log('Running Companion Export / Import tests...');

  // --- Test 1: Sanitize messages strips all media base64 & blob previews ---
  {
    const sanitized = sanitizeMessagesWithoutMedia(mockMessages);
    assert.equal(sanitized.length, 2);
    
    // Message 1 had an image attachment with base64 and blob URL
    const att = sanitized[0].attachments?.[0];
    assert.ok(att, 'Attachment should still exist with metadata');
    assert.equal((att as any).base64, undefined, 'base64 must be completely stripped');
    assert.equal((att as any).file, undefined, 'file reference must be undefined');
    assert.equal(att.previewUrl, '', 'previewUrl must be empty string');
    assert.equal(att.fileName, 'nature.jpg', 'fileName metadata is preserved');
    assert.equal(att.mimeType, 'image/jpeg', 'mimeType metadata is preserved');
    assert.equal(att.category, 'image', 'category metadata is preserved');

    // Message 2 had replyTo and reactions
    assert.equal(sanitized[1].text, 'الله، ما شاء الله حلوة جداً وهادية! 🌸');
    assert.equal(sanitized[1].replyTo?.id, 'msg-1');
    assert.equal(sanitized[1].reactions?.[0]?.emoji, '❤️');
  }

  // --- Test 2: Export Companion WITH CONVERSATION (Without Media) ---
  {
    const { adapter } = createMockDbAdapter();
    const result = await exportCompanionPackage(mockOriginalSession.id, {
      mode: 'with_messages',
      dbAdapter: adapter,
    });

    assert.ok(result.fileName.includes('_chat_no_media_'), 'Filename should indicate chat without media');
    assert.ok(result.fileName.endsWith('.rafiq.json'), 'Filename should end with .rafiq.json');
    assert.equal(result.packageData.format, COMPANION_PACKAGE_FORMAT);
    assert.equal(result.packageData.version, COMPANION_PACKAGE_VERSION);
    assert.equal(result.packageData.exportMode, 'with_messages');
    assert.equal(result.packageData.metadata.features.includesConversation, true);
    assert.equal(result.packageData.metadata.features.includesMedia, false);
    assert.equal(result.packageData.metadata.counts.messages, 2);
    assert.equal(result.packageData.metadata.counts.memories, 1);
    assert.equal(result.packageData.data.messages.length, 2);

    // Verify media was stripped in export output
    const exportedAtt = result.packageData.data.messages[0].attachments?.[0];
    assert.equal(exportedAtt?.base64, undefined);
    assert.equal(exportedAtt?.previewUrl, '');

    // Validate schema
    assert.ok(validateCompanionPackage(result.packageData), 'Package must pass Zod schema validation');
  }

  // --- Test 3: Export Companion SETTINGS ONLY (Without Conversation) ---
  {
    const { adapter } = createMockDbAdapter();
    const result = await exportCompanionPackage(mockOriginalSession.id, {
      mode: 'settings_only',
      dbAdapter: adapter,
    });

    assert.ok(result.fileName.includes('_settings_'), 'Filename should indicate settings only');
    assert.equal(result.packageData.exportMode, 'settings_only');
    assert.equal(result.packageData.metadata.features.includesConversation, false);
    assert.equal(result.packageData.metadata.features.includesMedia, false);
    assert.equal(result.packageData.metadata.counts.messages, 0);
    assert.equal(result.packageData.metadata.counts.memories, 0);

    // Messages and conversation memories must be empty
    assert.equal(result.packageData.data.messages.length, 0);
    assert.equal(result.packageData.data.memoryEntries.length, 0);

    // Settings must be preserved
    const settings = result.packageData.data.chatSession.settings;
    assert.equal(settings.botName, 'نورا الساحرة');
    assert.equal(settings.dialect, Dialect.CAIRO_MODERN);
    assert.equal(settings.soulTraits.empathy, 90);
    assert.equal(settings.voiceConfig.tone, 'sweet');

    // Clone blueprint memory seeds are preserved inside settings
    assert.equal(settings.cloneProfile?.memorySeeds?.length, 1);
    assert.equal(settings.cloneProfile?.memorySeeds?.[0]?.text, 'بتحب تشرب شاي بلبن الصبح بدري');

    // Adaptive personality evidence & session processed IDs must be wiped clean
    assert.deepEqual(settings.adaptivePersonality.evidence, []);
    assert.deepEqual(settings.adaptivePersonality.processedMessageIds, []);
    assert.equal(settings.adaptivePersonality.runsToday, 0);
    // While learned offsets are preserved
    assert.equal(settings.adaptivePersonality.facets.warmth.offsetBps, 200);

    // Psychology must be reset to neutral baseline
    const psychology = result.packageData.data.chatSession.psychology;
    assert.equal(psychology.mood, BotMood.NEUTRAL);
    assert.equal(psychology.intimacyLevel, 5);

    // Validate schema
    assert.ok(validateCompanionPackage(result.packageData), 'Package must pass Zod schema validation');
  }

  // --- Test 4: Import Companion WITH CONVERSATION ---
  {
    const { adapter, sessions, messages, memories } = createMockDbAdapter();

    // Generate package
    const exported = await exportCompanionPackage(mockOriginalSession.id, {
      mode: 'with_messages',
      dbAdapter: adapter,
    });

    // Create File mock
    const file = new File(
      [JSON.stringify(exported.packageData)],
      exported.fileName,
      { type: 'application/json' },
    );

    const importResult = await importCompanionPackage(file, adapter);

    assert.notEqual(importResult.chatSession.id, mockOriginalSession.id, 'Imported chat must have new unique ID');
    assert.equal(importResult.exportMode, 'with_messages');
    assert.equal(importResult.messageCount, 2);
    assert.equal(importResult.memoryCount, 1);
    assert.equal(importResult.companionName, 'نورا الساحرة');

    // Verify session stored in DB
    const storedSession = sessions.get(importResult.chatSession.id);
    assert.ok(storedSession);
    assert.equal(storedSession.settings.botName, 'نورا الساحرة');

    // Verify messages stored in DB with new chatId
    const storedMessages = messages.get(importResult.chatSession.id);
    assert.ok(storedMessages);
    assert.equal(storedMessages.length, 2);
    assert.equal(storedMessages[0].chatId, importResult.chatSession.id);
    assert.ok(storedMessages[0].timestamp instanceof Date);

    // Verify memory entries stored in DB with new chatId
    const storedMemories = memories.get(importResult.chatSession.id);
    assert.ok(storedMemories);
    assert.equal(storedMemories.length, 1);
    assert.equal(storedMemories[0].chatId, importResult.chatSession.id);
  }

  // --- Test 5: Import Companion SETTINGS ONLY ---
  {
    const { adapter, sessions, messages, clonedSessionsSaved } = createMockDbAdapter();

    const exported = await exportCompanionPackage(mockOriginalSession.id, {
      mode: 'settings_only',
      dbAdapter: adapter,
    });

    const file = new File(
      [JSON.stringify(exported.packageData)],
      exported.fileName,
      { type: 'application/json' },
    );

    const importResult = await importCompanionPackage(file, adapter);

    assert.notEqual(importResult.chatSession.id, mockOriginalSession.id);
    assert.equal(importResult.exportMode, 'settings_only');
    assert.equal(importResult.messageCount, 0, 'Must have zero messages');
    assert.equal(importResult.memoryCount, 1, 'Re-indexed blueprint seed');

    // Check session in DB
    const storedSession = sessions.get(importResult.chatSession.id);
    assert.ok(storedSession);
    assert.equal(storedSession.settings.botName, 'نورا الساحرة');
    assert.equal(storedSession.lastMessage, undefined);

    // Check messages in DB: no messages should be saved
    const storedMessages = messages.get(importResult.chatSession.id);
    assert.equal(storedMessages, undefined, 'No conversation messages should be created');

    // Cloned blueprint was saved via saveClonedChatSession
    assert.equal(clonedSessionsSaved.length, 1);
  }

  // --- Test 6: Backward Compatibility with Legacy v1 .rafiq files ---
  {
    const { adapter, sessions, messages } = createMockDbAdapter();

    const legacyFileContent = {
      format: 'rafiq-chat-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      source: 'desktop',
      data: {
        chatSession: {
          ...mockOriginalSession,
          id: 'legacy-session-99',
          settings: {
            ...mockOriginalSession.settings,
            botName: 'رفيق قديم v1',
          },
        },
        messages: mockMessages,
        memoryEntries: mockMemories,
        userProfile: null,
      },
    };

    assert.ok(validateLegacyExportFile(legacyFileContent), 'Should recognize v1 legacy format');

    const file = new File(
      [JSON.stringify(legacyFileContent)],
      'old_export.rafiq',
      { type: 'application/json' },
    );

    const importResult = await importCompanionPackage(file, adapter);

    assert.notEqual(importResult.chatSession.id, 'legacy-session-99');
    assert.equal(importResult.companionName, 'رفيق قديم v1');
    assert.equal(importResult.messageCount, 2);

    const storedSession = sessions.get(importResult.chatSession.id);
    assert.ok(storedSession);
    assert.equal(storedSession.settings.botName, 'رفيق قديم v1');

    const storedMessages = messages.get(importResult.chatSession.id);
    assert.equal(storedMessages?.length, 2);
  }

  // --- Test 7: Error handling for corrupted or invalid files ---
  {
    const { adapter } = createMockDbAdapter();

    // Invalid JSON
    const badJsonFile = new File(['not json at all'], 'corrupt.rafiq');
    await assert.rejects(
      async () => importCompanionPackage(badJsonFile, adapter),
      /الملف ليس بصيغة JSON صالحة/,
    );

    // Valid JSON but completely unrelated structure
    const unrelatedFile = new File([JSON.stringify({ hello: 'world' })], 'other.json');
    await assert.rejects(
      async () => importCompanionPackage(unrelatedFile, adapter),
      /الملف ليس حزمة رفيق صالحة/,
    );
  }

  console.log('All Companion Export / Import tests passed successfully! ✅');
}

void runTests();
