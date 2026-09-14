# Rafiq Human Conversation Dynamics

A deterministic pre-LLM behavior layer for Rafiq.

It turns bounded conversation and relationship signals into:

1. one primary relational move
2. a reply shape
3. an optional continuity callback
4. a compact prompt instruction for existing Human Realism / Persona wording

The package is derived from aggregate structural analysis of a long natural chat reference corpus. The original transcript is intentionally not included.

## Why

Human-like wording is not enough. Natural chat depends on deciding whether the next action is an answer, tiny acknowledgment, practical help, callback, teasing move, disagreement, repair, topic shift, or minimal social presence.

## Files

- `docs/specs/human-conversation-dynamics.md`
- `docs/specs/reference-corpus-extraction.md`
- `docs/specs/integration-contract.md`
- `docs/analysis/reference-corpus-findings.md`
- `docs/plans/2026-09-13-human-conversation-dynamics.md`
- `src/*`
- `tests/*`
- `fixtures/sanitizedEpisodes.ts`

## Test

```bash
bun test
bun run typecheck
```

Node 22 is used to run TypeScript tests through native type stripping. The source package has no runtime dependencies.

## Rafiq integration

Recommended adapter flow:

```text
existing chat state
→ build DynamicsInput
→ planConversation(...)
→ compileDynamicsPrompt(...)
→ append compact instruction to Human Realism / Persona context
→ existing model generation
```

Do not ship or embed the private source transcript.
