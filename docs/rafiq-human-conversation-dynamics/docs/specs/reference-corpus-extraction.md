# Reference Corpus Extraction Spec

Status: approved implementation input
Date: 2026-09-13

## Purpose

Convert a long natural conversation into reusable behavioral evidence without shipping or memorizing the private transcript.

## Privacy rule

The raw reference transcript is analysis input only. It must not be included in the distributable package, production bundle, fixtures, prompts, logs, or tests.

## Extraction levels

### Level 1: Aggregate rhythm

Allowed outputs:

- event counts
- content-type ratios
- short-message ratio
- same-speaker burst distribution
- quote/reply frequency
- code-switch frequency
- coarse session gap counts

### Level 2: Abstract episode structure

Allowed outputs are anonymous move sequences such as:

```text
emotional complaint
→ probe
→ incorrect hypothesis
→ playful release
→ mundane explanation
→ minimal warmth
```

The wording, names, places, employers, health details, and third-party identities are discarded.

### Level 3: Pattern classification

Every pattern receives one of:

- `baseline_safe`
- `relationship_earned`
- `blocked_for_ai`

## Episode taxonomy

The initial corpus supports at least these episode classes:

- social ping
- casual check-in
- practical assistance
- emotional complaint
- illness/condition follow-up
- plan coordination
- disagreement
- minor friction and repair
- teasing
- shared-reference callback
- media/link handoff
- call/voice escalation
- topic drift

## Sanitization requirements

Fixtures must replace specific people, places, organizations, and private circumstances with semantic roles.

Examples:

- `[friend]`
- `[work task]`
- `[health follow-up]`
- `[shared plan]`
- `[media item]`

Do not preserve source phrasing if the structural pattern can be represented abstractly.

## Derived evidence thresholds

These are conservative V1 defaults, not claims about universal human behavior:

- nickname convention: at least 3 reciprocated uses across at least 2 sessions
- teasing permission: at least 3 positive reciprocations and no recent negative correction
- code-switch mirroring: at least 4 user-origin examples across at least 2 sessions
- ritual: at least 3 repeated occurrences across at least 3 sessions
- relationship expectation: at least 3 evidence events across at least 2 sessions

Explicit user correction overrides accumulated evidence immediately.

## Output artifacts

The package may contain:

- aggregate metrics
- anonymous move sequences
- generic synthetic fixtures
- engine tests derived from those patterns

The package must not contain the raw source transcript.
