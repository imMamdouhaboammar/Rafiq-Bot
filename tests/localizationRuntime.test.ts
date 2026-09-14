import assert from 'node:assert/strict';
import { getRuntimeAwarenessContext, injectRuntimeAwarenessPrompt } from '../services/realtimeAwareness.server.ts';
import { getCurrentTime } from '../services/tools/timeTool.server.ts';
import { generateAgentRouterResponse } from '../services/agentRouter.server.ts';
import { executeWebSearch } from '../services/tools/webSearchTool.server.ts';
import { getTextDirection, resolveRuntimeLocale } from '../services/runtimeLocale.ts';
import { getSystemInstruction } from '../services/personaEngine.ts';
import type { BotSettings } from '../types.ts';

const previousLocale = process.env.RAFIQ_DEFAULT_LOCALE;
const previousTimezone = process.env.RAFIQ_DEFAULT_TIMEZONE;

try {
  delete process.env.RAFIQ_DEFAULT_LOCALE;
  delete process.env.RAFIQ_DEFAULT_TIMEZONE;


  assert.equal(getTextDirection('en-US'), 'ltr', 'English must resolve LTR');
  assert.equal(getTextDirection('ar-EG'), 'rtl', 'Arabic must resolve RTL');
  assert.equal(getTextDirection('ja-JP'), 'ltr', 'third non-Arabic locale must resolve independently');
  const japanese = resolveRuntimeLocale({ locale: 'ja-JP', timezone: 'Asia/Tokyo' }, {} as NodeJS.ProcessEnv);
  assert.equal(japanese.locale, 'ja-JP');
  assert.equal(japanese.timezone, 'Asia/Tokyo');
  assert.equal(japanese.direction, 'ltr');
  assert.equal(japanese.searchRegion, 'jp');

  const egyptianVariant = resolveRuntimeLocale({ locale: 'ar-EG-u-nu-arab' }, {} as NodeJS.ProcessEnv);
  assert.equal(egyptianVariant.isEgyptianReference, true, 'BCP 47 ar-EG variants must retain the bundled Egyptian reference preset');
  assert.equal(egyptianVariant.culture, 'egyptian-arabic');

  const explicitEgyptianCulture = resolveRuntimeLocale({ locale: 'en-US', culture: 'egyptian-arabic' }, {} as NodeJS.ProcessEnv);
  assert.equal(explicitEgyptianCulture.isEgyptianReference, true, 'explicit Egyptian culture must work independently from locale');

  const explicitNeutralCulture = resolveRuntimeLocale({ locale: 'ar-EG', culture: 'neutral' }, {} as NodeJS.ProcessEnv);
  assert.equal(explicitNeutralCulture.isEgyptianReference, false, 'explicit culture must override locale-derived reference culture');
  assert.equal(explicitNeutralCulture.direction, 'rtl', 'neutral culture must not change locale-derived text direction');

  const neutralTime = getCurrentTime();
  assert.equal(neutralTime.locale, 'en-US', 'global fallback locale must be neutral');
  assert.equal(neutralTime.timezone, 'UTC', 'global fallback timezone must be UTC');

  const french = getRuntimeAwarenessContext('Europe/Paris', 'fr-FR');
  const frenchPrompt = injectRuntimeAwarenessPrompt(french);
  assert.equal(french.timezone, 'Europe/Paris');
  assert.doesNotMatch(frenchPrompt, /Cairo|Prayer Context|Friday Context/i, 'non-Egyptian locale must not inherit Egyptian living context');

  const egyptian = getRuntimeAwarenessContext('Africa/Cairo', 'ar-EG');
  assert.equal(egyptian.timezone, 'Africa/Cairo');
  assert.ok(egyptian.localDate.length > 0, 'ar-EG reference locale remains supported');

  const neutralSettings: BotSettings = {
    botName: 'Nova',
    botGender: 'female',
    botBio: 'Nova likes books, city walks, and direct conversation.',
    chattiness: 'balanced',
    fragmentedMessages: true,
    soulId: 'custom_clone',
    locale: 'en-US',
    timezone: 'America/New_York',
    direction: 'ltr',
    conversationLanguage: 'English',
    culture: 'neutral',
  };
  const neutralPersonaPrompt = getSystemInstruction(neutralSettings, null);
  assert.match(neutralPersonaPrompt, /en-US|English/, 'persona prompt must carry selected locale/language');
  assert.doesNotMatch(neutralPersonaPrompt, /Egyptian Arabic|Cairo|modern Egyptian/i, 'neutral persona must not inherit Egyptian core framing');

  const previousSearchProvider = process.env.RAFIQ_WEB_SEARCH_PROVIDER;
  const previousSearchKey = process.env.RAFIQ_WEB_SEARCH_API_KEY;
  const previousSearchLocale = process.env.RAFIQ_WEB_SEARCH_LOCALE;
  const previousSearchRegion = process.env.RAFIQ_WEB_SEARCH_REGION;
  process.env.RAFIQ_WEB_SEARCH_PROVIDER = 'serpapi';
  process.env.RAFIQ_WEB_SEARCH_API_KEY = 'fixture-key';
  delete process.env.RAFIQ_WEB_SEARCH_LOCALE;
  delete process.env.RAFIQ_WEB_SEARCH_REGION;
  let capturedSearchUrl = '';
  const searchFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    capturedSearchUrl = String(input);
    return new Response(JSON.stringify({ organic_results: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    await executeWebSearch({ query: 'test query', locale: 'ja-JP' });
    assert.match(capturedSearchUrl, /hl=ja-JP/);
    assert.match(capturedSearchUrl, /gl=jp/);
    assert.doesNotMatch(capturedSearchUrl, /hl=ar-EG|gl=eg/, 'search must not inherit Egyptian defaults');
  } finally {
    globalThis.fetch = searchFetch;
    if (previousSearchProvider === undefined) delete process.env.RAFIQ_WEB_SEARCH_PROVIDER; else process.env.RAFIQ_WEB_SEARCH_PROVIDER = previousSearchProvider;
    if (previousSearchKey === undefined) delete process.env.RAFIQ_WEB_SEARCH_API_KEY; else process.env.RAFIQ_WEB_SEARCH_API_KEY = previousSearchKey;
    if (previousSearchLocale === undefined) delete process.env.RAFIQ_WEB_SEARCH_LOCALE; else process.env.RAFIQ_WEB_SEARCH_LOCALE = previousSearchLocale;
    if (previousSearchRegion === undefined) delete process.env.RAFIQ_WEB_SEARCH_REGION; else process.env.RAFIQ_WEB_SEARCH_REGION = previousSearchRegion;
  }

  const originalFetch = globalThis.fetch;
  const previousToken = process.env.AGENT_ROUTER_TOKEN;
  process.env.AGENT_ROUTER_TOKEN = 'fixture-token';
  let capturedSystem = '';
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    const payload = JSON.parse(String(init?.body || '{}'));
    capturedSystem = payload.messages?.[0]?.content || '';
    return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    await generateAgentRouterResponse('hello', {
      locale: 'en-US',
      timezone: 'America/New_York',
      conversationLanguage: 'English',
      culture: 'neutral',
      timeoutMs: 1_000,
    });
    assert.match(capturedSystem, /en-US|English/, 'AgentRouter framing must carry the selected locale/language');
    assert.doesNotMatch(capturedSystem, /Egyptian|Cairo|Egyptian Arabic/i, 'non-Egyptian AgentRouter framing must be culture-neutral');
  } finally {
    globalThis.fetch = originalFetch;
    if (previousToken === undefined) delete process.env.AGENT_ROUTER_TOKEN;
    else process.env.AGENT_ROUTER_TOKEN = previousToken;
  }

  console.log('Localization runtime tests passed.');
} finally {
  if (previousLocale === undefined) delete process.env.RAFIQ_DEFAULT_LOCALE;
  else process.env.RAFIQ_DEFAULT_LOCALE = previousLocale;
  if (previousTimezone === undefined) delete process.env.RAFIQ_DEFAULT_TIMEZONE;
  else process.env.RAFIQ_DEFAULT_TIMEZONE = previousTimezone;
}
