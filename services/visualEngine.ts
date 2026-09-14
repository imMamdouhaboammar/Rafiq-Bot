
import { BotMood } from "../types.js";
import type { VisualSeed } from "../types.js";

const PALETTES = ['warm', 'cool', 'neutral', 'vibrant', 'earthy', 'pastel', 'cinematic teal-orange', 'high contrast black & white', 'muted vintage'];
const LIGHTING = ['soft light', 'studio light', 'ambient glow', 'window daylight', 'dramatic side lighting', 'golden hour', 'neon rim light', 'rembrandt lighting'];
const TONES = ['modern', 'retro', 'cinematic', 'natural', 'moody', 'bright', 'ethereal', 'gritty'];

export const generateVisualSeed = (): VisualSeed => {
  const random = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  return {
    palette: random(PALETTES),
    lighting: random(LIGHTING),
    tone: random(TONES),
    seed: crypto.randomUUID().slice(0, 8)
  };
};

export const getVisualPromptModifiers = (seed: VisualSeed): string => {
  return `
    **VISUAL STYLE SIGNATURE (Strict Adherence):**
    - **Color Palette:** ${seed.palette}
    - **Lighting Setup:** ${seed.lighting}
    - **Overall Tone:** ${seed.tone}
    - **Identity Seed:** ${seed.seed} (Maintain consistent facial structure features based on this seed).
  `;
};

export const getEmotionVisualModifiers = (mood: BotMood | string | undefined): string => {
  if (!mood) return "neutral lighting, balanced colors";
  
  const map: Record<string, string> = {
    [BotMood.HAPPY]: "bright daylight, warm tones, soft smile, vibrant atmosphere",
    [BotMood.SAD]: "dim soft light, muted cool tones, reflective expression, rain-like atmosphere",
    [BotMood.ANGRY]: "dramatic high-contrast lighting, deep shadows, intense gaze, red/orange hues",
    [BotMood.ROMANTIC]: "soft golden bokeh, warm candlelight glow, dreamy cinematic blur, intimate close-up",
    [BotMood.EXCITED]: "dynamic lighting, high saturation, sharp focus, energetic motion blur",
    [BotMood.ANXIOUS]: "unsettling angles, low key lighting, desaturated tones, nervous tension"
  };
  return map[mood] || "neutral lighting, balanced colors";
};
