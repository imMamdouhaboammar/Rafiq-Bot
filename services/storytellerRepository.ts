import type { StorytellerStory } from '../contracts/storyteller.js';

const STORAGE_PREFIX = 'rafiq_storyteller_story_';
const INDEX_KEY = 'rafiq_storyteller_index';
const DB_NAME = 'rafiq_storyteller_db';
const DB_VERSION = 1;
const STORE_NAME = 'stories';

const memoryStore = new Map<string, StorytellerStory>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

const getIndexedDB = (): Promise<IDBDatabase | null> => {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          console.warn('[StorytellerRepo] IndexedDB open error, falling back to localStorage');
          resolve(null);
        };
      } catch (e) {
        console.warn('[StorytellerRepo] IndexedDB init exception:', e);
        resolve(null);
      }
    });
  }
  return dbPromise;
};

const getStoryIds = (): string[] => {
  try {
    if (typeof localStorage === 'undefined') return Array.from(memoryStore.keys());
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : Array.from(memoryStore.keys());
  } catch {
    return Array.from(memoryStore.keys());
  }
};

const setStoryIds = (ids: string[]): void => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(INDEX_KEY, JSON.stringify(ids));
    }
  } catch {}
};

export const saveStory = async (story: StorytellerStory): Promise<void> => {
  const cloned = structuredClone(story);
  cloned.updatedAt = new Date().toISOString();
  memoryStore.set(cloned.id, cloned);

  // 1. Primary Durable Persistence: IndexedDB
  try {
    const db = await getIndexedDB();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.put(cloned);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  } catch (err) {
    console.warn('[StorytellerRepo] IndexedDB save warning:', err);
  }

  // 2. Secondary Fast Sync: localStorage
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`${STORAGE_PREFIX}${cloned.id}`, JSON.stringify(cloned));
      const ids = getStoryIds();
      if (!ids.includes(cloned.id)) {
        ids.unshift(cloned.id);
        setStoryIds(ids);
      }
    }
  } catch (err) {
    console.warn('[StorytellerRepo] LocalStorage save warning (quota):', err);
  }
};

export const getStory = async (id: string): Promise<StorytellerStory | undefined> => {
  const cached = memoryStore.get(id);
  if (cached) return structuredClone(cached);

  // 1. Check IndexedDB
  try {
    const db = await getIndexedDB();
    if (db) {
      const fromIDB = await new Promise<StorytellerStory | undefined>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(id);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      });
      if (fromIDB) {
        memoryStore.set(id, fromIDB);
        return structuredClone(fromIDB);
      }
    }
  } catch (err) {
    console.warn('[StorytellerRepo] IndexedDB read warning:', err);
  }

  // 2. Fallback to localStorage
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
      if (raw) {
        const parsed = JSON.parse(raw) as StorytellerStory;
        memoryStore.set(id, parsed);
        // Silently sync to IndexedDB
        void saveStory(parsed);
        return structuredClone(parsed);
      }
    }
  } catch (err) {
    console.warn('[StorytellerRepo] LocalStorage read warning:', err);
  }
  return undefined;
};

export const listStories = async (): Promise<StorytellerStory[]> => {
  const storyMap = new Map<string, StorytellerStory>();

  // 1. Load from IndexedDB
  try {
    const db = await getIndexedDB();
    if (db) {
      const idbStories = await new Promise<StorytellerStory[]>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch {
          resolve([]);
        }
      });
      for (const s of idbStories) {
        storyMap.set(s.id, s);
        memoryStore.set(s.id, s);
      }
    }
  } catch (err) {
    console.warn('[StorytellerRepo] IndexedDB list error:', err);
  }

  // 2. Merge with localStorage items to ensure legacy or offline stories are never lost
  try {
    const ids = getStoryIds();
    for (const id of ids) {
      if (!storyMap.has(id)) {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(`${STORAGE_PREFIX}${id}`) : null;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as StorytellerStory;
            storyMap.set(id, parsed);
            memoryStore.set(id, parsed);
            // Migrate to IndexedDB permanently
            void saveStory(parsed);
          } catch {}
        }
      }
    }
  } catch (err) {
    console.warn('[StorytellerRepo] LocalStorage merge warning:', err);
  }

  // Also include anything in memoryStore
  for (const [id, story] of memoryStore.entries()) {
    if (!storyMap.has(id)) {
      storyMap.set(id, story);
    }
  }

  const list = Array.from(storyMap.values());
  // Sort by updatedAt descending
  return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
};

export const deleteStory = async (id: string): Promise<void> => {
  memoryStore.delete(id);

  // Remove from IndexedDB
  try {
    const db = await getIndexedDB();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.delete(id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  } catch (err) {
    console.warn('[StorytellerRepo] IndexedDB delete warning:', err);
  }

  // Remove from localStorage
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(`${STORAGE_PREFIX}${id}`);
      const ids = getStoryIds().filter(existingId => existingId !== id);
      setStoryIds(ids);
    }
  } catch (err) {
    console.warn('[StorytellerRepo] LocalStorage remove warning:', err);
  }
};

export const exportStoryAsMarkdown = (story: StorytellerStory): string => {
  const lines: string[] = [
    `# ${story.title}`,
    `> **${story.logline}**`,
    '',
    `- **الأسلوب الأدبي:** ${story.styleLabel}`,
    `- **عدد الفصول:** ${story.chapters.length} من ${story.targetChapters}`,
    `- **تاريخ التأليف:** ${new Date(story.createdAt).toLocaleDateString('ar-EG')}`,
    '',
    '## سياق القصة وفكرتها الأساسية',
    story.premise,
    '',
    '## بطاقة الأبطال والشخصيات',
    ...story.characters.map(c => `- **${c.name}** (${c.role}): ${c.description}`),
    '',
    '---',
    '',
  ];

  for (const chapter of story.chapters) {
    lines.push(
      `## الفصل ${chapter.chapterNumber}: ${chapter.title}`,
      '',
      chapter.content,
      '',
      chapter.cliffhanger ? `*— ${chapter.cliffhanger}*` : '',
      '',
      '---',
      '',
    );
  }

  return lines.join('\n');
};

export const exportStoryAsText = (story: StorytellerStory): string => {
  const lines: string[] = [
    `========================================`,
    `               ${story.title}`,
    `========================================`,
    `${story.logline}`,
    `الأسلوب: ${story.styleLabel} | الفصول: ${story.chapters.length}/${story.targetChapters}`,
    `========================================\n`,
  ];

  for (const chapter of story.chapters) {
    lines.push(
      `\n[ الفصل ${chapter.chapterNumber}: ${chapter.title} ]\n`,
      chapter.content,
      chapter.cliffhanger ? `\n-- ${chapter.cliffhanger}\n` : '',
      `\n----------------------------------------\n`,
    );
  }

  return lines.join('\n');
};

export const downloadStoryFile = (content: string, filename: string, mimeType = 'text/plain;charset=utf-8'): void => {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};
