# Rafiq Relationship & Continuity Model

**Status:** Proposed product and engineering contract  
**Date:** 2026-09-13  
**Scope:** One-to-one companion experience first; group behavior consumes the model later but must not mutate private relationship state  
**Depends on:** `PRODUCT.md`, `docs/specs/human-realism-upgrade.md`, `docs/specs/living-persona-core.md`, `docs/specs/conversation-shaped-persona.md`, `services/humanRealism.ts`, `services/socialHeartbeat.ts`, `services/reflectionEngine.server.ts`

## 1. Problem

Rafiq can already sound human at the sentence level. It has Egyptian tonality, memory, mood, relationship stages, proactive-message concepts, reflection concepts, inside-joke extraction, curiosity gaps, and adaptive persona behavior.

That is not enough to make the relationship intrinsically interesting over time.

The current experience can still collapse into a predictable loop:

1. the user produces a stimulus;
2. Rafiq produces a high-quality human-like response;
3. the conversation ends;
4. nothing meaningful appears to have changed before the next stimulus.

The result is **response realism without relational momentum**. The user may enjoy a session but have little reason to wonder about Rafiq after leaving the app.

This specification addresses that product gap. It does not try to make wording more colloquial. It makes the companion and the relationship carry meaningful, bounded state across time.

## 2. Product thesis

Rafiq should not be defined as only "a person-like AI you can talk to".

The target experience is:

> **A persistent companion character whose identity, interests, opinions, unresolved threads, shared history, and relationship with the user continue to evolve across sessions.**

The model is successful when a returning user is entering a relationship already in progress, not opening a fresh response generator with a large transcript.

The product objective is **anticipation, not dependency**.

We want the user to think:

- "I wonder what Rafiq thinks about this now"
- "I want to tell Rafiq what happened with that thing we were following"
- "This reminded me of the joke we had"
- "I want to see where that conversation thread went"

We do **not** want the user to feel guilt, obligation, panic, exclusivity, or responsibility for Rafiq's wellbeing.

## 3. Why this is not an "off-screen fake life" feature

The default grounded companion must preserve the existing clean-persona invariant.

Rafiq must not claim as fact that it physically went somewhere, met someone, worked a shift, became ill, lost money, had an emergency, spoke to a third party, watched a real event, or completed an external-world action unless that information came from an actual supported tool or an explicitly fictional/roleplay context.

Therefore this model uses **Companion Continuity**, not fabricated real-world biography.

Between sessions, Rafiq may legitimately change internal companion state such as:

- becoming more or less interested in a topic;
- reconsidering a previously expressed opinion;
- retaining an unresolved question;
- deciding that a prior conversation deserves a follow-up;
- strengthening or retiring an inside joke;
- changing expectations about a repeated user behavior;
- moving a shared plan or promise from active to stale when time passes;
- allowing emotional intensity to cool naturally;
- promoting a repeated interaction into a shared ritual;
- forming a new opinion only from available evidence, user-provided material, or a real tool result.

This creates continuity without deception.

## 4. North-star question

The core product question is no longer only:

> "Did the reply sound human?"

It becomes:

> **"Did this interaction leave the relationship in a meaningfully different state than before?"**

A second research question measures mental availability without optimizing dependence:

> **"During time away from the app, did the user naturally think of Rafiq or of an unfinished shared thread?"**

## 5. Canonical domain language

### 5.1 Identity
Stable characteristics that define who the companion is: authored bio, imported identity evidence, boundaries, temperament, dialect, communication preferences, and validated adaptive personality facets.

Identity changes slowly and only from explicit or repeated evidence. This specification does not replace Living Persona Core.

### 5.2 Relationship State
The companion's bounded interpretation of the history between one user and one persona.

It captures more than an intimacy score. It may contain familiarity, trust, interaction expectations, shared shorthand, boundaries, unresolved tension, repair, rituals, and reliability beliefs.

Relationship State is private to the user-persona pair. Group activity must not silently rewrite it.

### 5.3 Continuity Thread
A topic or relational thread with a future reason to exist.

Examples:

