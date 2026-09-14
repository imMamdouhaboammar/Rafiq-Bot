# Task Plan: Rafiq Native Skills Architecture & Module Integration

## Goal
Design and integrate a native, high-performance, token-efficient "Skills Module" into Rafiq (Egyptian AI Companion) supporting modular capability extensions, Gemini prompt caching with prefix stability, zero-LLM local intent matching, Dexie persistence, and WhatsApp-style UI management.

## Next Step
Completed all execution phases, tests verified, and production build succeeded. Present final walkthrough to the user.

## Current Phase
Phase 6: End-to-End Verification & Documentation (Complete)

## Phases

### Phase 1: Architecture, Discovery & Learnings
- [x] Analyze conversation insights using `/learn`, `/convo-learn`, and `/gsd-extract-learnings`
- [x] Audit Rafiq codebase (`types.ts`, `promptBudget.ts`, `lorebookEngine.ts`, `geminiService.server.ts`, `langCache.server.ts`)
- [x] Design token economy & prefix stability caching architecture
- [x] Craft `task_plan.md`, `findings.md`, and `progress.md` (Manus-style)
- [x] Create comprehensive `rafiq-skills-architecture-plan.md` (Toon-Style Master Blueprint)
- **Status:** complete

### Phase 2: Core Data Schema & Storage Engine
- [x] Define `SkillDefinition`, `SkillTrigger`, `SkillBehavior`, `SkillTool`, `SkillState` in `types.ts`
- [x] Extend Dexie database (`db.ts` / `services/registerDbV6.ts`) with `version(7)` stores for `installedSkills` and `skillStates`
- [x] Implement `services/skillRegistry.ts` (Built-in skills library, install/uninstall/toggle lifecycle, Dexie helpers)
- [x] Unit test schema validation and skill definitions
- **Status:** complete

### Phase 3: Zero-LLM Local Matcher & Prompt Caching Pipeline
- [x] Build `services/skillMatcher.ts` leveraging Arabic normalization (`normalizeArabicForSearch`)
- [x] Refactor `services/personaEngine.ts` to support `skillInstruction` in `getBudgetedSystemInstruction`
- [x] Refactor `services/geminiService.server.ts` to implement Prefix Stability (Cached Static Block vs Volatile Dynamic Tail)
- [x] Integrate Skill Just-In-Time (JIT) injection into `sendMessageToGemini` and `sendMessageToGeminiStream`
- [x] Connect deterministic tool calculations (`baladiNutritionTool.ts`) to tool context
- **Status:** complete

### Phase 4: Built-in Starter Skills Creation
- [x] Skill 1: "كوتش الجيم بالبلدي" (`baladi-fitness`) with Egyptian calorie tool `baladiNutritionTool.ts`
- [x] Skill 2: "فضفضة 3 الفجر" (`deep-venting`) with active listening and anti-toxic-positivity rules
- [x] Skill 3: "دليل الفسح والانتخة" (`outings-hunter`) with Cairo/Alex cafes & study spots guidance
- [x] Unit tests for skills activation and nutrition calculations
- **Status:** complete

### Phase 5: UI/UX — WhatsApp-Style Skills Hub & In-Chat Badges
- [x] Create `components/SkillsHubModal.tsx` (WhatsApp aesthetic, category tabs, detail view, toggle switches)
- [x] Add Skills Hub button in `ChatInterface.tsx` header and settings dropdown
- [x] Add Active Skill Badge indicator in chat header
- [x] Add Slash command popup helper (`/coach`, `/vent`, `/spots`) in message composer
- **Status:** complete

### Phase 6: End-to-End Verification & Documentation
- [x] Run automated tests via `bun test tests/skillMatcher.test.ts tests/baladiNutrition.test.ts` (9 pass, 0 fail)
- [x] Verify production build via `bun run build` (0 TypeScript / Rollup errors)
- [x] Create `walkthrough.md` artifact
- **Status:** complete

## Key Decisions & Invariants Enforced
1. **Zero-LLM Matching**: Matcher evaluates in <1ms without calling any external API or LLM, keeping idle chats at 0 extra tokens.
2. **Prefix Stability Invariant**: Persona constitution + voice rules + active skill directives sit at the top of the prompt to maximize Gemini KV-cache hit rate (up to 80% discount).
3. **Deterministic Tools**: Calculations (Egyptian food calories and macronutrients) happen in code, eliminating math hallucinations.
