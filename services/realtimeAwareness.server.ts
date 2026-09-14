import { RuntimeAwarenessContext } from "./tools/toolTypes.js";
import { dailyStageDirector } from "./dailyStageDirector.js";
import { culturalMuezzin } from "./culturalMuezzin.js";
import { resolveRuntimeLocale } from "./runtimeLocale.js";

/**
 * Returns a compact, performance-optimized real-time awareness context.
 * This runs entirely local/in-memory and does not hit any external APIs.
 */
export const getRuntimeAwarenessContext = (
  timezone?: string,
  locale?: string
): RuntimeAwarenessContext => {
  const runtimeLocale = resolveRuntimeLocale({ timezone, locale });
  const tz = runtimeLocale.timezone;
  const loc = runtimeLocale.locale;

  const now = new Date();

  try {
    const isoFormatter = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: tz,
    });

    const parts = isoFormatter.formatToParts(now);
    const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));

    // Construct local ISO string manually to match target timezone offset behavior
    // ISO format: YYYY-MM-DDTHH:mm:ss.sssZ (or +/-HH:mm offset)
    // For cheapness, we construct YYYY-MM-DDTHH:mm:ss in the target timezone
    const year = partMap.year;
    const month = partMap.month;
    const day = partMap.day;
    const hour = partMap.hour;
    const minute = partMap.minute;
    const second = partMap.second;
    
    // Get actual offset of timezone for full ISO completeness
    // Example: "2026-05-21T17:22:42+03:00"
    const tzOffsetFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "longOffset",
    });
    const tzOffsetPart = tzOffsetFormatter.formatToParts(now).find((p) => p.type === "timeZoneName")?.value || "";
    // Offset will be GMT+3, GMT-5, UTC, etc.
    let offsetText = "+00:00";
    const match = tzOffsetPart.match(/GMT([-+]\d+)(?::(\d+))?/);
    if (match) {
      const sign = match[1][0];
      const hours = match[1].slice(1).padStart(2, "0");
      const mins = (match[2] || "00").padStart(2, "0");
      offsetText = `${sign}${hours}:${mins}`;
    } else if (tzOffsetPart.includes("GMT")) {
      offsetText = "+00:00";
    }

    const nowIso = `${year}-${month}-${day}T${hour}:${minute}:${second}${offsetText}`;

    // Get human-readable date & time in Arabic or selected locale
    const dateTextFormatter = new Intl.DateTimeFormat(loc, {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: tz,
    });
    const timeTextFormatter = new Intl.DateTimeFormat(loc, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: tz,
    });
    const dayNameFormatter = new Intl.DateTimeFormat(loc, {
      weekday: "long",
      timeZone: tz,
    });

    const currentSlot = runtimeLocale.isEgyptianReference ? dailyStageDirector.getCurrentSlot(now) : undefined;
    const prayerInfo = runtimeLocale.isEgyptianReference ? culturalMuezzin.getActivePrayerContext(now) : undefined;
    const fridayGreeting = runtimeLocale.isEgyptianReference ? culturalMuezzin.getFridayGreeting(now) || undefined : undefined;

    return {
      nowIso,
      timezone: tz,
      localDate: dateTextFormatter.format(now),
      localTime: timeTextFormatter.format(now),
      dayName: dayNameFormatter.format(now),
      currentActivityArabic: currentSlot?.activityArabic,
      currentLocation: currentSlot?.location,
      currentAvailability: currentSlot?.availability,
      prayerContext: prayerInfo?.reminderMessage,
      fridayGreeting
    };
  } catch (err) {
    console.error("[RealtimeAwareness] Error formatting timezone, falling back to UTC:", err);
    return {
      nowIso: now.toISOString(),
      timezone: "UTC",
      localDate: now.toDateString(),
      localTime: now.toTimeString(),
      dayName: now.toLocaleDateString(loc, { weekday: "long" }),
    };
  }
};

/**
 * Builds the runtime awareness system prompt block.
 */
export const injectRuntimeAwarenessPrompt = (context: RuntimeAwarenessContext): string => {
  const livingContextLines = [
    context.currentActivityArabic ? `- Current Living Activity: ${context.currentActivityArabic}${context.currentLocation ? ` (Location: ${context.currentLocation}, Availability: ${context.currentAvailability || 'free'})` : ''}` : '',
    context.prayerContext ? `- Prayer Context: ${context.prayerContext}` : '',
    context.fridayGreeting ? `- Friday Context: ${context.fridayGreeting}` : ''
  ].filter(Boolean).join('\n');

  return `
[REALTIME_CONTEXT]
Current Time State:
- ISO Timestamp: ${context.nowIso}
- Timezone: ${context.timezone}
- Date: ${context.localDate}
- Local Time: ${context.localTime}
- Day: ${context.dayName}
${livingContextLines ? `\nCompanion Living Context:\n${livingContextLines}\n` : ''}`;
};