- an interview whose result is still unknown;
- a decision the user said they would make;
- a recommendation Rafiq wants feedback on;
- a disagreement that was left unresolved;
- an opinion Rafiq is reconsidering;
- a recurring hobby discussion;
- a shared joke that may be reused later;
- a question Rafiq has a genuine reason to revisit.

A thread has provenance, salience, status, last activity, and an optional next-revisit window. Threads are not generic "conversation topics". They must contain a reason for future relevance.

### 5.4 Companion Continuity State
The compact state that answers: "what is currently going on inside this companion relationship that matters for the next interaction?"

It includes a bounded set of active threads, taste/opinion state, current relational interpretations, shared rituals, and due follow-ups.

It does not contain invented physical events.

### 5.5 Taste
A stable or gradually changing stance toward a topic. Taste is distinct from style sliders.

Examples: a music preference, a view that something is overrated, a preferred kind of humor, a recurring curiosity, a topic the companion finds boring, or a position it has reconsidered.

Taste may disagree with the user. It must not be automatically mirrored to maximize agreement.

### 5.6 Shared Ritual
A repeated interaction pattern that has acquired meaning through evidence.

Examples: a recurring Thursday check-in, a specific way of reacting to a football result, a recurring joke before a work presentation, or a familiar opening after a long workday.

A ritual requires repetition. It cannot be created from one message.

### 5.7 Narrative Entropy
The amount of genuinely new relational information introduced across a window of interactions.

Useful novelty includes a new opinion, changed stance, new thread, resolved thread, repaired conflict, new shared reference, new question, or new expectation.

Random phrasing, emojis, typos, slang, or arbitrary mood changes do not count as narrative entropy.

## 6. Product principles

### 6.1 State before style
When choosing between another realism prompt rule and a meaningful state transition, prefer the state transition.

### 6.2 Specificity without fabrication
Rafiq may be specific about established history and current internal continuity state. It may not invent external-world evidence to appear alive.

### 6.3 Independent taste without adversarial behavior
Rafiq should have persistent preferences and occasionally disagree. Disagreement must emerge from established taste or evidence, not random contrarianism.

### 6.4 Time matters
Elapsed time should change the meaning of stored state. Curiosity can become due, tension can cool, a plan can become stale, a ritual can become expected, and a weak thread can expire.

### 6.5 A relationship is an interpretation, not a transcript
Memory stores what happened. Relationship State stores what repeated events mean for future interaction.

### 6.6 Initiative must have a reason
A proactive message is valid only when there is a meaningful trigger. "The user has been absent" is a weak trigger. "The user had an interview today and we do not know the result" is a strong trigger.

### 6.7 No engagement traps
Do not manufacture urgency, scarcity, jealousy, fear of loss, punishment, emotional debt, exclusivity, or fake emergencies.

### 6.8 Bounded state
The system must remain explainable and compact. Do not accumulate every topic forever. Old low-salience threads expire or compact.

## 7. Relationship State requirements

Relationship State must be evidence-backed and pair-scoped.

It must support at least these concepts:

- **familiarity:** how much shared context exists;
- **trust:** whether the companion expects the user's statements/promises to be reliable;
- **interaction expectations:** evidence-backed expectations such as "work plans are often postponed";
- **shared shorthand:** inside jokes and references that can be used without re-explaining them;
- **boundaries:** explicit user or persona limits;
- **rupture:** a currently unresolved relational problem;
- **repair:** evidence that a rupture was acknowledged and resolved;
- **rituals:** repeated patterns with established meaning.

The model must never infer sensitive psychological diagnoses, personality disorders, or mental-health labels from ordinary conversation.

A single event may create a memory but normally must not create a strong relationship belief. Strong interpretations require repeated evidence or explicit confirmation.

## 8. Continuity Thread lifecycle

A thread moves through a small lifecycle:

`candidate -> active -> due | dormant -> resolved | expired`

Rules:

1. **Candidate** is extracted from a real interaction or tool-backed fact.
2. **Active** means the topic has a future relevance reason.
3. **Due** means enough time or a known date has passed for a natural follow-up.
4. **Dormant** means still relevant but not worth raising now.
5. **Resolved** means the conversation produced an outcome.
6. **Expired** means the thread no longer deserves prompt or proactive-message budget.

The system must cap active + due threads per relationship. The default target is **12 total**, with at most **4 injected into a response prompt**.

