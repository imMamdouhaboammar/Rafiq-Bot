import { z } from "zod";
import type { PsychologicalState, ChatMessage } from "../types.js";
import { createGoogleGenAIClient } from "./googleClient.server.js";
import { GEMINI_SAFETY_OFF_SETTINGS } from "./geminiSafety.server.js";
import { mergeIntoGraph } from "./graphMemory.server.js";
import { ContinuityProposalSchema } from "./companionContinuity.js";
import { validateContinuityProposals } from "./continuityProposalValidation.js";

export const DiscoveredBeliefSchema = z.object({
  topic: z.string().trim().min(1).max(120),
  belief: z.string().trim().min(1).max(300),
});

export type DiscoveredBelief = z.infer<typeof DiscoveredBeliefSchema>;

export const ReflectionCycleResultSchema = z.object({
  chatId: z.string(),
  botId: z.string(),
  dailySummary: z.string().trim().min(1).max(500),
  discoveredBeliefs: z.array(DiscoveredBeliefSchema).default([]),
  curiosityGaps: z.array(z.string().trim().min(1).max(200)).default([]),
  suggestedInsideJokes: z.array(z.string().trim().min(1).max(200)).default([]),
  continuityProposals: z.array(ContinuityProposalSchema).max(10).default([]),
  intimacyDelta: z.number().int().min(-5).max(10).default(0),
  reflectionNote: z.string().trim().max(400).default(""),
});

export type ReflectionCycleResult = z.infer<typeof ReflectionCycleResultSchema>;

export interface ReflectionOptions {
  chatId: string;
  botId: string;
  botName: string;
  messages: ChatMessage[];
  currentState: PsychologicalState;
  modelName?: string;
}

/**
 * Runs the nightly/idle reflection cycle.
 * Model output may propose bounded continuity changes, but it never persists
 * continuity state directly. Callers must pass proposals through the pure
 * continuity reducer before saving them.
 */
