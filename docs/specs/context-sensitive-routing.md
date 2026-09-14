# Context-Sensitive Routing

## Goal
Add a lightweight backend-only routing layer that detects the current conversational situation and adjusts reply behavior without adding latency or UI.

## In Scope
- Detect high-level message routes using heuristics:
  - direct-question
  - venting
  - banter
  - conflict
  - decision
  - neutral
- Inject the route into individual chat prompts.
- Inject the route into group response prompts.

## Out of Scope
- Any new UI or visible setting
- Any extra model calls
- Persistent storage of route state

## Acceptance Criteria
- The router runs locally from the latest user message only.
- `sendMessageToGemini` can receive route guidance without breaking existing callers.
- Group replies also use route guidance.
- Build and typecheck pass.

## Risks
- Heuristic misclassification on ambiguous slang-heavy messages.

## Rollback
- Remove `services/conversationRouter.ts`
- Remove route prompt injection from prompt builders and callers
