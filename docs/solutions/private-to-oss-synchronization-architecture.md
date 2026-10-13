# Compound Engineering Solution: Private-to-OSS Synchronization & Global Architecture

## Context & Objectives

Rafiq's private development codebase (`imMamdouhaboammar/Rafiq-July`) accumulated several advanced capabilities:
1. Native OmniTwin cognitive integration (provenance-aware epistemic grounding, Hebbian spreading activation, 12-move social planner).
2. Dexie V8 schema with Neuro-Cognitive tables, synthetic affect, reflection journal, and memory lifecycle.
3. WhatsApp rhythm engine with realistic reading latency, typing simulation, and spontaneous reactions.
4. Gemini streaming resilience, keep-alive SSE pinging, and model fallback chains.
5. Interactive multi-chapter Storyteller engine with persistent repositories.
6. Companion duplication and structured export/import.

Simultaneously, the public repository (`imMamdouhaboammar/Rafiq-Bot`) contained vital open-source contracts:
1. Pinned Bun CI workflow (`.github/workflows/ci.yml`) with minimal permissions.
2. Independent secret detection suites (`scripts/security/`).
3. Dedicated OSS delivery, documentation, environment, and visual asset contracts (`tests/*Contract.test.ts`).
4. Decoupled runtime locale foundations (`services/runtimeLocale.ts`).

## Key Decisions & Architecture

1. **Reconciliation over Blind Overwrite**:
   Public infrastructure was strictly preserved. Rather than overwriting files from private development, each subsystem was analyzed, selectively ported, and adapted to maintain public contract compliance.

2. **English-First Global Localization Boundary**:
   Instead of ad-hoc text replacements, a structured message catalog (`src/i18n/`) was established with `en-US.json` as the default and `ar-EG.json` as the Egyptian Arabic preset. Global defaults resolve to:
   - UI Language: English (`en-US`)
   - Text Direction: LTR (`ltr`)
   - Timezone: `UTC`
   - Culture: `neutral`
   - Companion Persona: `Nova` (`nova_default`)

3. **Opt-In Cultural Modules**:
   Egyptian colloquial rhythm, prayer-time awareness (`CulturalMuezzin`), and Cairo daily scheduling (`DailyStageDirector`) are gated behind `runtimeLocale.isEgyptianReference` or explicit user profile/persona selection, ensuring zero cultural contamination for global users.

4. **Zero Vulnerability & Zero Secret Gate**:
   All dependencies were audited with `bun audit --audit-level=high` (0 vulnerabilities). All reachable Git blobs and worktree files passed `node scripts/security/scan-secrets.mjs`.
