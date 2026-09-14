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

## Egyptian Arabic reference localization

`ar-EG` remains a first-class reference path. Egyptian conversation datasets, dialect-specific tools, cultural timing helpers, and persona presets may remain intentionally Egyptian when they are explicitly selected. They must not run as hidden defaults for another locale.

## UI translation status

The runtime is locale-aware, but the current interface still contains Arabic strings in several components. Rafiq should not be described as fully translated or fully internationalized yet. New UI work should avoid adding another hardcoded locale and should prefer a future message-catalog boundary over scattering translation conditionals.

## Adding or extending a locale

1. Verify `resolveRuntimeLocale` returns the expected locale, timezone, direction, and search region.
2. Add focused tests for one LTR case or one RTL case as appropriate.
3. Keep culture-specific behavior behind an explicit culture or locale check.
4. Check dates, time, search requests, form direction, modal layout, and chat message direction.
5. Preserve `ar-EG` reference behavior unless the contribution intentionally changes that preset.
6. Run `bun run test:oss-contracts`, `bun run typecheck`, and browser verification at desktop and mobile widths.

`tests/localizationRuntime.test.ts` and `tests/localizationUiContract.test.ts` are the regression contracts for the current runtime and top-level UI behavior.
