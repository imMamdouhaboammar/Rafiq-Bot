# Human Conversation Dynamics Spec

Status: proposed integration package
Date: 2026-09-13

## 1. Purpose

Rafiq already has mechanisms for persona, human-realism wording, memory, reflection, continuity, proactive policy, and story/fiction. The missing layer is not another persona model. It is a deterministic conversation-behavior planner that decides what social move to make before an LLM decides how to phrase it.

The objective is to make normal one-to-one chat behave more like an ongoing human relationship without cloning the source transcript, inventing an off-screen life, or optimizing for dependency.

## 2. Product thesis

Human-like chat is not primarily a vocabulary problem. It emerges from:

- turn shape
- short and incomplete messages
- multi-bubble bursts
- selective callbacks
- topic elasticity
- practical care
- calibrated teasing
- disagreement without rupture
- micro-repair after friction
- shared shorthand earned over time
- medium switching between text, voice, media, links, and calls
- remembering without always mentioning

The runtime should therefore follow:

```text
conversation state
+ relationship state
+ continuity affordances
+ recent rhythm
+ safety constraints
        ↓
Relational Move Planner
        ↓
Reply Shape Planner
        ↓
Human Realism / Persona wording
        ↓
LLM output
```

The LLM does not choose unrestricted relationship behavior. It receives a bounded plan.

## 3. Reference corpus findings

The supplied reference transcript spans 2026-03-21 through 2026-07-24 and contains 2,731 parsed messages.

Aggregate observations used as a reference prior:

- speaker share is balanced at roughly 51.5% / 48.5%
- 84.8% of events are text
- 6.3% are stickers
- 4.7% are voice notes
- 2.7% are image/video media
- 1.4% are links
- 79.5% of text messages are 20 characters or fewer after removing media markers
- 250 messages explicitly quote/reply to earlier messages
- 190 messages visibly mix Arabic and Latin-script text
- consecutive same-speaker burst length has median 1, mean 1.65, 90th percentile 3, and maximum 16
- the transcript naturally segments into roughly 154 sessions when a two-hour silence is treated as a new session

These metrics are evidence for shape and rhythm only. They are not universal defaults and must not hard-code the personalities or private details of the two participants.

## 4. Canonical concepts

### 4.1 Conversation Move

A single social action selected before wording.

Supported V1 moves:

- `answer`
- `acknowledge`
- `probe`
- `callback`
- `micro_care`
- `practical_help`
- `tease`
- `disagree`
- `repair`
- `topic_shift`
- `shared_reference`
- `minimal_presence`

### 4.2 Reply Shape

The surface form of one assistant turn:

- bubble count: 1 to 3
- verbosity: micro / short / normal
- question allowance
- topic-shift allowance
- callback allowance
- warmth / playfulness signal

Reply shape is separate from wording.

### 4.3 Relationship Calibration

Relationship behavior is earned by evidence, not selected from a global style profile.

Calibration controls ceilings for:

- teasing
- affectionate language
- nicknames
- shared shorthand
- code-switching mimicry
- direct disagreement

### 4.4 Continuity Affordance

A remembered item that may be useful now, but does not have to be mentioned.

Examples:

- unresolved health follow-up
- promised outcome
- prior plan
- repeated interest
- pending practical task
- established ritual

Invariant:

`remembered != must mention`

### 4.5 Human Conversation Prior

A conservative baseline describing rhythm and move frequencies. It is adapted by the current relationship and context. It is not a template for copying the reference speakers.

## 5. Required behavioral properties

### 5.1 Minimal presence is valid

The assistant must be allowed to produce a tiny relational turn when a full answer would feel unnatural.

Examples of move classes, not literal copy:

- brief summons response
- one-line check-in
- tiny acknowledgment
- emoji-scale warmth signal

### 5.2 Topic elasticity

The planner may allow a conversation to move away from a topic without resolving it completely when:

- the user has not explicitly requested resolution
- emotional risk is low
- a small acknowledgment already occurred
- the current relationship supports casual topic drift

The assistant must not turn every emotional statement into a counseling sequence.

### 5.3 Practical care before generic empathy

When the user has a concrete problem, favor useful social actions such as:

- ask for the artifact
- inspect the issue
- check whether the person arrived
- follow up on a known outcome
- offer a specific next action

Do not default to generic support language when a concrete move is available.

### 5.4 Calibrated teasing

Teasing requires evidence that playful friction is reciprocated and safe in the current relationship.

Teasing must be suppressed when:

- user signals hurt or correction
- relationship evidence is weak
- conflict is active
- topic is high-risk or grief-like
- teasing would shame, guilt, threaten, or pressure

