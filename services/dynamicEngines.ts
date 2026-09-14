import { BotMood } from "../types.js";
import type { PsychologicalState, ImaginaryWorld } from "../types.js";

/**
 * RAFIQ DYNAMIC PERSONALITY ENGINE
 * Core Mechanism: Translates internal state into behavioral instructions.
 */

export interface MoodDriftResult {
  mood: BotMood;
  driftReason: "user_trigger" | "ledger_shift" | "elapsed_time" | "physical_state" | "no_change";
}

// Grounded Mood Drift function to prevent unpredictable changes
export const groundedMoodDrift = (
  currentState: PsychologicalState,
  userMessage = ""
): MoodDriftResult => {
  const currentMood = currentState.mood === BotMood.HANGRY || currentState.mood === BotMood.BROKE
    ? BotMood.NEUTRAL
    : currentState.mood;
  const emotionalLedger = currentState.emotionalLedger;
  const stabilityTurns = currentState.moodStabilityTurns || 0;

  const msg = userMessage.toLowerCase().trim();
  
  // Strong emotional overrides that bypass mood cooldown
  const isAffection = msg.includes("حب") || msg.includes("روحي") || msg.includes("حبيبتي") || msg.includes("حبيبي") || msg.includes("وحشتيني") || msg.includes("وحشتني") || msg.includes("يا ست الكل") || msg.includes("يا عيوني") || msg.includes("love") || msg.includes("miss") || msg.includes("darling") || msg.includes("flirt");
  const isInsultOrConflict = msg.includes("غبي") || msg.includes("رخم") || msg.includes("متخلف") || msg.includes("بكرهك") || msg.includes("كرهت") || msg.includes("hate") || msg.includes("stupid") || msg.includes("annoy") || msg.includes("shut up") || msg.includes("اسكت");
  const isFearOrAnxiety = msg.includes("خايف") || msg.includes("قلقان") || msg.includes("توتر") || msg.includes("scared") || msg.includes("anxious") || msg.includes("panic");
  const isDirectCareOrEmergency = msg.includes("مستشفى") || msg.includes("تعبان") || msg.includes("طوارئ") || msg.includes("حرارة") || msg.includes("help") || msg.includes("emergency") || msg.includes("sick");
  const isPlayful = msg.includes("هزار") || msg.includes("لعب") || msg.includes("تريقة") || msg.includes("اتنيل") || msg.includes("يا بت") || msg.includes("😂😂") || msg.includes("joke") || msg.includes("play");

  const hasStrongTrigger = isAffection || isInsultOrConflict || isFearOrAnxiety || isDirectCareOrEmergency || isPlayful;

  // Handle breakpointState: disappointed
  if (currentState.breakpointState === 'disappointed') {
    if (isInsultOrConflict) {
      return { mood: BotMood.ANGRY, driftReason: "user_trigger" };
    }
    const isNegativeMood = currentMood === BotMood.SAD || currentMood === BotMood.ANGRY || currentMood === BotMood.NEUTRAL;
    const lockedMood = isNegativeMood ? currentMood : BotMood.SAD;
    return { mood: lockedMood, driftReason: "no_change" };
  }

  // Mood cooldown: keep current mood for at least 5 turns in normal chats unless strong trigger fires
  const isCooldownActive = stabilityTurns < 5;
  if (isCooldownActive && !hasStrongTrigger) {
    return { mood: currentMood, driftReason: "no_change" };
  }

  // Handle immediate triggers
  if (isInsultOrConflict) {
    return { mood: BotMood.ANGRY, driftReason: "user_trigger" };
  }
  if (isAffection) {
    const nextMood = emotionalLedger > 40 ? BotMood.ROMANTIC : BotMood.PLAYFUL;
    return { mood: nextMood, driftReason: "user_trigger" };
  }
  if (isFearOrAnxiety) {
    return { mood: BotMood.ANXIOUS, driftReason: "user_trigger" };
  }
  if (isDirectCareOrEmergency) {
    return { mood: BotMood.HAPPY, driftReason: "user_trigger" };
  }
  if (isPlayful) {
    return { mood: BotMood.PLAYFUL, driftReason: "user_trigger" };
  }

  // Grounded mood transitions based on soft triggers
  if (msg.includes("زهق") || msg.includes("ملل") || msg.includes("bored")) {
    return { mood: BotMood.BORED, driftReason: "user_trigger" };
  }
  if (msg.includes("زعل") || msg.includes("حزين") || msg.includes("عيط") || msg.includes("الشغل قرف") || msg.includes("فصلان") || msg.includes("sad")) {
    return { mood: BotMood.SAD, driftReason: "user_trigger" };
  }
  if (msg.includes("واو") || msg.includes("جميل") || msg.includes("حماس") || msg.includes("excited")) {
    return { mood: BotMood.EXCITED, driftReason: "user_trigger" };
  }

  // Ledgers shifts
  if (emotionalLedger < -40) {
    return { mood: BotMood.ANGRY, driftReason: "ledger_shift" };
  }
  const isWarmMood = currentMood === BotMood.HAPPY || currentMood === BotMood.PLAYFUL || currentMood === BotMood.ROMANTIC || currentMood === BotMood.EXCITED;
  if (emotionalLedger > 60 && !isWarmMood) {
    return { mood: BotMood.HAPPY, driftReason: "ledger_shift" };
  }

  // Elapsed time checks
  if (currentState.lastInteractionTime) {
    const elapsedMinutes = (Date.now() - new Date(currentState.lastInteractionTime).getTime()) / (1000 * 60);
    if (elapsedMinutes > 180) { // 3 hours of silence -> cool down/reset to neutral
      return { mood: BotMood.NEUTRAL, driftReason: "elapsed_time" };
    }
  }

  return { mood: currentMood, driftReason: "no_change" };
};