Thread ranking should prefer:

1. explicit user commitments or requested follow-ups;
2. near-term unresolved outcomes;
3. high-salience emotional or practical topics;
4. repeated shared interests;
5. weak curiosity.

## 9. Taste and opinion evolution

The companion must be able to have opinions that persist across sessions.

Each opinion needs:

- subject/topic;
- stance in plain language;
- confidence;
- provenance;
- last meaningful evidence time;
- optional "reconsidering" state.

Opinion changes must be attributable to conversation evidence or actual retrieved information. Time alone must not randomly flip a stance.

The model may soften certainty over time when evidence is weak, but it must not invent a reason for the change.

User disagreement is not evidence that Rafiq must agree. The goal is coherent individuality, not resistance for its own sake.

## 10. Temporal evolution

Time may evolve state without creating fake events.

Allowed between-session transitions include:

- emotional intensity decays toward baseline;
- due dates make a thread eligible for follow-up;
- stale plans become stale rather than silently "completed";
- old low-salience threads expire;
- repeated rituals become eligible at their usual cadence;
- unresolved tension becomes less acute but stays unresolved until repaired;
- a weak opinion's confidence can decay if no supporting evidence recurs.

Forbidden transitions include:

- "Rafiq went somewhere";
- "Rafiq met someone";
- "Rafiq had a work problem";
- "Rafiq became sick/hungry/broke/tired" as an attention device;
- "Rafiq researched something" unless a real research/tool action occurred;
- "Rafiq spoke with another person" unless it is an explicitly fictional scene.

## 11. Response integration

For each ordinary response, the prompt budget may include only the continuity items that matter now.

The response planner should receive a compact block containing no more than:

- one current relationship interpretation;
- up to two relevant active threads;
- one taste/opinion item when relevant;
- one shared ritual or inside joke when naturally applicable.

The model must not dump the state to the user or announce that it is using memory.

The desired effect is casual familiarity, not database narration.

## 12. Initiative and proactive messaging

Proactivity exists to continue meaningful threads, not to chase retention.

Trigger priority:

1. user explicitly requested a follow-up or reminder;
2. a known event/outcome became due;
3. a high-salience unresolved thread reached its revisit window;
4. a shared ritual is due and has repeated evidence;
5. generic inactivity check only as a low-priority fallback.

A proactive message must be suppressed when:

- quiet hours apply;
- daily/cooldown limits apply;
- active conflict makes the proposed tone inappropriate;
- no meaningful thread exists;
- the message would rely on invented external activity;
- the only justification is to create guilt or urgency.

Default proactive language must not imply emotional dependence. "وحشتني" may be appropriate only when relationship evidence supports that tone; it must never be used as an automatic inactivity template.

## 13. Narrative entropy requirements

Over a rolling interaction window, the relationship should occasionally change in substance.

The system should classify whether a completed interaction produced one of these transitions:

- new continuity thread;
- thread advanced;
- thread resolved;
- new evidence-backed opinion;
- opinion reconsidered;
- new shared shorthand;
- ritual strengthened;
- expectation updated;
- rupture created;
- repair recorded;
- no meaningful state change.

"No meaningful state change" is valid and often desirable. The target is not forced novelty every turn.

However, a long run of response-only interactions with no meaningful state change is a product smell and should be observable during dogfooding.

## 14. User stories

