import { describe, it, expect } from "bun:test";
import { classifyConversationRoute } from "../services/conversationRouter.js";
import { cadenceMaestro } from "../services/cadenceMaestro.js";
import { egyptianSpintaxEngine } from "../services/egyptianSpintaxEngine.js";
import { voiceTroubadour } from "../services/voiceTroubadour.js";
import { evolvePsychology, groundedMoodDrift } from "../services/dynamicEngines.js";
import { compileHumanRealismInstruction } from "../services/humanRealism.js";
import { BotMood, type PsychologicalState } from "../types.js";

describe("Gehad Natural Communication Patterns Injection", () => {
  describe("1. Conversation Router (Empirical Egyptian Routes)", () => {
    it("classifies WhatsApp nudges and pings as social-nudge", () => {
      const pings = ["فينك", "انت فين", "؟؟", ".", "ازيك ازيك ازيك", "مبتردش ليه", "يا بني", "روحت فين"];
      for (const ping of pings) {
        const route = classifyConversationRoute(ping);
        expect(route.id).toBe("social-nudge");
        expect(route.summary).toContain("pinging or checking in");
        expect(route.firstPriority).toContain("Acknowledge the ping immediately");
      }
    });

    it("classifies frank assessment requests as frank-mirror", () => {
      const mirrorPhrases = [
        "شايفني ازاي",
        "ايه رأيك فيا بدون مجاملة",
        "اي اكتر حاجة كويسة فيا",
        "ايه الحلو وايه الوحش",
      ];
      for (const phrase of mirrorPhrases) {
        const route = classifyConversationRoute(phrase);
        expect(route.id).toBe("frank-mirror");
        expect(route.summary).toContain("unvarnished opinion");
        expect(route.firstPriority).toContain("candid, authentic, direct assessment");
      }
    });

    it("handles Egyptian venting with grounded empathy priorities", () => {
      const ventingPhrases = ["الشغل قرف", "فصلان وتعبان", "تعبانة ومتضايقة"];
      for (const phrase of ventingPhrases) {
        const route = classifyConversationRoute(phrase);
        expect(route.id).toBe("venting");
        expect(route.firstPriority).toContain("Provide immediate, grounded Egyptian comfort");
      }
    });
  });

  describe("2. Cadence Maestro (Micro-Bubble Delays)", () => {
    it("splits multi-bubble thoughts into timed bubbles", () => {
      const rawText = "رحيم ||| حنين ||| جدع ||| كريم";
      const bubbles = cadenceMaestro.splitIntoBubbles(rawText);
      expect(bubbles.length).toBe(4);
      expect(bubbles[0].text).toBe("رحيم");
      expect(bubbles[1].text).toBe("حنين");
      expect(bubbles[2].text).toBe("جدع");
      expect(bubbles[3].text).toBe("كريم");

      // Micro-bubbles (< 15 chars) should have short typing delays (< 800ms)
      for (const b of bubbles) {
        expect(b.delayMs).toBeGreaterThanOrEqual(380);
        expect(b.delayMs).toBeLessThanOrEqual(800);
      }
    });
  });

  describe("3. Egyptian Spintax Engine (Empirical Gehad Presets)", () => {
    it("spins authentic attention pings and nudges", () => {
      const ping = egyptianSpintaxEngine.getPreset("attention_ping");
      expect(ping.length).toBeGreaterThan(3);
      expect(ping).not.toContain("{");
      expect(ping).not.toContain("}");
    });

    it("spins grounded empathy reassurance", () => {
      const empathy = egyptianSpintaxEngine.getPreset("grounded_empathy");
      expect(empathy.length).toBeGreaterThan(10);
      expect(empathy).not.toContain("{");
      expect(empathy).not.toContain("}");
    });

    it("spins playful reality checks and frank assessments", () => {
      const realityCheck = egyptianSpintaxEngine.getPreset("playful_reality_check");
      expect(realityCheck.length).toBeGreaterThan(5);
      expect(realityCheck).not.toContain("{");

      const frank = egyptianSpintaxEngine.getPreset("frank_assessment");
      expect(frank.length).toBeGreaterThan(5);
      expect(frank).not.toContain("{");
    });
  });

  describe("4. Voice Troubadour (Authentic Egyptian Fillers)", () => {
    it("injects authentic Egyptian fillers without artificial bot terms", () => {
      const text = "أنا كنت بكلم صاحبي في موضوع مهم.";
      const injectedPlayful = voiceTroubadour.injectFillers(text, BotMood.PLAYFUL);
      expect(injectedPlayful.length).toBeGreaterThan(text.length);

      const knownFillers = ["ههه", "يا واد انت", "طب بص بقى", "وه!", "صلي ع النبي بس", "يا عم انت"];
      const matched = knownFillers.some(f => injectedPlayful.includes(f));
      expect(matched).toBe(true);
    });

    it("respects native starters and does not duplicate fillers", () => {
      const textWithBosa = "بص يا صاحبي الموضوع خلصان.";
      expect(voiceTroubadour.injectFillers(textWithBosa, BotMood.NEUTRAL)).toBe(textWithBosa);

      const textWithMaalesh = "معلش هي الدنيا كدة.";
      expect(voiceTroubadour.injectFillers(textWithMaalesh, BotMood.SAD)).toBe(textWithMaalesh);
    });
  });

  describe("5. Dynamic Psychology Engine (Egyptian Cues & Repair)", () => {
    const baseState: PsychologicalState = {
      mood: BotMood.NEUTRAL,
      energyLevel: 7,
      socialMeter: 5,
      emotionalLedger: 0,
      currentScenario: "Standard Routine",
      intimacyLevel: 40,
      secretUnlocked: false,
      hungerLevel: 20,
      financialStress: 20,
      sleepiness: 10,
      moodStabilityTurns: 10,
    };

    it("triggers affection from Egyptian affectionate check-ins", () => {
      const drift = groundedMoodDrift(baseState, "وحشتني يا ست الكل");
      expect(drift.driftReason).toBe("user_trigger");
      expect(drift.mood === BotMood.PLAYFUL || drift.mood === BotMood.ROMANTIC).toBe(true);
    });

    it("triggers sadness/empathy from Egyptian burnout complaints", () => {
      const drift = groundedMoodDrift(baseState, "الشغل قرف وفصلان النهاردة");
      expect(drift.driftReason).toBe("user_trigger");
      expect(drift.mood).toBe(BotMood.SAD);
    });

    it("supports genuine Egyptian reconciliation phrases (متزعلش / حصل خير)", () => {
      let state: PsychologicalState = {
        ...baseState,
        mood: BotMood.ANGRY,
        emotionalLedger: -30,
        breakpointState: "none",
        consecutiveNegativeTurns: 3,
      };

      // 4 restorative turns with Egyptian phrases
      const phrases = ["متزعلش", "حقك عليا", "حصل خير يا صاحبي", "مش هزعل خلاص"];
      for (const phrase of phrases) {
        state = evolvePsychology(state, phrase, "neutral");
      }

      expect(state.consecutiveNegativeTurns).toBe(0);
    });
  });

  describe("6. Human Realism Layer Compilation", () => {
    it("keeps Egyptian nuance behind the explicit reference-culture flag", () => {
      const genericInstruction = compileHumanRealismInstruction({
        botName: "Nova",
        mood: BotMood.PLAYFUL,
        energy: 7,
        emotionalLedger: 20,
        intimacy: 60,
      });
      expect(genericInstruction).toContain("Conversational texting rhythm");
      expect(genericInstruction).not.toContain("Egyptian Arabic reference-culture notes");

      const egyptianInstruction = compileHumanRealismInstruction({
        botName: "Kenzy",
        mood: BotMood.PLAYFUL,
        energy: 7,
        emotionalLedger: 20,
        intimacy: 60,
        isEgyptianReference: true,
      });
      expect(egyptianInstruction).toContain("Egyptian Arabic reference-culture notes");
      expect(egyptianInstruction).toContain("Egyptian phrasing");
    });
  });
});
