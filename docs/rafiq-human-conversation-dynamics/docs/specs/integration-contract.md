# Rafiq Integration Contract

## Intended insertion point

```text
incoming message
→ existing route/context analysis
→ derive bounded DynamicsInput
→ relationshipCalibration
→ continuityAffordance
→ relationalMovePlanner
→ conversationSafetyGate
→ replyShapePlanner
→ dynamicsPromptCompiler
→ existing Human Realism / Persona prompt
→ model generation
```

## Runtime ownership

The new package decides social behavior shape only. Existing Rafiq components keep their current ownership:

- persona engine: identity
- human realism: wording quality
- companion continuity: relationship meaning and unresolved threads
- reflection engine: evidence proposals
- social heartbeat: proactive policy/delivery
- slow burn story: fiction

## Required adapter inputs

Rafiq should derive a `DynamicsInput` from existing state rather than passing raw database objects.

Adapter should provide:

- message length and whether it is mostly a social ping
- whether the user asked a concrete question or practical request
- whether the user expressed distress
- whether a boundary/correction occurred
- whether active conflict exists
- sensitivity level
- recent assistant verbosity
- recent same-speaker burst length
- relationship evidence counts
- optional eligible continuity items

## Required output

The planner returns a `ConversationPlan` containing:

- move
- reply shape
- optional continuity callback id
- relationship signal
- safety reasons when a requested behavior was downgraded

The model receives only the compiled prompt instruction, not the full internal state.

## Failure behavior

If planning fails, Rafiq falls back to existing Human Realism behavior.

The dynamics package must never block message generation because a planning signal is absent.

## Persistence

No new persistence is required for V1.

Relationship calibration evidence should be derived from or stored inside the existing continuity/reflection state if persistence is later needed. Do not introduce a separate dynamics database.