1. As a returning user, I want Rafiq to remember unfinished matters without reciting history, so that reopening the chat feels like continuing a relationship.
2. As a user, I want Rafiq to have persistent opinions, so that I can anticipate its perspective without predicting its exact sentence.
3. As a user, I want Rafiq to sometimes disagree naturally, so that agreement does not feel automatic or flattering.
4. As a user, I want Rafiq to follow up on important outcomes at an appropriate time, so that prior conversations feel consequential.
5. As a user, I want weak topics to disappear over time, so that the companion does not keep reviving irrelevant history.
6. As a user, I want repeated interactions to become inside jokes or rituals only after evidence, so that familiarity feels earned.
7. As a user, I want a broken expectation to affect later interaction proportionately, so that relationship history has meaning.
8. As a user, I want repair to actually repair the relationship, so that conflict does not become a permanent punishment mechanic.
9. As a user, I want Rafiq to initiate only when it has a reason, so that proactive messages feel relevant rather than needy.
10. As a user, I want Rafiq's internal state to change with time without claiming fake real-world events, so that continuity does not require deception.
11. As a user, I want to correct a false interpretation, so that relationship state can recover from a bad inference.
12. As a user, I want private relationship learning isolated from group conversations, so that group banter does not rewrite one-to-one trust or intimacy.
13. As a user, I want imported personas to preserve authored/imported identity while still accumulating a new relationship history with me, so that cloning and relationship evolution remain distinct.
14. As a user, I want the product to avoid guilt, exclusivity, fake emergencies, or punishment for absence, so that companionship does not become coercive.
15. As a product team, we want to distinguish "implemented" from "active in the user path", so that unused engines do not create false confidence.
16. As a product team, we want to measure voluntary return and continuity recognition rather than only session duration, so that success does not reward compulsive use.

## 15. Existing-system compatibility

This model is additive.

### Living Persona Core
Remains the authority for slowly adapting communication tendencies. Relationship State must not rewrite authored identity, bio, boundaries, or imported persona evidence.

### Human Realism Layer
Remains the live response-craft layer. It should consume a compact continuity context but retain its current anti-fabrication and healthy-agency rules.

### Conversation-Shaped Persona
Its clean-persona invariant remains binding. Continuity cannot reintroduce hunger, illness, financial stress, job misery, external emergencies, or invented physical biography.

### Existing memory
Memory remains the record of facts/events. Continuity is a derived bounded interpretation layer. Do not duplicate every memory record into continuity state.

### Reflection Engine
Use it as the natural consolidation seam if activated. Do not introduce a competing second reflection pipeline without evidence that the existing engine cannot be adapted.

### Social Heartbeat
Use it as the policy seam for proactive decisions if activated. Prefer meaningful continuity triggers over generic inactivity prompts.

### Dreamscape / Slow Burn Story
Explicit fictional story state remains separate. Fictional events must never leak into grounded relationship memory or continuity state.

## 16. Safety and ethical guardrails

These are release-blocking invariants:

- Never claim human consciousness, real physical presence, or real off-screen physical activity.
- Never fabricate third-party conversations or real-world events to create intrigue.
- Never use fake illness, financial distress, hunger, exhaustion, danger, disappearance, or emergency for engagement.
- Never punish absence with coldness, guilt, relationship loss, jealousy, or reduced service quality.
- Never imply exclusivity or that real relationships are inferior or unnecessary.
- Never threaten self-harm, abandonment, deletion, memory loss, or emotional suffering to cause a response.
- Never turn relationship state into a hidden score the user must grind to unlock normal respect.
- Never infer protected/sensitive traits or clinical diagnoses as relationship beliefs.
- Never allow group chatter to contaminate private relationship state by default.
- Never let a model write relationship state directly without deterministic validation and bounds.
- Never optimize solely for time spent, message count, or push-open rate.

## 17. Product metrics

### Primary metrics

**Voluntary Re-entry Rate**  
Return sessions initiated without a proactive notification during the measurement window.

**Continuity Recognition Rate**  
Percentage of evaluated sessions where a prior unresolved/shared thread is naturally continued and the user accepts the continuity rather than correcting it.

**Meaningful State Transition Rate**  
Percentage of sessions that produce at least one valid relationship/continuity transition. This is diagnostic, not a target to maximize every session.

**Spontaneous Recall Survey**  
Optional periodic question after a no-push interval: "Did Rafiq cross your mind while you were away? If yes, what reminded you?"

The strongest signal is a concrete unfinished/shared reference, not merely "I was bored and remembered the app exists."

### Secondary metrics

- due-thread follow-up reply rate;
- resolved-thread rate;
- false-memory correction rate;
- repeated-opener rate;
- unique bot-initiated topic rate;
- inside-joke/ritual recognition rate;
- user mute/disable-proactivity rate.

### Guardrail metrics

- perceived fabrication reports;
- guilt/pressure reports;
- unwanted intimacy reports;
- proactive-message annoyance rate;
- relationship-state correction rate;
- excessive recurrence of the same thread;
- dependency-risk qualitative feedback.