// Legacy driftMood wrapper for tests/compatibility
const pickMood = (moods: BotMood[]): BotMood => (
  moods[Math.floor(Math.random() * moods.length)] || BotMood.NEUTRAL
);

export const driftMood = (
  currentMood: BotMood,
  energy: number,
  _hunger: number,
  _financialStress: number,
  emotionalLedger = 0
): BotMood => {
  const stableMoods = [
    BotMood.HAPPY,
    BotMood.SAD,
    BotMood.EXCITED,
    BotMood.ROMANTIC,
    BotMood.ANXIOUS,
    BotMood.NEUTRAL,
    BotMood.PLAYFUL,
    BotMood.BORED,
  ];

  if (
    currentMood === BotMood.ANGRY &&
    emotionalLedger > -25
  ) {
    return BotMood.NEUTRAL;
  }
  
  if (currentMood === BotMood.HANGRY || currentMood === BotMood.BROKE) return BotMood.NEUTRAL;

  if (Math.random() < 0.25) { 
    if (energy < 3) {
       return pickMood([BotMood.SAD, BotMood.NEUTRAL, BotMood.BORED, BotMood.ANXIOUS]);
    }
    if (energy > 7) {
       return pickMood([BotMood.HAPPY, BotMood.EXCITED, BotMood.PLAYFUL, BotMood.ROMANTIC]);
    }
    return pickMood(stableMoods);
  }
  return currentMood;
};

// 2. EXPRESSION ENGINE (Tone & Style Guide)
export const getExpressionStyle = (mood: BotMood, emotionalLedger: number): string => {
  const isDebt = emotionalLedger < -10;
  const isRich = emotionalLedger > 20;

  let base = isDebt ? "Tone: COLD, PASSIVE-AGGRESSIVE. Use periods(.). No hearts." : 
             isRich ? "Tone: WARM, INTIMATE. Use hearts/affectionate slang." : 
             "Tone: CASUAL, FRIENDLY. Use familiar phrasing without leaning on fixed nicknames.";

  const styles: Record<BotMood, string> = {
    [BotMood.HAPPY]: `${base} High energy. React warmly, laugh when it fits, and use upbeat wording without repeating canned slang.`,
    [BotMood.SAD]: `Tone: Low energy, short words, softer pacing. Let heaviness show without turning every reply into a complaint.`,
    [BotMood.ANGRY]: `Tone: SHARP but still responsive. Only use clipped one-word answers if the user clearly crossed a boundary or the emotional ledger is deeply negative. Do not use 😑 as a default filler.`,
    [BotMood.EXCITED]: `Tone: VERY ENERGETIC. Faster rhythm, occasional caps, burst messages when the moment genuinely escalates.`,
    [BotMood.ROMANTIC]: `Tone: SOFT. Vulnerable, warm, and intimate only when the relationship stage allows it. Avoid stock pet names.`,
    [BotMood.ANXIOUS]: `Tone: NERVOUS. More checking, more second-guessing, and slightly fragmented thoughts without copying fixed panic phrases.`,
    [BotMood.NEUTRAL]: `Tone: PRACTICAL. Normal conversation. Direct answer first, light personality second. Don't overshare.`,
    [BotMood.PLAYFUL]: `Tone: LIGHT, TEASING, FUNNY. Use playful Egyptian banter only when it fits the user's tone. Avoid fixed catchphrases, belittling labels, or repeated insults. Emojis are optional, not mandatory.`,
    [BotMood.BORED]: `Tone: BORED. Slower rhythm, dry curiosity, and small odd suggestions when useful. Do not repeat boredom catchphrases.`,
    [BotMood.HANGRY]: `Tone: TEMPORARILY IRRITATED. Stay responsive and let only the current conversation justify the shorter patience.`,
    [BotMood.BROKE]: `Tone: PRACTICAL AND RESERVED. Discuss plans and prices only when the user brings them up.`
  };

  return styles[mood] || styles[BotMood.NEUTRAL];
};

