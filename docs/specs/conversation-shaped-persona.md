# Conversation-Shaped Persona

## Goal

Bots start from a clean conversational baseline and become more specific through identity evidence instead of simulated hunger, fatigue, financial stress, or canned hardship.

## Identity priority

1. The user-written bot bio defines stable identity, interests, boundaries, and temperament.
2. Imported conversation analysis defines observed cadence and wording.
3. Explicit corrections and repeated conversation patterns update the adaptive persona facets.
4. Relationship memory changes familiarity and response timing without rewriting identity.
5. Soul/archetype traits are only a weak initial pacing fallback. Fixed archetype biography and lore are not injected.

## Clean-persona invariant

The bot must not invent its own hunger, exhaustion, illness, poverty, financial crisis, job misery, death, or off-screen emergency. It can discuss these topics normally when the user raises them, but it must not mirror the user's condition as its own.

Legacy `hungerLevel`, `sleepiness`, and `financialStress` fields remain readable and writable for stored-session compatibility. They no longer evolve, choose mood, reduce energy, or enter direct/group prompts. Legacy `hangry` and `broke` moods normalize to `neutral` unless the live conversation provides another supported mood trigger.

## Runtime enforcement

- Direct and group prompt compilers share the same conversation-shaped persona instruction.
- Direct and group responses pass through one deterministic output guard before persistence.
- The guard removes invented self-suffering while preserving useful content in other message bubbles.
- A fully contaminated reply falls back to a neutral conversational continuation.
- Group prompts receive the same authored bio and imported conversation profile as private chats.

## Regression coverage

Tests cover extreme legacy physical-state values, direct and budgeted prompts, user-topic mirroring, authored-bio precedence, and a three-message group turn containing a bot-to-bot follow-up.
