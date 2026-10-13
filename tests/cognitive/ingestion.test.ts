import { describe, it, expect } from 'bun:test';
import { CognitiveIngestionAdapter, PiiFirewall } from '../../services/cognitive/ingestionAdapter.js';

describe('Cognitive Ingestion & PII Firewall', () => {
  const firewall = new PiiFirewall();
  const adapter = new CognitiveIngestionAdapter();

  it('redacts Egyptian and international phone numbers from text', () => {
    const raw = 'رقمي اهو 01012345678 وكلمني على +201123456789 ضروري';
    const { cleanedText, redactionCount } = firewall.sanitizeText(raw);

    expect(cleanedText).toContain('[REDACTED_PHONE]');
    expect(cleanedText).not.toContain('01012345678');
    expect(cleanedText).not.toContain('+201123456789');
    expect(redactionCount).toBe(2);
  });

  it('redacts physical street addresses', () => {
    const raw = 'نتقابل عند عمارة النصر في شارع التحرير بعد العصر';
    const { cleanedText, redactionCount } = firewall.sanitizeText(raw);

    expect(cleanedText).toContain('[REDACTED_ADDRESS]');
    expect(cleanedText).not.toContain('شارع التحرير');
    expect(redactionCount).toBeGreaterThan(0);
  });

  it('rejects clinical diagnosis labels from contaminating personality traits', () => {
    const clinicalText = 'أنا عندي اضطراب شخصية حدية وbipolar ومش بتعالج';
    const val = firewall.validateContent(clinicalText);

    expect(val.valid).toBe(false);
    expect(val.reason).toContain('Clinical diagnostic labels');
  });

  it('ingests WhatsApp export and extracts empirical cadence metrics', async () => {
    const exportText = `
[12/04/2026, 10:15:20 AM] Kareem: صباح الخير عامل ايه؟
[12/04/2026, 10:16:05 AM] Sarah: صباح النور يا كريم
[12/04/2026, 10:16:22 AM] Sarah: الحمد لله كله تمام
[12/04/2026, 10:16:40 AM] Sarah: الشغل ماشي كويس
[12/04/2026, 10:20:10 AM] Kareem: هتيجي المكتب النهاردة؟
[12/04/2026, 10:21:00 AM] Sarah: أيوة طالعة في الطريق أهو
    `.trim();

    const result = await adapter.ingestPersona({
      ownerId: 'user_admin',
      companionId: 'sarah',
      companionName: 'Sarah',
      rawExportText: exportText,
      sourceType: 'whatsapp',
      targetSpeakerName: 'Sarah',
    });

    expect(result.totalMessagesParsed).toBe(6);
    expect(result.targetMessagesCount).toBe(4);
    expect(result.cadenceMetrics.medianTextChars).toBeGreaterThan(0);
    expect(result.cadenceMetrics.multiBubbleBurstRatio).toBeGreaterThan(0);
    expect(result.extractedFacts.length).toBeGreaterThan(0);
    expect(result.extractedFacts.every(f => f.companionId === 'sarah')).toBe(true);
  });
});
