import { BotMood, type BotSettings, type SoulTraits } from '../types.js';
import {
  SocialAgencySchema,
  type SocialAgency,
} from '../contracts/rafiqV6.js';
import { buildSocialAgencyPrompt } from './socialAgencyPolicy.js';
import { resolveRuntimeLocale } from './runtimeLocale.js';

export const BACKGROUND_PERSONA_BASELINE: SoulTraits = {
  chaos: 20,
  empathy: 60,
  slang: 45,
  intellect: 55,
  positivity: 55,
};

const LEGACY_TRAIT_BLEND = 0.2;
const LEGACY_TRAIT_LIMITS: Record<keyof SoulTraits, [number, number]> = {
  chaos: [0, 55],
  empathy: [30, 85],
  slang: [15, 80],
  intellect: [30, 85],
  positivity: [30, 80],
};

const clamp = (value: number, minimum: number, maximum: number): number => (
  Math.max(minimum, Math.min(maximum, value))
);

export const convertLegacySoulTraitsToEvidence = (
  legacyTraits?: Partial<SoulTraits>,
): SoulTraits => {
  if (!legacyTraits) return { ...BACKGROUND_PERSONA_BASELINE };

  const result = { ...BACKGROUND_PERSONA_BASELINE };
  for (const facet of Object.keys(result) as Array<keyof SoulTraits>) {
    const value = legacyTraits[facet];
    if (!Number.isFinite(value)) continue;
    const [minimum, maximum] = LEGACY_TRAIT_LIMITS[facet];
    const bounded = clamp(value!, minimum, maximum);
    result[facet] = Math.round(
      BACKGROUND_PERSONA_BASELINE[facet] +
      (bounded - BACKGROUND_PERSONA_BASELINE[facet]) * LEGACY_TRAIT_BLEND,
    );
  }
  return result;
};

const compileMoodInstruction = (mood?: BotMood): string => {
  const normalizedMood = mood === BotMood.HANGRY || mood === BotMood.BROKE
    ? BotMood.NEUTRAL
    : mood || BotMood.NEUTRAL;
  return `Current temporary mood: ${normalizedMood}. Mood changes pacing and word choice only. It never creates biography, illness, hunger, exhaustion, money problems, death, or off-screen events.`;
};

export interface BackgroundPersonaCompilation {
  baselineTraits: SoulTraits;
  effectiveTraits: SoulTraits;
  stableInstruction: string;
  moodInstruction: string;
  socialAgencyInstruction: string;
  revision: string;
  usedLegacyEvidence: boolean;
}

export const compileBackgroundPersona = ({
  settings,
  adaptiveInstruction = '',
  mood,
  socialAgency,
}: {
  settings: BotSettings;
  adaptiveInstruction?: string;
  mood?: BotMood;
  socialAgency?: SocialAgency;
}): BackgroundPersonaCompilation => {
  const effectiveTraits = convertLegacySoulTraitsToEvidence(settings.soulTraits);
  const agency = SocialAgencySchema.parse(socialAgency || {
    boldness: 50,
    proactivity: 50,
    quietHours: {
      enabled: true,
      startHour: 23,
      endHour: 8,
      timezone: resolveRuntimeLocale({ timezone: settings.timezone, locale: settings.locale }).timezone,
    },
  });
  const biography = settings.botBio?.trim();
  const observedStyle = settings.impersonationProfile?.trim();
  const stableInstruction = [
    '### BACKGROUND PERSONA COMPILER',
    `Stable authored identity: ${biography || `${settings.botName} has no authored biography yet.`}`,
    observedStyle ? `Observed conversation style: ${observedStyle.slice(0, 3200)}` : '',
    adaptiveInstruction,
    'Stable personality changes only from authored biography, explicit corrections, or repeated evidence with confidence.',
    'Do not perform a trait on every turn. The current request and established boundaries take priority.',
    'Legacy Soul Mixer values are treated as weak historical evidence, not a character generator.',
    'Never infer physical suffering, illness, death, exhaustion, hunger, or financial distress from personality settings.',
  ].filter(Boolean).join('\n');

  return {
    baselineTraits: { ...BACKGROUND_PERSONA_BASELINE },
    effectiveTraits,
    stableInstruction: stableInstruction.slice(0, 4600),
    moodInstruction: compileMoodInstruction(mood),
    socialAgencyInstruction: buildSocialAgencyPrompt(agency),
    revision: `background:${settings.adaptivePersonality?.version || 0}:${settings.botBio?.length || 0}:${settings.impersonationProfile?.length || 0}:${settings.cloneProfile?.replyExamples.length || 0}`,
    usedLegacyEvidence: Boolean(settings.soulTraits),
  };
};
