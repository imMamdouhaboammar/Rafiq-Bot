import { describe, expect, it } from 'bun:test';
import {
  compileInsideJokesPrompt,
  getInsideJokes,
  saveInsideJoke,
  type InsideJoke,
} from '../services/insideJokesLedger.js';

describe('Inside Jokes Ledger', () => {
  it('compiles inside jokes prompt accurately', () => {
    const jokes: InsideJoke[] = [
      {
        id: '1',
        chatId: 'chat-1',
        triggerKeywords: ['شاي', 'قهوة'],
        punchlineOrReference: 'شاي بلبن الساعة ٣ الفجر',
        context: 'هزار على السهر المبالغ فيه',
        createdAt: new Date().toISOString(),
      },
    ];

    const prompt = compileInsideJokesPrompt(jokes);
    expect(prompt).toContain('SHARED INSIDE JOKES & RUNNING BANTER');
    expect(prompt).toContain('شاي بلبن الساعة ٣ الفجر');
    expect(prompt).toContain('هزار على السهر المبالغ فيه');
  });

  it('filters jokes by relevant keywords if user text matches', () => {
    const jokes: InsideJoke[] = [
      {
        id: '1',
        chatId: 'chat-1',
        triggerKeywords: ['مدير', 'شغل'],
        punchlineOrReference: 'المدير عبقري زمانه',
        context: 'سخرية من القرارات الغريبة في الشغل',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        chatId: 'chat-1',
        triggerKeywords: ['كورة', 'ماتش'],
        punchlineOrReference: 'كلاكيت عاشر مرة للأهلي',
        context: 'تحفيل كروي',
        createdAt: new Date().toISOString(),
      },
    ];

    const prompt = compileInsideJokesPrompt(jokes, 'المدير جيه النهاردة');
    expect(prompt).toContain('المدير عبقري زمانه');
    expect(prompt).not.toContain('كلاكيت عاشر مرة للأهلي');
  });

  it('saves and retrieves inside jokes in memory', () => {
    const joke: InsideJoke = {
      id: 'test-joke-1',
      chatId: 'chat-test-mem',
      triggerKeywords: ['فطير'],
      punchlineOrReference: 'فطيرة مشلتتة بعد الجيم',
      context: 'تخريب الدايت المشترك',
      createdAt: new Date().toISOString(),
    };

    saveInsideJoke(joke);
    const retrieved = getInsideJokes('chat-test-mem');
    expect(retrieved.length).toBe(1);
    expect(retrieved[0].punchlineOrReference).toBe('فطيرة مشلتتة بعد الجيم');
  });
});