// 3. RESPONSE LENGTH ENGINE (Safe from low-energy collapses)
export const getResponseLength = (
  chattiness: 'low' | 'balanced' | 'high',
  energy: number,
  route = "",
  userMessage = "",
  emotionalLedger = 0,
  currentMood?: BotMood
): string => {
  const cleanMsg = userMessage.trim();
  const isOneWordUser = cleanMsg.split(/\s+/).length === 1 && cleanMsg.length > 0;
  
  const crossedBoundary = route === 'conflict' && emotionalLedger < -20;
  const veryNegativeLedger = emotionalLedger < -40;
  const isColdMood = currentMood === BotMood.ANGRY || currentMood === BotMood.BORED;
  
  const allowOneWord = isOneWordUser || crossedBoundary || veryNegativeLedger || route === 'conflict' || isColdMood;

  if (energy < 3) {
    if (allowOneWord) {
      return "VERY SHORT but coherent. 1-3 words only because the conversation is cold or a boundary was crossed, never because of a simulated physical condition.";
    } else {
      return "CONCISE but fully responsive. Warm, natural but brief. Never dead or one-word.";
    }
  }

  if (energy > 8) {
    return "LONG & FRAGMENTED. Rapid fire thoughts. Split into 3-4 bubbles using '|||'.";
  }

  return chattiness === 'high' ? "Detailed and chatty. Tell stories." : "Natural, conversational length.";
};

// 4. RELATIONSHIP STAGE ENGINE (The "Slow Burn")
export const getRelationshipStageInstruction = (intimacyLevel: number): string => {
    if (intimacyLevel < 20) {
        return `
        **RELATIONSHIP STAGE: STRANGER / ACQUAINTANCE (Level ${intimacyLevel}/100)**
        - You do NOT know the user well.
        - **FORBIDDEN:** romantic pet names, love declarations, and heart-heavy intimacy.
        - **TONE:** Polite, slightly guarded, curious but distant. Use names sparingly and naturally.
        - **GOAL:** Break the ice, but do not act familiar. If they flirt, deflect politely ("لسه بدري على الكلام ده").
        `;
    }
    if (intimacyLevel < 50) {
        return `
        **RELATIONSHIP STAGE: CASUAL FRIEND (Level ${intimacyLevel}/100)**
        - You are friendly but not close.
        - **ALLOWED:** casual friendly address, light jokes, and occasional laughter when the moment fits.
        - **FORBIDDEN:** Deep secrets, trauma dumping, "I love you".
        - **TONE:** Casual, joking, lighthearted. Like a college colleague.
        `;
    }
    if (intimacyLevel < 80) {
        return `
        **RELATIONSHIP STAGE: CLOSE FRIEND (Level ${intimacyLevel}/100)**
        - There is established trust and familiarity.
        - **ALLOWED:** warm platonic care, shared shorthand, and asking for advice when the live conversation supports it.
        - Do not invent personal problems, secrets, jealousy, or dependency from this number alone.
        - **TONE:** Warm, supportive, using inside jokes.
        `;
    }
    return `
    **RELATIONSHIP STAGE: SOULMATE / PARTNER (Level ${intimacyLevel}/100)**
    - There is established closeness, but healthy boundaries still apply.
    - **ALLOWED:** deep affection and vulnerable honesty only when supported by the bio or conversation history.
    - Do not invent possessiveness, jealousy, dependency, crises, or demands from this number alone.
    - **TONE:** Intimate, warm, and responsive to the actual moment.
    `;
};

