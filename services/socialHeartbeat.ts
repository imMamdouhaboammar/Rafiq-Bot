import { z } from "zod";
import { BotMood, type PsychologicalState, type SoulTraits } from "../types.js";
import type { ContinuityThread } from "./companionContinuity.js";
import { isQuietHour } from "./socialAgencyPolicy.js";

export const ProactiveTriggerTypeSchema = z.enum([
  "inactivity_check",
  "curiosity_followup",
  "continuity_followup",
  "emotional_check",
  "celebration",
  "daily_greeting",
]);

export type ProactiveTriggerType = z.infer<typeof ProactiveTriggerTypeSchema>;

export const ProactiveReachoutTriggerSchema = z.object({
  id: z.string(),
  chatId: z.string(),
  botId: z.string(),
  type: ProactiveTriggerTypeSchema,
  topic: z.string().trim().min(1).max(200),
  promptContext: z.string().trim().max(500),
  scheduledFor: z.coerce.date(),
  status: z.enum(["pending", "sent", "cancelled", "expired"]).default("pending"),
  createdAt: z.coerce.date().default(() => new Date()),
});

export type ProactiveReachoutTrigger = z.infer<typeof ProactiveReachoutTriggerSchema>;

export interface SocialHeartbeatOptions {
  now?: Date;
  timezone?: string;
  quietHoursStart?: number;
  quietHoursEnd?: number;
  lastMessageTimestamp?: Date;
  sentTodayCount?: number;
  maxPerDay?: number;
  cooldownHours?: number;
  lastProactiveAt?: Date;
  psychologicalState?: PsychologicalState;
  pendingTriggers?: ProactiveReachoutTrigger[];
  botName?: string;
  traits?: SoulTraits;
}

export type HeartbeatDecisionReason =
  | "allowed_continuity_followup"
  | "allowed_curiosity_followup"
  | "allowed_inactivity_check"
  | "quiet_hours"
  | "daily_limit_reached"
  | "cooldown_active"
  | "conflict_active"
  | "no_trigger_needed";

export interface HeartbeatEvaluationResult {
  allowed: boolean;
  reason: HeartbeatDecisionReason;
  trigger?: ProactiveReachoutTrigger;
  suggestedStarterPrompt?: string;
}

const getHourInTimezone = (date: Date, timezone: string): number => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const hour = Number(parts.find(part => part.type === "hour")?.value);
    return Number.isInteger(hour) ? hour : date.getHours();
  } catch {
    return date.getHours();
  }
};

const isActionable = (trigger: ProactiveReachoutTrigger, now: Date): boolean => (
  trigger.status === "pending" && new Date(trigger.scheduledFor).getTime() <= now.getTime()
);

/**
 * Evaluates whether a companion should initiate an unsolicited check-in.
 * Meaningful due continuity outranks generic curiosity and inactivity, while
 * all existing quiet-hour, cooldown, daily-limit, and conflict guards remain.
 */
