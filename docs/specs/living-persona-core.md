# Living Persona Core

## Goal

Keep the selected archetype, bio, boundaries, and imported identity stable while allowing communication style to adapt gradually in the background from evidence-backed conversation patterns.

## Interface

The core exposes two concepts:

- `resolveLivingPersona(settings)` returns the stable baseline and a compact adaptive prompt block used by every response path.
- `reduceAdaptivePersonality(state, proposals, context)` validates analyzer proposals and applies deterministic, bounded changes.

The background coordinator reads only unprocessed local messages, asks the server for candidate signals, revalidates them, and persists the resulting state in IndexedDB. Gemini can propose evidence; it cannot write personality state.

The UI explicitly discloses this background Gemini analysis. The server accepts a maximum of 24 bounded messages per request and applies an action-specific rate limit.

## Invariants

- Name, bio, archetype, memories, boundaries, and safety are never changed by adaptation.
- A repeated inferred pattern needs at least three independent messages across two conversation sessions.
- An explicit communication preference can have a small immediate effect.
- Change is capped at one point per batch, three points per day, and fifteen points from baseline.
- Replaying the same batch or message IDs is a no-op.
- Contradictory evidence freezes a facet instead of oscillating it.
- Learned style decays slowly toward baseline with a 45-day half-life.
- The prompt contains at most four compact tendencies and never raw evidence.
- Groups consume the latest resolved persona but do not contaminate private relationship learning.
- Pause and reset are user intents applied atomically to the latest stored version; unrelated chat saves cannot overwrite adaptation.
- Reset keeps the processed-message checkpoint so old history is never learned again.

## Supported facets

- warmth
- humor
- directness
- expressiveness
- initiative

These are communication tendencies, not psychological diagnoses.

## Rollback

Disable adaptation per persona from the edit modal. A full code rollback removes the coordinator and adaptive prompt block while leaving legacy `soulTraits` intact.
