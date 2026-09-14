import { GetCurrentTimeArgs, CurrentTimeResult } from "./toolTypes.js";
import { resolveRuntimeLocale } from "../runtimeLocale.js";

/**
 * Executes the Current Time tool server-side.
 * Returns both structured and human-readable representation of time/date.
 */
export const getCurrentTime = (args: GetCurrentTimeArgs = {}): CurrentTimeResult => {
  const runtimeLocale = resolveRuntimeLocale({ timezone: args.timezone, locale: args.locale });
  const tz = runtimeLocale.timezone;
  const loc = runtimeLocale.locale;

  const now = new Date();

  try {
    // 1. Get structured components in the target timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: tz,
    });

    const parts = formatter.formatToParts(now);
    const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));

    const year = parseInt(partMap.year, 10);
    const monthStr = partMap.month;
    const dayStr = partMap.day;
    const hour = parseInt(partMap.hour, 10);
    const minute = parseInt(partMap.minute, 10);
    const secondStr = partMap.second;

    // 2. Determine offset
    const tzOffsetFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "longOffset",
    });
    const tzOffsetPart = tzOffsetFormatter.formatToParts(now).find((p) => p.type === "timeZoneName")?.value || "";
    let offsetText = "+00:00";
    const match = tzOffsetPart.match(/GMT([-+]\d+)(?::(\d+))?/);
    if (match) {
      const sign = match[1][0];
      const hours = match[1].slice(1).padStart(2, "0");
      const mins = (match[2] || "00").padStart(2, "0");
      offsetText = `${sign}${hours}:${mins}`;
    }

    const iso = `${year}-${monthStr}-${dayStr}T${partMap.hour}:${partMap.minute}:${secondStr}${offsetText}`;

    // 3. Determine period of day
    // morning: 5:00 - 11:59 (5-11)
    // afternoon: 12:00 - 16:59 (12-16)
    // evening: 17:00 - 21:59 (17-21)
    // night: 22:00 - 4:59 (22-4)
    let period: CurrentTimeResult["period"] = "night";
    if (hour >= 5 && hour < 12) {
      period = "morning";
    } else if (hour >= 12 && hour < 17) {
      period = "afternoon";
    } else if (hour >= 17 && hour < 22) {
      period = "evening";
    }

    // 4. Generate formatted text outputs
    const dateTextFormatter = new Intl.DateTimeFormat(loc, {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: tz,
    });
    const timeTextFormatter = new Intl.DateTimeFormat(loc, {
      hour: "numeric",
      minute: "numeric",
      hour12: true,
      timeZone: tz,
    });
    const dayNameFormatter = new Intl.DateTimeFormat(loc, {
      weekday: "long",
      timeZone: tz,
    });

    return {
      iso,
      timezone: tz,
      locale: loc,
      dateText: dateTextFormatter.format(now),
      timeText: timeTextFormatter.format(now),
      dayName: dayNameFormatter.format(now),
      hour,
      minute,
      period,
    };
  } catch (err) {
    console.error("[TimeTool] Error retrieving timezone-aware time:", err);
    // Secure fallback to UTC
    const hour = now.getUTCHours();
    let period: CurrentTimeResult["period"] = "night";
    if (hour >= 5 && hour < 12) period = "morning";
    else if (hour >= 12 && hour < 17) period = "afternoon";
    else if (hour >= 17 && hour < 22) period = "evening";

    return {
      iso: now.toISOString(),
      timezone: "UTC",
      locale: loc,
      dateText: now.toDateString(),
      timeText: now.toTimeString(),
      dayName: now.toLocaleDateString(loc, { weekday: "long" }),
      hour,
      minute: now.getUTCMinutes(),
      period,
    };
  }
};
