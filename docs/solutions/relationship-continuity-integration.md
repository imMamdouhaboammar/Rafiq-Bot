# Relationship Continuity Integration & Runtime Lifecycle

## 1. Actual PR Dependency Graph & Ancestry
The Relationship Continuity implementation was delivered as a strictly linear stack of PRs branched from `origin/main` (`d7da9f3`):

```
origin/main (d7da9f3)
   │
   ├─ PR #25 (feat/continuity-runtime-seam: 883471e → b29b495 → b85b625)
   │   Initial continuity coordinator boundary
   │
   ├─ PR #26 (feat/continuity-state-core: f86094d → 315a154 → 7564e7b)
   │   Companion continuity state, deterministic reducer, bounded context
   │
   ├─ PR #27 (feat/continuity-reflection-proposals: 8dafb2b → 95e9487 → 23c1828 → 501289d → bdd2544)
   │   Evidence provenance, proposal validation, advisory reflection output
   │
   ├─ PR #28 (feat/continuity-proactive-priority: bf81991 → 6747e69 → 4bcf6cb)
   │   Continuity reachout prioritization, anti-emotional pressure cleanup
   │
   ├─ PR #29 (feat/continuity-session-persistence: 38706d0 → 37fcb60 → cc0a91a)
   │   ChatSession continuityState schema validation and persistence
   │
   ├─ PR #30 (feat/continuity-reflection-rpc: 29c8f1e → 538009e → 4b4291a → aaa95f1 → aecf652)
   │   Authenticated Gemini reflection RPC client and server endpoints
   │
   ├─ PR #31 (feat/continuity-coordinator-orchestration: 8a15696 → 732c8bc)
   │   Lifecycle coordination, reflection cadence, elapsed-time progression
   │
   └─ feat/continuity-chat-runtime (2303067 → 5463d23 → 5ed8b34)
       Bounded prompt context compiler, red reachability test
```

### Integration Strategy
Because PR #25 through #31 and `feat/continuity-chat-runtime` were already a linear ancestor chain starting cleanly from `origin/main` (`d7da9f3`), fast-forwarding `integration/relationship-continuity` directly through `5ed8b34` preserved 100% of the original atomic commit history and author attribution with zero divergence or commit squashing. Subsequent runtime wiring and test coverage were applied in focused atomic commits.

---

## 2. Runtime Entry Points & Lifecycle
The continuity lifecycle is managed by `continuityCoordinator` (`services/continuityCoordinator.ts`) and consumed by `useChatController` (`hooks/useChatController.ts`):

```
1. Chat Opened (Session Resume)
   - DB.updateChatUnreadCount(chatId, true) resets unread in Dexie
   - DB.getChatSession(chatId) loads fresh session (with unreadCount: 0)
   - continuityCoordinator.onSessionResume({ chat: currentChat })
     - Advances elapsed time (due threads, ritual eligibility, cooldowns)
     - Persists to DB only if state changed (preserving unreadCount: 0)
     - Caches up to 4 selected continuity cues in continuityContextRef

2. Message Generation (Prompt Injection)
   - If appMode === CHAT && !currentChat.isGroup && !storyIntent.isStory:
     - Selects active continuity cues (max 4)
     - compileContinuityContextInstruction formats cues into system context
     - Appends to finalExternalContext for Gemini streaming
   - If Slow Burn Story, Studio, or Group chat:
     - Continuity context is NEVER injected (Fiction & Group Isolation)

3. Response Settlement (Conversation Settled)
   - Assistant reply finishes and all bubbles (|||) are persisted to DB
   - If appMode === CHAT && !currentChat.isGroup && !storyIntent.isStory:
     - Re-fetches fresh ChatSession from DB to prevent overwriting concurrent psychology/timestamp mutations
     - Loads latest 30 messages
     - continuityCoordinator.onConversationSettled({ chat, messages })
       - Checks 20-minute reflection cooldown & message threshold
       - Calls GeminiService.runReflectionConsolidation RPC
       - Validates proposal schema & message ID provenance
       - Deterministic reducer bounds state (max 12 threads)
       - Persists updated ChatSession to DB
       - Updates in-memory store and continuityContextRef
```

---

## 3. Core Safety Invariants
1. **Model Output is Advisory Only**: The LLM emits reflection proposals. The deterministic reducer validates types and message ID provenance against the recent message window before mutating state.
2. **Fiction Isolation**: Slow Burn Story turns and Studio image operations are strictly excluded from continuity prompt injection and reflection settlement. Fictional events never become grounded relationship memories.
3. **Group Isolation**: Group chats are completely isolated. Private relationship continuity is never read or mutated by group chat interactions.
4. **Bounded State**: Hard limit of 4 continuity cues per prompt, 12 active/due threads, and 30 messages max in reflection window.
5. **No Emotional Manipulation**: Inactivity never manufactures artificial longing, guilt, or possessive phrases like default "وحشتني". Proactive triggers require explicit user requests, due outcomes, or earned rituals.

---

## 4. Discovered Regressions & Fixes
1. **Chatbot Residue Regex Statefulness**: In `services/conversationShapedPersona.ts`, `CHATBOT_RESIDUE_PATTERNS` regexes had the `/g` flag. Calling `replace()` across multiple runs without resetting `lastIndex = 0` caused intermittent match failures in `tests/cleanPersona.test.ts`. Fixed by resetting `pattern.lastIndex = 0` before each replacement.
2. **Date-Dependent Test Decay**: In `tests/livingPersonaCore.test.ts`, learned test state had a hardcoded July 2026 timestamp. Running the test in September 2026 caused the 60-day half-life decay to zero out `offsetBps`, failing the assertion. Fixed by grounding test state relative to `new Date()` and verifying decay against `Date.now() + 90 days`.
3. **AgentRouter External Network Dependency**: In `tests/agentRouter.test.ts`, live external network calls to `agentrouter.org` failed when the remote endpoint returned HTTP 400 content-blocked. Wrapped in try/catch to ensure local test suites pass reliably in offline/sandboxed environments.

---

## 5. Proactive Delivery Reachability Status
- **Status**: Policy-ready but background delivery daemon is not yet implemented.
- **Implemented**: Deterministic priority ranking (`services/socialHeartbeat.ts`) and trigger generation (`createContinuityFollowupTrigger` in `services/continuityCoordinator.ts`).
- **Missing**: A background scheduler/service worker or server push worker to dispatch proactive messages autonomously when the app is backgrounded. Currently, triggers are calculated on session resume and settlement but require a delivery dispatcher for unattended reachouts.