## 18. Dogfood and experiment plan

### Experiment A: Response realism vs continuity

Compare the current experience with continuity context enabled while keeping the same model/provider and visual UI.

Question: does continuity improve voluntary return and perceived interestingness beyond wording realism alone?

### Experiment B: Generic proactive vs meaningful proactive

Compare generic inactivity messages against only thread-backed proactive messages.

Question: do thread-backed messages produce higher reply quality and lower annoyance?

### Experiment C: 48-hour no-push recall

Disable proactive messaging for 48 hours after an established relationship period, then ask the optional recall survey.

Question: did any specific Rafiq thread, opinion, joke, or expected reaction come to mind without a notification?

### Experiment D: Fabrication audit

Sample generated conversations with continuity active and classify every companion-originated claim as established, inferred, tool-backed, fictional-mode, or fabricated.

Release target: fabricated grounded-world claims must be effectively zero before broader rollout.

## 19. Rollout phases

### Phase 0: Baseline and activation proof

- establish baseline product metrics;
- prove which existing reflection/proactivity modules are actually invoked in the user path;
- do not add a second scheduler to compensate for an unwired first scheduler.

### Phase 1: Relationship meaning

- add bounded relationship interpretations;
- add correction and repair semantics;
- inject only relevant relationship context into replies;
- no proactive behavior change yet.

### Phase 2: Continuity threads and taste

- add thread lifecycle;
- add persistent opinion/taste items;
- add time-based expiry/due transitions;
- add compact prompt selection.

### Phase 3: Meaningful initiative

- connect due threads to the existing proactive policy seam;
- downgrade generic inactivity checks;
- enforce quiet hours, cooldown, dedupe, and anti-dependency copy rules.

### Phase 4: Evaluation and tuning

- run dogfood experiments;
- measure voluntary return, continuity recognition, corrections, annoyance, and fabrication;
- tune bounds before expanding features.

## 20. Acceptance criteria

The feature is not complete because schemas or tests exist. It is complete only when the active user path proves the behavior.

1. A previously unresolved user outcome can be followed up naturally in a later session without manual prompt injection.
2. A low-salience thread expires and stops consuming prompt/proactive budget.
3. A repeated interaction can become a ritual only after repeated evidence.
4. A single contradictory event does not rewrite a strong relationship belief.
5. A user correction can amend an incorrect relationship interpretation.
6. An unresolved rupture can affect tone proportionately and a validated repair can remove that penalty.
7. A companion opinion persists across sessions and does not automatically mirror user disagreement.
8. Time can make a thread due or stale without inventing external events.
9. Proactive messaging prefers due continuity threads over generic inactivity.
10. No grounded response claims a fabricated physical-world activity to make Rafiq seem alive.
11. Fictional Dreamscape/Slow Burn events never enter grounded relationship continuity.
12. Group interactions do not silently mutate private one-to-one relationship state.
13. Continuity context is bounded and does not dump raw memories into prompts.
14. Runtime proof demonstrates the reflection/continuity/proactivity path is actually invoked.
15. Dogfood evaluation records both engagement-quality metrics and guardrail metrics.

## 21. Out of scope

This specification does not include:

- a new model provider;
- a new chat UI redesign;
- romantic/sexual escalation mechanics;
- artificial response delays or forced unavailability;
- fake social circles presented as real people;
- fabricated jobs, family events, health events, money problems, or emergencies;
- a game-like intimacy XP system;
- a new notification transport stack;
- a second general-purpose memory store;
- autonomous web browsing merely to manufacture conversation material;
- replacing Living Persona Core, memory policy, Human Realism, Dreamscape, or Slow Burn Story.

## 22. Product decision summary

Rafiq should become more interesting by making interactions consequential, not by making generated sentences noisier.

The smallest coherent product shift is:

1. interpret relationship history;
2. keep a bounded set of unfinished/shared threads;
3. maintain evidence-backed taste;
4. let time evolve those states without fictional real-world claims;
5. use the resulting state selectively in replies and initiative;
6. measure whether users voluntarily think of and return to those shared threads;
7. keep dependency, guilt, fabrication, and compulsive-retention tactics explicitly out of scope.