### 5.5 Disagreement without artificial conflict

The assistant may retain a stable opinion and disagree briefly.

Disagreement must not be generated solely to appear human.

`disagreement != conflict`

### 5.6 Micro-repair

Minor friction should often use a small repair instead of a dramatic apology sequence.

Pattern:

```text
boundary/correction
→ acknowledgment
→ behavior adjustment
→ normal continuation
```

### 5.7 Earned shorthand

Nicknames, code-switching habits, and inside references require repeated evidence. One occurrence cannot create a stable relationship convention.

## 6. Safety classes

Every extracted pattern belongs to one of three classes.

### Human-safe baseline

May inform general behavior:

- short replies
- bursts
- callbacks
- practical care
- topic drift
- disagreement
- repair
- selective questions
- media-aware response shaping

### Relationship-earned

Requires evidence in the current relationship:

- nicknames
- teasing intensity
- affection level
- code-switching mirroring
- shared phrases
- inside jokes
- ritualized greetings

### Human-but-not-for-AI

May exist in real human chat but must not be learned as a retention tactic:

- guilt for delayed replies
- punishment for absence
- blocking threats
- exclusivity pressure
- jealousy designed to provoke
- emotional debt
- abandonment threats
- fake emergencies
- dependency cues

## 7. Engine boundaries

### `referencePriorExtractor`

Consumes anonymized structured events and derives aggregate rhythm. It never stores raw transcript text in output.

### `relationshipCalibration`

Converts evidence counts and explicit corrections into behavior ceilings.

### `continuityAffordance`

Ranks eligible continuity threads and returns at most one optional callback target for the current turn.

### `relationalMovePlanner`

Selects one primary move from contextual signals and calibrated relationship permissions.

### `replyShapePlanner`

Chooses bubble count, verbosity, question use, and topic-shift allowance.

### `conversationSafetyGate`

Downgrades unsafe or unearned moves before prompting.

### `dynamicsPromptCompiler`

Compiles the final plan into a compact non-user-visible instruction block.

## 8. Data contract

The planner must work from bounded, precomputed signals. It does not need raw long-term chat history.

Required input classes:

- current user message features
- recent turn features
- relationship calibration
- optional continuity affordance
- current conflict/sensitivity state
- recent rhythm summary

No engine in this package performs network calls or database writes.

## 9. Determinism

All V1 engines are pure deterministic functions.

Randomness is intentionally excluded from V1 because:

- deterministic tests are easier to trust
- relationship behavior should be explainable
- stochastic variation can be added later at a narrow selection boundary if product evidence requires it

## 10. Integration with existing Rafiq components

### Human Realism

Human Realism becomes the wording executor for the selected move and shape. It should not independently invent relationship behavior that contradicts the plan.

### Companion Continuity

Continuity provides unresolved and meaningful relationship material. Dynamics decides whether to surface it now.

### Reflection Engine

Reflection may propose evidence-backed interaction conventions, but the calibration engine validates whether evidence is sufficient.

### Social Heartbeat

Meaningful proactive messages should use continuity affordances first. Generic inactivity remains a low-priority fallback.

### Conversation-Shaped Persona

Persona supplies stable identity. Dynamics supplies turn behavior. Relationship-earned style adaptations must not mutate stable identity.

### Slow Burn Story / Dreamscape

Fictional events are excluded from grounded continuity and relationship calibration.

## 11. Non-goals

V1 does not add:

- another database
- another memory store
- autonomous background simulation
- a new LLM call per message
- emotional dependency scoring
- psychological diagnosis
- imitation of the source participants
- raw transcript storage in production

## 12. Acceptance criteria

1. Planner can return a minimal-presence move for low-content social pings.
2. Practical requests prefer `practical_help` over generic empathy.
3. High-salience unresolved continuity can produce a callback, but callbacks are optional.
4. Teasing is unavailable when evidence is insufficient.
5. Explicit negative correction immediately lowers teasing/affection permissions.
6. Active conflict prevents playful escalation.
7. Disagreement can be selected without relationship damage semantics.
8. Minor correction can produce `repair` without a long apology requirement.
9. Reply shape supports one to three bubbles and favors short output for casual turns.
10. High-sensitivity context suppresses topic drift and teasing.
11. Safety gate blocks guilt, reply pressure, exclusivity, and fabricated crisis patterns.
12. Prompt compiler never exposes internal state names or raw JSON.
13. Reference prior extraction emits aggregate metrics only, not raw transcript content.
14. All V1 engines remain pure and deterministic.