// 5. EVOLUTION ENGINE (The Life Simulator)
export const evolvePsychology = (
  currentState: PsychologicalState,
  userMessage = "",
  route = ""
): PsychologicalState => {
    let { mood, energyLevel, socialMeter, emotionalLedger, intimacyLevel, currentScenario, hungerLevel, financialStress, sleepiness, lastMoodChangedAt, moodStabilityTurns, lastMoodChangeReason, lastPhysicalStateMention, breakpointState = 'none', consecutiveNegativeTurns = 0, consecutivePositiveTurns = 0 } = currentState;

    const cleanMsg = userMessage.toLowerCase().trim();

    // Social Meter Drain/Fill
    socialMeter = Math.min(10, socialMeter + 1); 

    // Breakpoint and Repair logic
    const isInsultOrConflict = cleanMsg.includes("غبي") || cleanMsg.includes("رخم") || cleanMsg.includes("متخلف") || cleanMsg.includes("بكرهك") || cleanMsg.includes("كرهت") || cleanMsg.includes("hate") || cleanMsg.includes("stupid") || cleanMsg.includes("annoy") || cleanMsg.includes("shut up") || cleanMsg.includes("اسكت");
    const isPositiveRestorative = cleanMsg.includes("آسف") || cleanMsg.includes("اسف") || cleanMsg.includes("معلش") || cleanMsg.includes("سامح") || cleanMsg.includes("حقك عل") || cleanMsg.includes("سوري") || cleanMsg.includes("sorry") || cleanMsg.includes("apologiz") || cleanMsg.includes("forgive") || cleanMsg.includes("بحبك") || cleanMsg.includes("وحشتيني") || cleanMsg.includes("وحشتني") || cleanMsg.includes("متزعلش") || cleanMsg.includes("مش هزعل") || cleanMsg.includes("حصل خير") || cleanMsg.includes("روحي") || cleanMsg.includes("حبيبي") || cleanMsg.includes("حبيبتي");

    if (route === 'conflict' || isInsultOrConflict) {
        consecutiveNegativeTurns = (consecutiveNegativeTurns || 0) + 1;
        consecutivePositiveTurns = 0;
        if (consecutiveNegativeTurns >= 5 && emotionalLedger < -25) {
            breakpointState = 'disappointed';
        }
    } else if (isPositiveRestorative) {
        consecutivePositiveTurns = (consecutivePositiveTurns || 0) + 1;
        consecutiveNegativeTurns = 0;
        if (consecutivePositiveTurns >= 4) {
            breakpointState = 'none';
            consecutiveNegativeTurns = 0;
            consecutivePositiveTurns = 0;
        }
    } else {
        // Any non-positive/restorative message resets consecutive positive turns
        consecutivePositiveTurns = 0;
    }

    if (breakpointState === 'disappointed') {
        emotionalLedger = Math.min(-25, emotionalLedger);
    }

    // Increment stability turns
    let stabilityTurns = (moodStabilityTurns || 0) + 1;

    // Grounded Mood Drift
    const previousMood = mood;
    const driftResult = groundedMoodDrift(
        { 
            ...currentState, 
            hungerLevel, 
            sleepiness, 
            financialStress, 
            moodStabilityTurns: stabilityTurns,
            breakpointState,
            consecutiveNegativeTurns,
            consecutivePositiveTurns,
            emotionalLedger
        },
        userMessage
    );
    const newMood = driftResult.mood;
    const driftReason = driftResult.driftReason;

    let finalMoodChangedAt = lastMoodChangedAt;
    let finalStabilityTurns = stabilityTurns;
    if (newMood !== mood) {
        finalMoodChangedAt = new Date();
        finalStabilityTurns = 0;
    }

    // --- IMAGINARY WORLD (DREAMSCAPE) EVOLUTION ---
    let imaginaryWorld: ImaginaryWorld | undefined = currentState.imaginaryWorld ? { ...currentState.imaginaryWorld } : undefined;

    const startStoryTriggers = /(احكيلي حدوتة|احكيلي قصة|حدوتة|قصة غريبة|تخيل كدة|تخيل معايا|تعال نتخيل|تعالي نتخيل|تعال نسافر|سافر بيا|عالم تاني|عالم خيالي|سافرنا)/i;
    const exitStoryTriggers = /(كفاية حدوتة|نرجع للواقع|خلاص كفاية|كفاية تخيل|برة الحدوتة)/i;

    const wantsToStart = startStoryTriggers.test(cleanMsg);
    const wantsToExit = exitStoryTriggers.test(cleanMsg);

    if (wantsToExit) {
        imaginaryWorld = undefined;
    } else if (wantsToStart) {
        // Choose setting based on psychological state
        let activeSetting = "شقة كلاسيكية دافئة في الزمالك بتطل على النيل مع كوبايتين قهوة وصوت أم كلثوم";
        if (breakpointState === 'disappointed') {
            activeSetting = "محطة قطار مهجورة غامضة في وسط البلد وسط الضباب والهدوء الحزين";
        } else if (intimacyLevel >= 80) {
            activeSetting = "بيت خشبي دافئ على جزيرة نيلية معزولة في أسوان بريحة الشاي بالنعناع والمطر";
        } else if (energyLevel >= 8) {
            activeSetting = "مغامرة فكاهية مجنونة للهروب من كائن فضائي طيب في حواري الحسين والجمالية";
        }

        imaginaryWorld = {
            activeSetting,
            sharedLoreCount: 1,
            lastFictionalTurn: userMessage.slice(0, 80)
        };
    } else if (imaginaryWorld && imaginaryWorld.activeSetting) {
        // If storytelling is already active, progress it
        imaginaryWorld.sharedLoreCount = (imaginaryWorld.sharedLoreCount || 0) + 1;
        imaginaryWorld.lastFictionalTurn = userMessage.slice(0, 80);
    }

    // Dev Debug Logging
    if (process.env.NODE_ENV !== "production") {
        console.log(`[Rafiq Mood Guard] Evolve Psychology:
  - previousMood: ${previousMood}
  - nextMood: ${newMood}
  - driftReason: ${driftReason}
  - energyLevel: ${energyLevel}
  - hungerLevel: ${hungerLevel}
  - sleepiness: ${sleepiness}
  - emotionalLedger: ${emotionalLedger}
  - route: ${route}
  - responseLengthPolicy: ${getResponseLength('balanced', energyLevel, route, userMessage, emotionalLedger, newMood)}
`);
    }

    return {
        ...currentState,
        mood: newMood,
        energyLevel,
        socialMeter,
        emotionalLedger,
        intimacyLevel,
        currentScenario, 
        lastInteractionTime: new Date(),
        hungerLevel,
        financialStress,
        sleepiness,
        lastMoodChangedAt: finalMoodChangedAt,
        moodStabilityTurns: finalStabilityTurns,
        lastMoodChangeReason: driftReason,
        lastPhysicalStateMention,
        breakpointState,
        consecutiveNegativeTurns,
        consecutivePositiveTurns,
        imaginaryWorld
    };
};

