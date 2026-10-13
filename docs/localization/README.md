# Localization and cultural presets

Rafiq separates runtime locale from persona and culture so one reference experience does not become a global fallback.

## Runtime contract

`services/runtimeLocale.ts` resolves:

- locale
- timezone
- text direction
- culture hint
- conversation language
- search locale
- search region

With no explicit configuration, the public defaults are `en-US`, `UTC`, and LTR. Locale-derived RTL support covers Arabic and other RTL language families. Search region derives from the locale when no explicit region is supplied.

Today, repository-wide locale and timezone defaults are configured through environment variables. `BotSettings` also carries locale, timezone, direction, conversation-language, and culture fields for programmatic/imported persona state, but the current public UI does not yet expose per-persona locale controls. Do not describe those fields as an end-user settings screen until that UI exists.

## Egyptian Arabic reference localization

`ar-EG` remains a first-class reference path. Egyptian conversation datasets, dialect-specific tools, cultural timing helpers, and persona presets may remain intentionally Egyptian when they are explicitly selected. They must not run as hidden defaults for another locale.

## UI translation and message catalog architecture

Structured UI message catalogs live under `i18n/`:

- `i18n/config.ts` — supported UI locales (`en-US` default, `ar-EG` reference), direction resolution, and completeness descriptors
- `i18n/messages/en-US.json` — canonical English-first message catalog
- `i18n/messages/ar-EG.json` — Egyptian Arabic reference message catalog
- `i18n/formatters/index.ts` — standard `Intl.DateTimeFormat` and `Intl.NumberFormat` helpers
- `i18n/index.ts` — `t(key, locale, params)` lookup with automatic `en-US` fallback

The top-level application shell (`App.tsx`) and default companion archetypes (`nova_default`, `alex_default` in `services/soulRegistry.ts`) resolve to English-first, globally neutral defaults (`en-US`, `UTC`, LTR), while secondary drawers and legacy components are progressively migrating to `i18n/`. New UI work should always add keys to `i18n/messages/en-US.json` (and `ar-EG.json` when applicable) rather than hardcoding locale strings.

## Adding or extending a locale

1. Verify `resolveRuntimeLocale` returns the expected locale, timezone, direction, and search region.
2. Add focused tests for one LTR case or one RTL case as appropriate.
3. Keep culture-specific behavior behind an explicit culture or locale check.
4. Check dates, time, search requests, form direction, modal layout, and chat message direction.
5. Preserve `ar-EG` reference behavior unless the contribution intentionally changes that preset.
6. Run `bun run test:oss-contracts`, `bun run typecheck`, and browser verification at desktop and mobile widths.

`tests/localizationRuntime.test.ts` and `tests/localizationUiContract.test.ts` are the regression contracts for the current runtime and top-level UI behavior.
