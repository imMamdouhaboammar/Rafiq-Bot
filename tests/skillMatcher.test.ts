import { test, expect } from 'bun:test';
import { BUILTIN_SKILLS } from '../services/skillRegistry.js';
import { matchActiveSkill, stripSkillSlashCommand } from '../services/skillMatcher.js';

test('SkillMatcher: matches Egyptian fitness keywords', () => {
  const message = 'أنا النهاردة أكلت كشري كتير وعايز أعرف هحرقه إزاي في الجيم';
  const match = matchActiveSkill(message, BUILTIN_SKILLS);

  expect(match).not.toBeNull();
  expect(match?.skill.id).toBe('baladi-fitness');
  expect(match?.matchedBy).toBe('keyword');
});

test('SkillMatcher: matches Arabic diacritics without interference', () => {
  const message = 'عِنْدِي تَمرينٌ شَاقٌّ في الجيم';
  const match = matchActiveSkill(message, BUILTIN_SKILLS);

  expect(match).not.toBeNull();
  expect(match?.skill.id).toBe('baladi-fitness');
});

test('SkillMatcher: matches 3 AM venting keywords', () => {
  const message = 'أنا مخنوق أوي ومش قادر أكمل وحاسس بوحدة فظيعة';
  const match = matchActiveSkill(message, BUILTIN_SKILLS);

  expect(match).not.toBeNull();
  expect(match?.skill.id).toBe('deep-venting');
  expect(match?.matchedBy).toBe('keyword');
});

test('SkillMatcher: matches outings and spots keywords', () => {
  const message = 'تعرف كافيه رايق في المعادي أذاكر فيه؟';
  const match = matchActiveSkill(message, BUILTIN_SKILLS);

  expect(match).not.toBeNull();
  expect(match?.skill.id).toBe('outings-hunter');
  expect(match?.matchedBy).toBe('keyword');
});

test('SkillMatcher: resolves English and Arabic slash commands', () => {
  const englishCmd = '/coach ضربت فول وطعمية';
  const matchEn = matchActiveSkill(englishCmd, BUILTIN_SKILLS);
  expect(matchEn?.skill.id).toBe('baladi-fitness');
  expect(matchEn?.matchedBy).toBe('slash');
  expect(stripSkillSlashCommand(englishCmd, matchEn?.triggerWord)).toBe('ضربت فول وطعمية');

  const arabicCmd = '/فضفضة الدنيا جاية عليا أوي';
  const matchAr = matchActiveSkill(arabicCmd, BUILTIN_SKILLS);
  expect(matchAr?.skill.id).toBe('deep-venting');
  expect(matchAr?.matchedBy).toBe('slash');
  expect(stripSkillSlashCommand(arabicCmd, matchAr?.triggerWord)).toBe('الدنيا جاية عليا أوي');
});

test('SkillMatcher: casual greetings return null with zero false positives', () => {
  const casualMessages = [
    'صباح الخير يا رفيق',
    'إزيك يا صاحبي عامل إيه؟',
    'تمام الحمد لله',
    'هنتكلم بالليل',
    'فينك يا غالي',
  ];

  for (const msg of casualMessages) {
    const match = matchActiveSkill(msg, BUILTIN_SKILLS);
    expect(match).toBeNull();
  }
});