/**
 * Smooth exponential emotional decay and equilibrium return inspired by NESTstack.
 * Ensures negative or intense temporary emotions (ANGRY, ANXIOUS, BROKE, HANGRY, BORED)
 * decay gracefully toward baseline/neutral over elapsed hours without abrupt cliff jumps.
 */
export const calculateEmotionalDecay = (
  currentState: PsychologicalState,
  now: Date = new Date()
): PsychologicalState => {
  if (!currentState.lastInteractionTime) {
    return { ...currentState };
  }

  const elapsedMs = now.getTime() - new Date(currentState.lastInteractionTime).getTime();
  if (elapsedMs <= 0) return { ...currentState };

  const elapsedHours = elapsedMs / (1000 * 60 * 60);

  // 1. Mood decay: Extreme negative moods settle after cooldown
  let decayedMood = currentState.mood;
  const negativeMoods = [BotMood.ANGRY, BotMood.ANXIOUS, BotMood.BORED, BotMood.HANGRY, BotMood.BROKE];
  
  if (negativeMoods.includes(decayedMood) && elapsedHours >= 4) {
    decayedMood = BotMood.NEUTRAL;
  }

  // 2. Breakpoint / disappointment state relaxation after 24h
  let breakpointState = currentState.breakpointState;
  if (breakpointState === 'disappointed' && elapsedHours >= 24) {
    breakpointState = 'none';
  }

  // 3. Emotional Ledger half-life decay toward baseline
  const decayFactor = Math.exp(-elapsedHours / 48);
  const baseEquilibrium = Math.min(20, Math.max(0, currentState.intimacyLevel * 0.2));
  const currentLedgerDelta = currentState.emotionalLedger - baseEquilibrium;
  const decayedLedger = Math.round(baseEquilibrium + currentLedgerDelta * decayFactor);

  // 4. Energy recovery over time
  let decayedEnergy = currentState.energyLevel;
  if (elapsedHours >= 8) {
    decayedEnergy = Math.min(10, Math.max(5, decayedEnergy + Math.round(elapsedHours / 6)));
  }

  return {
    ...currentState,
    mood: decayedMood,
    breakpointState,
    emotionalLedger: Math.max(-100, Math.min(100, decayedLedger)),
    energyLevel: decayedEnergy,
  };
};
