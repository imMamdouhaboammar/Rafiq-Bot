import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DEFAULT_UI_LOCALE, getCatalog, resolveUiLocaleConfig, t } from '../i18n/index.ts';
import { SOUL_ARCHETYPES } from '../services/soulRegistry.ts';

const app = fs.readFileSync('App.tsx', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

assert.match(app, /shellDirection/, 'App shell must resolve direction dynamically');
assert.match(app, /document\.documentElement\.lang = shellLocale/, 'App must publish active locale to the document');
assert.match(app, /document\.documentElement\.dir = shellDirection/, 'App must publish active direction to the document');
assert.doesNotMatch(app, /h-\[100dvh\][^\n]+dir=\"rtl\"/, 'Top-level app shell must not force RTL');
assert.match(html, /<html lang=\"en\" dir=\"ltr\">/, 'Static shell must start from a neutral LTR default before runtime hydration');

assert.equal(DEFAULT_UI_LOCALE, 'en-US', 'Default UI locale must be en-US');
assert.equal(t('app.emptyState.newCompanionCta'), 'New Companion', 'Default empty state CTA must resolve to English');
assert.equal(t('app.emptyState.newCompanionCta', 'ar-EG'), 'رفيق جديد', 'ar-EG empty state CTA must resolve to Arabic');
assert.equal(resolveUiLocaleConfig().direction, 'ltr', 'Default UI locale direction must be LTR');
assert.equal(resolveUiLocaleConfig({ locale: 'ar-EG' }).direction, 'rtl', 'ar-EG UI locale direction must be RTL');
assert.ok(Object.keys(getCatalog('en-US')).length > 0, 'en-US catalog must be populated');
assert.equal(SOUL_ARCHETYPES[0]?.id, 'nova_default', 'First default archetype must be globally neutral nova_default');

console.log('Localization UI contract passed.');