export async function runReflectionConsolidation(
  options: ReflectionOptions
): Promise<ReflectionCycleResult> {
  const {
    chatId,
    botId,
    botName,
    messages,
    currentState,
    modelName = "gemini-2.5-flash",
  } = options;

  if (!messages || messages.length === 0) {
    return {
      chatId,
      botId,
      dailySummary: "لا توجد محادثات اليوم.",
      discoveredBeliefs: [],
      curiosityGaps: [],
      suggestedInsideJokes: [],
      continuityProposals: [],
      intimacyDelta: 0,
      reflectionNote: "يوم هادئ بدون كلام جديد.",
    };
  }

  const recentMessages = messages.slice(-30);
  const allowedMessageIds = recentMessages.map(message => message.id);
  const recentTranscript = recentMessages
    .map(message => `[${message.id}] ${message.role === "user" ? "المستخدم" : botName}: ${message.text}`)
    .join("\n");

  try {
    const ai = createGoogleGenAIClient();
    const prompt = `أنت طبقة تأمل داخلية للشخصية المصرية "${botName}".
حلل فقط ما هو موجود فعلا في سجل المحادثة أدناه. لا تخترع أحداثا حصلت للشخصية خارج المحادثة، ولا عمل أو مرض أو أزمة مالية أو مقابلات مع أشخاص آخرين أو نشاط في العالم الحقيقي.

كل سطر يبدأ بمعرف رسالة بين أقواس مربعة. أي continuity proposal لازم يحتوي فقط على sourceMessageIds موجودة في السجل الحالي.

سجل محادثات اليوم:
${recentTranscript}

الحالة الحالية:
- المزاج: ${currentState.mood}
- المودة الحالية: ${currentState.intimacyLevel}
- الرصيد العاطفي: ${currentState.emotionalLedger}

ارجع JSON فقط بالشكل التالي:
{
  "dailySummary": "ملخص مكثف لما حدث اليوم بينكما في سطرين",
  "discoveredBeliefs": [
    { "topic": "أمر يخص المستخدم", "belief": "معلومة أو تفضيل مدعوم بالمحادثة" }
  ],
  "curiosityGaps": [
    "نتيجة أو سؤال حقيقي ما زال مفتوحا من المحادثة"
  ],
  "suggestedInsideJokes": [
    "مرجع أو إيفيه حصل فعلا بينكما ويمكن الرجوع له لاحقا"
  ],
  "continuityProposals": [
    {
      "type": "thread_upsert",
      "kind": "outcome",
      "summary": "موضوع حقيقي له سبب واضح للمتابعة لاحقا",
      "sourceMessageIds": ["message-id-from-transcript"],
      "salience": 0.8,
      "dueAt": "2026-09-14T09:00:00.000Z"
    },
    {
      "type": "opinion_upsert",
      "topic": "موضوع ناقشته الشخصية فعلا",
      "stance": "رأي الشخصية المدعوم بالسياق",
      "confidence": 0.7,
      "sourceMessageIds": ["message-id-from-transcript"]
    }
  ],
  "intimacyDelta": 1,
  "reflectionNote": "ملاحظة داخلية قصيرة مبنية على التفاعل فقط"
}

قواعد continuityProposals:
- استخدم فقط الأنواع المسموحة في العقد ولا تخترع نوعا جديدا
- لا تنشئ proposal لمجرد وجود موضوع عابر بلا سبب مستقبلي
- لا تحول قصة خيالية أو roleplay إلى حدث حقيقي
- لا تنشئ ritual من موقف واحد
- لا تعتبر اختلاف المستخدم مع رأي الشخصية سببا لتغيير الرأي تلقائيا
- لا تنشئ تشخيصات نفسية أو استنتاجات حساسة عن المستخدم
- لو مفيش تغيير حقيقي مهم، ارجع continuityProposals فارغة`;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        safetySettings: GEMINI_SAFETY_OFF_SETTINGS,
      },
    });

    const rawText = response.text || "{}";
    const parsed = JSON.parse(rawText);

    const result: ReflectionCycleResult = {
      chatId,
      botId,
      dailySummary: parsed.dailySummary || "يوم طيب من المحادثات.",
      discoveredBeliefs: Array.isArray(parsed.discoveredBeliefs)
        ? parsed.discoveredBeliefs.slice(0, 5)
        : [],
      curiosityGaps: Array.isArray(parsed.curiosityGaps)
        ? parsed.curiosityGaps.slice(0, 3)
        : [],
      suggestedInsideJokes: Array.isArray(parsed.suggestedInsideJokes)
        ? parsed.suggestedInsideJokes.slice(0, 3)
        : [],
      continuityProposals: validateContinuityProposals(
        parsed.continuityProposals,
        allowedMessageIds,
      ),
      intimacyDelta: Number.isInteger(parsed.intimacyDelta)
        ? Math.max(-5, Math.min(10, parsed.intimacyDelta))
        : 1,
      reflectionNote: parsed.reflectionNote || "يوم جميل مع صاحبي.",
    };

    if (result.discoveredBeliefs.length > 0) {
      try {
        const nodes = result.discoveredBeliefs.map(belief => ({
          label: belief.topic,
          type: "Belief",
          description: belief.belief,
        }));
        const edges = result.discoveredBeliefs.map(belief => ({
          source: botName,
          target: belief.topic,
          relation: "يعرف عن المستخدم",
        }));
        await mergeIntoGraph(chatId, nodes, edges);
      } catch (err) {
        console.warn("[ReflectionEngine] Graph merge skipped or failed:", err);
      }
    }

    return result;
  } catch (err) {
    console.error("[ReflectionEngine] AI generation failed, falling back to heuristic:", err);

    return {
      chatId,
      botId,
      dailySummary: "محادثة ودية تمت اليوم.",
      discoveredBeliefs: [],
      curiosityGaps: [],
      suggestedInsideJokes: [],
      continuityProposals: [],
      intimacyDelta: 1,
      reflectionNote: "الحمد لله يوم مر بخير وبراحة بال.",
    };
  }
}
