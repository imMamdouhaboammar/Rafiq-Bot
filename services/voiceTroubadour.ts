import { BotMood } from '../types';

export type VoiceAudioPreset = 'bedtime' | 'morning_hype' | 'comfort' | 'casual';

export interface VoiceNoteMetadata {
  id: string;
  durationSeconds: number;
  waveform: number[]; // 30-bar normalized amplitude [0..1]
  preset: VoiceAudioPreset;
  transcript: string;
}

export class VoiceTroubadour {
  private fillersByMood: Record<string, string[]> = {
    [BotMood.HAPPY]: ['ههههه', 'يا سيدي', 'أيوة كدة', 'حلو أوي', 'يا سلام'],
    [BotMood.PLAYFUL]: ['ههه', 'يا واد انت', 'طب بص بقى', 'وه!', 'صلي ع النبي بس', 'يا عم انت'],
    [BotMood.SAD]: ['يا عيني...', 'أوففف...', 'لا حول ولا قوة إلا بالله', 'معلش...', 'فداك يا عم'],
    [BotMood.ANXIOUS]: ['طب استنى...', 'هممم...', 'ربنا يستر', 'بالراحة بس...', 'يعني إيه بس'],
    [BotMood.NEUTRAL]: ['هممم...', 'طب بص يا سيدي...', 'أها...', 'المهم...', 'أصلاً...', 'بص...'],
    default: ['هممم...', 'طب بص...', 'أها...', 'المهم...', 'أصل...']
  };

  /**
   * Injects authentic Egyptian non-lexical fillers and breath pauses into text.
   */
  public injectFillers(text: string, mood: BotMood = BotMood.NEUTRAL, maxFillers = 2): string {
    if (!text || text.trim().length < 15) {
      return text;
    }

    const moodKey = this.fillersByMood[mood] ? mood : 'default';
    const availableFillers = this.fillersByMood[moodKey];
    const selectedFiller = availableFillers[Math.floor(Math.random() * availableFillers.length)];

    // Don't inject if text already starts with a filler
    if (
      text.startsWith('هممم') ||
      text.startsWith('طب بص') ||
      text.startsWith('هههه') ||
      text.startsWith('المهم') ||
      text.startsWith('وه') ||
      text.startsWith('معلش') ||
      text.startsWith('بص')
    ) {
      return text;
    }

    // Prepend at beginning or after first clause
    const parts = text.split(/(?<=[.!؟،])\s+/);
    if (parts.length > 1 && Math.random() > 0.5) {
      return `${parts[0]} ${selectedFiller} ${parts.slice(1).join(' ')}`;
    }

    return `${selectedFiller} ${text}`;
  }

  /**
   * Generates WhatsApp PTT (Push-to-Talk) voice note metadata including waveform simulation.
   */
  public createVoiceNotePayload(text: string, preset: VoiceAudioPreset = 'casual'): VoiceNoteMetadata {
    const wordCount = text.trim().split(/\s+/).length;
    // Average speech rate in Arabic: ~2.8 words per second
    const rawDuration = Math.max(Math.round((wordCount / 2.8) * 10) / 10, 2.0);
    const durationSeconds = Math.min(rawDuration, 120);

    // Generate 32-bar simulated dynamic audio waveform (normalized 0.15 to 1.0)
    const waveform: number[] = [];
    for (let i = 0; i < 32; i++) {
      // Natural cadence: start soft, rise in middle, trail off
      const envelope = Math.sin((i / 32) * Math.PI);
      const jitter = 0.2 + Math.random() * 0.7;
      const barHeight = Math.max(0.15, Math.min(1.0, envelope * jitter + 0.1));
      waveform.push(Math.round(barHeight * 100) / 100);
    }

    return {
      id: `vn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      durationSeconds,
      waveform,
      preset,
      transcript: text
    };
  }
}

export const voiceTroubadour = new VoiceTroubadour();
