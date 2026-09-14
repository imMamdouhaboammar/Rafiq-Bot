# Boost Rafiq Memory

## Goal

Add a lightweight `Boost Rafiq` chat setting that strengthens the bot through local memory indexing and retrieval.

## Scope

- Per-chat toggle in character settings.
- Local memory index stored in Dexie / IndexedDB.
- Smart indexing of conversation messages into retrievable memory records.
- Retrieval before text generation to enrich `externalContext`.
- Conditional Google Search only for factual/current queries when Boost is enabled.

## Non Goals

- No heavy UI dashboard for memory management in this slice.
- No background cloud sync.
- No semantic embeddings or vector database in this slice.

## Acceptance Criteria

- Enabling `Boost Rafiq` persists on the chat settings.
- Opening a boosted chat builds or refreshes its memory index from existing messages.
- New user and model messages are indexed locally.
- Before a boosted reply, the app retrieves the most relevant memories and passes them to the model as context.
- Google Search is enabled only when the boosted query looks factual or current.
