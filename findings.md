# Findings & Decisions: Rafiq Native Skills Architecture

## Requirements
- Design a modular, native "Skills Module" for Rafiq (Egyptian AI Companion).
- Enable Rafiq to install, toggle, and execute specialized skills (similar to coding agent skills, but tailored for companionship, lifestyle, emotional support, and local productivity).
- Strictly prevent token consumption blowup and context pollution in standard casual chatting.
- Leverage **Prompt Caching** (Gemini Context Caching / KV-Cache prefix stability) to reduce token costs by up to 80% and achieve sub-second TTFT.
- Maintain Rafiq's foundational Egyptian soul, slang, and dynamic personality intact without distortion.
- Provide a WhatsApp-native interface for managing, browsing, and activating skills.

## Research Findings & Architectural Discoveries

### 1. Existing Infrastructure Audit
- **Prompt Budgeting**: `services/promptBudget.ts` already enforces strict token budgets per route (`fast_chat`: 2400 tokens, `normal_persona`: 3200 tokens, `tool_required`: 2500 tokens). The skills module must cleanly hook into this budgeting system without exceeding boundaries.
- **Arabic Text Normalization**: `services/lorebookEngine.ts` contains `normalizeArabicForSearch()`, which strips tashkeel, unifies Alefs, Yaas, Taa Marboutas, and handles noisy whitespace. This exact logic can be repurposed for zero-token local intent matching.
- **Existing Caching Layers**:
  - `services/langCache.server.ts` implements Redis semantic caching for repetitive inputs.
  - `services/personaRuntimeCache.ts` caches compiled system personas in memory.
  - Gemini LLM-level prompt caching (Context Caching) is the missing superpower that will cache the combined Persona + Active Skills block.
- **Tools Infrastructure**: `services/tools/` already contains a structured tool router and execution pipeline (`timeTool`, `webSearchTool`, `researchTool`). Skill-specific tools can plug seamlessly into this router.

### 2. The 3-Layer Companion Skill Model
Unlike coding agents where skills are heavy script binders:
- **Layer 1: Persona Steering Protocol (~150-250 tokens)**: Directs the LLM's existing deep knowledge towards Egyptian vernacular, empathetic boundaries, and specific behavioral priorities.
- **Layer 2: Deterministic Tools (0 prompt tokens during idle)**: Code execution, calculators, API searchers called only when needed.
- **Layer 3: On-Demand RAG / Knowledge Slices**: Querying local Dexie or vector store for specific facts (e.g. calories of specific Egyptian meals) rather than stuffing an entire encyclopedia into the prompt.

### 3. Prompt Caching & The Prefix Stability Invariant
For Gemini Context Caching to achieve 75-80% discounts and near-zero latency overhead:
- The **Prefix** must remain 100% byte-identical across consecutive calls.
- **Antipattern**: Putting `Date.now()`, current mood, or dynamic chat history at the beginning of the prompt invalidates the cache every single turn.
- **Correct Pattern**:
  ```
  [CACHED PREFIX (Identical across messages)]
  - System Identity & Global Rules
  - Bot Soul & Persona Baseline
  - Installed Active Skills Directives
  - Tool Function Declarations
  
  [VOLATILE TAIL (Dynamic, uncached)]
  - Live Timestamp Awareness (Time, Date, Day)
  - Current Psychological State & Hunger/Mood
  - Retrieved Memory Slices (RAG)
  - Recent Chat Turn History
  - User Current Message
  ```

## Technical Decisions with Rationale

| Decision | Rationale | Alternatives Considered |
| :--- | :--- | :--- |
| **Zero-LLM Local Matcher** | Uses fast regex & normalized Arabic keywords; 0ms latency, 0 token cost during idle conversation. | LLM Intent Classifier (rejected: adds 500ms latency and consumes 200+ tokens per message). |
| **Prefix-Stable System Prompt** | Groups static persona + skills at prompt start to trigger Gemini KV-cache hits. | Placing time/mood at prompt top (rejected: breaks prompt caching completely). |
| **Dexie (IndexedDB) Client Storage** | Keeps skills offline-first, private to the user's browser, matching Rafiq's architecture. | Server-only SQL database (rejected: adds backend overhead and breaks local privacy). |
| **Transient Injection (JIT)** | Injects the skill directives only when activated; cleans context when switching topics. | Permanent prompt stuffing (rejected: bloats context and causes prompt degradation). |
| **Hybrid Activation (Auto + Slash)** | Auto-matches keywords gracefully, but also allows explicit user control via `/command` or UI toggle. | Auto-only or Slash-only (rejected: auto-only can produce false positives; slash-only is high friction). |

## Issues & Risk Mitigations
| Potential Issue | Root Cause | Preventive Mitigation |
| :--- | :--- | :--- |
| **Prompt Confusion** | Two active skills giving conflicting persona instructions | Priority scoring + single-active skill focus per turn. |
| **Cache Busting** | Dynamic variables accidentally inserted inside the skill definition | Strict compiler assertion ensuring skill definitions are static constants or pure schemas. |
| **Context Overflow** | User installing 20 skills simultaneously | Max 3 skills active per conversation + hard token budget cap (250 tokens per skill). |
