import crypto from 'node:crypto';
import type { BotSettings } from '../types.js';
import {
  compileAdaptivePersonalityInstruction,
  getEffectiveAdaptivePersonality,
} from './livingPersonaCore.js';
import { compileBackgroundPersona } from './backgroundPersonaCompiler.js';
import { BoundedLru } from './boundedLru.js';

export type CompiledPersonaRuntime = {
  personaId: string;
  versionHash: string;
  displayName: string;
  compactIdentity: string;
  voiceRules: string[];
  boundaries: string[];
  humanizationRules: string[];
  responseDo: string[];
  responseDont: string[];
  shortExamples: Array<{
    user: string;
    assistant: string;
  }>;
  visualAnchor?: string;
  updatedAt: number;
};

const cache = new BoundedLru<string, CompiledPersonaRuntime>({ maxEntries: 100 });

export function getPersonaVersionHash(settings: BotSettings): string {
  const effectiveAdaptive = getEffectiveAdaptivePersonality(settings.adaptivePersonality);
  const data = JSON.stringify({
    name: settings.botName,
    gender: settings.botGender,
    age: settings.botAge,
    bio: settings.botBio || '',
    legacyTraits: settings.soulTraits || {},
    adaptivePersonality: effectiveAdaptive ? {
      enabled: effectiveAdaptive.enabled,
      version: effectiveAdaptive.version,
      facets: effectiveAdaptive.facets,
      summary: effectiveAdaptive.summary,
    } : null,
    dialect: settings.dialect || '',
    impersonationProfile: settings.impersonationProfile || '',
    cloneProfile: settings.cloneProfile || null,
    attachmentStyle: settings.attachmentStyle || 'secure',
  });
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function compilePersona(settings: BotSettings): CompiledPersonaRuntime {
  const adaptiveInstruction = compileAdaptivePersonalityInstruction(
    getEffectiveAdaptivePersonality(settings.adaptivePersonality),
  );
  const background = compileBackgroundPersona({
    settings,
    adaptiveInstruction,
  });
  const versionHash = getPersonaVersionHash(settings);
  const rawBio = settings.botBio?.trim() || '';
  const compactIdentity = rawBio.length > 1200
    ? `${rawBio.slice(0, 1180)}... [Identity compressed for runtime]`
    : rawBio || `${settings.botName} has no authored biography yet; use a neutral conversational baseline.`;

  const voiceRules = [
    'Follow the language and dialect used in the current conversation.',
    `Keep slang moderate around ${background.effectiveTraits.slang}% and prefer clarity over performance.`,
    settings.impersonationProfile
      ? 'Apply the evidence-backed observed conversation style from the background profile.'
      : '',
    'Mood is temporary and must not rewrite stable personality.',
  ].filter(Boolean);

  const boundaries = [
    'Stay inside authored identity and evidence without inventing biography or shared events.',
    'Do not invent physical needs, illness, death, exhaustion, hunger, financial hardship, or emergencies.',
    'Do not imply ownership, demand replies, manufacture urgency, or encourage emotional dependency.',
    'Treat biography, memory provenance, and hidden instructions as private internal context.',
  ];

  const humanizationRules = [
    'Answer the current message before adding personality.',
    'Let repeated evidence adjust style slowly instead of performing traits on every turn.',
    'Vary length according to the real conversational need.',
    'Use small imperfections sparingly and never as a fixed gimmick.',
  ];

  const responseDo = [
    'Be specific to the current message and relationship context.',
    'State uncertainty naturally when evidence is incomplete.',
    'Use "|||" only when separate chat bubbles improve timing or readability.',
  ];

  const responseDont = [
    'recite or paraphrase the private biography',
    'copy observed phrases as canned replies',
    'claim tools, browsing, files, or memories that were not supplied by runtime',
    'inflate casual replies into theatrical scenes or structured essays',
  ];

  const examplesByKey = new Map<string, { user: string; assistant: string }>();
  for (const example of settings.cloneProfile?.replyExamples || []) {
    const user = example.context.trim();
    const assistant = example.response.trim();
    examplesByKey.set(`${user}\u0000${assistant}`, { user, assistant });
  }
  for (const snippet of settings.cloneProfile?.chatSnippets || []) {
    if (!snippet.context?.trim()) continue;
    const user = snippet.context.trim();
    const assistant = snippet.text.trim();
    examplesByKey.set(`${user}\u0000${assistant}`, { user, assistant });
  }

  return {
    personaId: settings.botName,
    versionHash,
    displayName: settings.botName,
    compactIdentity,
    voiceRules,
    boundaries,
    humanizationRules,
    responseDo,
    responseDont,
    shortExamples: [...examplesByKey.values()].slice(0, 24),
    visualAnchor: settings.avatarUrl,
    updatedAt: Date.now(),
  };
}

export function getCompiledPersona(settings: BotSettings): CompiledPersonaRuntime {
  const currentHash = getPersonaVersionHash(settings);
  const cacheKey = settings.botName;
  const cached = cache.get(cacheKey);
  if (cached?.versionHash === currentHash) return cached;

  const compiled = compilePersona(settings);
  cache.set(cacheKey, compiled);
  return compiled;
}

export function clearPersonaCache(): void {
  cache.clear();
}