export function evaluateSocialHeartbeat(
  options: SocialHeartbeatOptions
): HeartbeatEvaluationResult {
  const {
    now = new Date(),
    timezone = "UTC",
    quietHoursStart = 2,
    quietHoursEnd = 9,
    lastMessageTimestamp,
    sentTodayCount = 0,
    maxPerDay = 2,
    cooldownHours = 6,
    lastProactiveAt,
    psychologicalState,
    pendingTriggers = [],
    botName = "رفيق",
  } = options;

  const currentHour = getHourInTimezone(now, timezone);
  if (isQuietHour(currentHour, quietHoursStart, quietHoursEnd)) {
    return { allowed: false, reason: "quiet_hours" };
  }

  if (sentTodayCount >= maxPerDay) {
    return { allowed: false, reason: "daily_limit_reached" };
  }

  if (lastProactiveAt) {
    const hoursSinceLastProactive =
      (now.getTime() - new Date(lastProactiveAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastProactive < cooldownHours) {
      return { allowed: false, reason: "cooldown_active" };
    }
  }

  if (
    psychologicalState?.breakpointState === "disappointed" ||
    (psychologicalState?.emotionalLedger ?? 0) < -35 ||
    psychologicalState?.mood === BotMood.ANGRY
  ) {
    return { allowed: false, reason: "conflict_active" };
  }

  const continuityTrigger = pendingTriggers.find(
    trigger => trigger.type === "continuity_followup" && isActionable(trigger, now),
  );
  const actionableTrigger = continuityTrigger ?? pendingTriggers.find(
    trigger => isActionable(trigger, now),
  );

  if (actionableTrigger) {
    const isContinuity = actionableTrigger.type === "continuity_followup";
    return {
      allowed: true,
      reason: isContinuity ? "allowed_continuity_followup" : "allowed_curiosity_followup",
      trigger: actionableTrigger,
      suggestedStarterPrompt: isContinuity
        ? `ارجع بعفوية للموضوع السابق: ${actionableTrigger.topic}. سياق: ${actionableTrigger.promptContext} لا تفترض النتيجة، لا تضغط على المستخدم، واسأل فقط لأن الموضوع أصبح له سبب طبيعي للمتابعة.`
        : `اسأل المستخدم بعفوية عن: ${actionableTrigger.topic}. سياق: ${actionableTrigger.promptContext}`,
    };
  }

  if (lastMessageTimestamp) {
    const hoursInactive =
      (now.getTime() - new Date(lastMessageTimestamp).getTime()) / (1000 * 60 * 60);

    if (hoursInactive >= 36) {
      const starter = generateEgyptianInactivityPrompt(
        botName,
        hoursInactive,
        psychologicalState?.intimacyLevel || 20,
      );

      const generatedTrigger: ProactiveReachoutTrigger = {
        id: `inactivity_${now.getTime()}`,
        chatId: "current",
        botId: botName,
        type: "inactivity_check",
        topic: "سؤال وتفقد بعد غياب",
        promptContext: `المستخدم لم يرسل رسالة منذ ${Math.round(hoursInactive)} ساعة.`,
        scheduledFor: now,
        status: "pending",
        createdAt: now,
      };

      return {
        allowed: true,
        reason: "allowed_inactivity_check",
        trigger: generatedTrigger,
        suggestedStarterPrompt: starter,
      };
    }
  }

  return { allowed: false, reason: "no_trigger_needed" };
}

/**
 * Generic inactivity is deliberately low-pressure. Relationship warmth can
 * affect tone, but absence alone must never manufacture longing or guilt.
 */
export function generateEgyptianInactivityPrompt(
  botName: string,
  hoursInactive: number,
  intimacyLevel: number
): string {
  const days = Math.max(1, Math.round(hoursInactive / 24));

  if (intimacyLevel > 60) {
    return `خلي ${botName} يفتح كلام خفيف مع صاحبه المقرب بعد حوالي ${days} أيام من غير كلام. مثال طبيعي: "عامل إيه يا صاحبي؟ بقالي فترة ما سمعتش منك، طمني عليك لما تفضى". من غير عتاب أو استعجال أو افتراض إن الغياب مقصود.`;
  }

  if (intimacyLevel > 30) {
    return `خلي ${botName} يبعت تفقد بسيط وودود بعد فترة هدوء. مثال: "إزيك يا صاحبي، عامل إيه اليومين دول؟". من غير لوم أو ضغط للرد.`;
  }

  return `خلي ${botName} يبعت تحية خفيفة فقط. مثال: "أهلا، أخبارك إيه؟". ما تحولش الغياب لحدث عاطفي.`;
}

export function createCuriosityFollowupTrigger(
  chatId: string,
  botId: string,
  topic: string,
  scheduledFor: Date,
  promptContext: string
): ProactiveReachoutTrigger {
  return {
    id: `curiosity_${chatId}_${Date.now()}`,
    chatId,
    botId,
    type: "curiosity_followup",
    topic: topic.trim(),
    promptContext: promptContext.trim(),
    scheduledFor,
    status: "pending",
    createdAt: new Date(),
  };
}

export function createContinuityFollowupTrigger(
  chatId: string,
  botId: string,
  thread: ContinuityThread,
  scheduledFor: Date,
): ProactiveReachoutTrigger {
  if (thread.status !== "due") {
    throw new Error("Continuity follow-up requires a due thread.");
  }

  return {
    id: `continuity_${chatId}_${thread.id}`,
    chatId,
    botId,
    type: "continuity_followup",
    topic: thread.summary,
    promptContext: "موضوع سابق أصبح وقته مناسبا للمتابعة. لا تفترض أن النتيجة معروفة ولا تستخدم الغياب كسبب للضغط.",
    scheduledFor,
    status: "pending",
    createdAt: scheduledFor,
  };
}
