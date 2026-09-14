# Rafiq Engine Injection Map

This document maps the standalone dynamics package onto the existing Rafiq architecture. It is intentionally adapter-level guidance, not a rewrite of existing engines.

## 1. `humanRealism.ts`

### Current responsibility

Wording realism, restraint, subtext, healthy agency, and anti-fabrication constraints.

### Injection

Before compiling the final Human Realism instruction, call the dynamics planner and append only `compileDynamicsPrompt(plan)`.

Human Realism should obey the planned move and reply shape instead of independently deciding to be verbose, inquisitive, playful, or emotionally intense.

### Hard rule

Do not let Human Realism override safety downgrades produced by `conversationSafetyGate`.

---

## 2. `companionContinuity.ts`

### Current responsibility

Unresolved threads, opinions, expectations, rituals, and time transitions.

### Injection

Map at most a bounded subset of eligible continuity items into `ContinuityCandidate[]`:

```ts
{
  id,
  kind,
  summary,
  salience,
  relevance,
  due,
  expired,
  resolved,
  sourceEvidenceCount,
}
```

Pass them to `planConversation`. The dynamics layer may select zero or one callback.

### Hard rule

Do not inject all remembered items into the wording prompt. `remembered != must mention`.

---

## 3. `reflectionEngine.server.ts`

### Current responsibility

Evidence-backed reflection proposals.

### Injection

Reflection may additionally emit bounded relationship-interaction evidence counters, for example:

- positive playful reciprocation
- explicit negative teasing correction
- reciprocated nickname use
- user-origin code-switch example
- shared-reference reciprocation
- positive response to direct disagreement

These counters feed `RelationshipEvidence`.

### Hard rule

Do not infer diagnoses, attachment pathology, or personality disorders. Evidence must be linked to actual message IDs and validated before persistence.

---

## 4. `socialHeartbeat.ts`

### Current responsibility

Proactive-message policy, quiet hours, cooldown, caps, and continuity trigger priority.

### Injection

For an already-authorized meaningful proactive trigger, build a `DynamicsInput` representing a callback/check-in and run it through the same safety and reply-shape logic.

Use dynamics to keep proactive messages compact and concrete.

### Hard rule

Dynamics does not bypass quiet hours, daily caps, cooldown, conflict suppression, or delivery policy.

---

## 5. `conversationShapedPersona.ts`

### Current responsibility

Stable persona integrity and clean-persona behavior.

### Injection

Use `RelationshipCalibration` as a ceiling for relationship-earned style:

- teasing
- nicknames
- code-switch mirroring
- shared shorthand
- direct disagreement

Persona remains identity authority. Calibration only controls whether a style behavior is currently earned.

---

## 6. `useChatController.ts`

### Recommended runtime seam

Build the bounded dynamics input immediately before final model context compilation, after route classification and continuity selection inputs are available.

Pseudo-flow:

```ts
const evidence = deriveRelationshipEvidence(currentRelationshipState);
const continuityCandidates = deriveContinuityCandidates(currentChat.continuityState, lastMessage);

const plan = planConversation({
  input: buildDynamicsInput(...),
  evidence,
  continuityCandidates,
  callbackBudgetAvailable: true,
});

const dynamicsInstruction = compileDynamicsPrompt(plan);
finalExternalContext = joinContext(finalExternalContext, dynamicsInstruction);
```

The controller should remain thin. Feature detection and relationship interpretation should live outside React.

---

## 7. Story and group isolation

Do not derive grounded relationship evidence from:

- Slow Burn Story
- Dreamscape
- explicit fictional roleplay
- group-bot chatter
- temporary streaming previews
- failed generations

Private one-to-one relationship calibration must remain isolated from group behavior.

---

## 8. Suggested rollout

1. Shadow mode: compute plan and log aggregate move names locally, do not modify prompts
2. Prompt injection for one-to-one normal chat only
3. Enable continuity callback selection
4. Enable relationship-earned teasing/nickname ceilings
5. Reuse reply-shape logic for meaningful proactive follow-ups

Evaluate repetition, unwanted intimacy, question density, callback accuracy, correction rate, and user-rated naturalness before expanding scope.
