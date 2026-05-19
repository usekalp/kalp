import { parseCronExpression, type ParsedCronExpression } from "./cron-parser";

export type { ParsedCronExpression };

/**
 * Decomposed time components used for cron expression matching against a parsed expression.
 */
export interface TimeParts {
  /** Minute (0-59). */
  minute: number;
  /** Hour (0-23). */
  hour: number;
  /** Day of month (1-31). */
  dayOfMonth: number;
  /** Month (1-12). */
  month: number;
  /** Day of week (0-6, where 0 is Sunday). */
  dayOfWeek: number;
}

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timezone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timezone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    minute: "2-digit",
    hour: "2-digit",
    day: "2-digit",
    month: "2-digit",
    weekday: "short",
  });

  formatterCache.set(timezone, formatter);
  return formatter;
}

/**
 * Decomposes a Unix timestamp into time components, optionally adjusted to a specific timezone.
 *
 * @param timestamp - The Unix timestamp in milliseconds.
 * @param timezone - An IANA timezone string (e.g. "America/New_York"). Defaults to UTC.
 * @returns The time parts for cron evaluation.
 */
export function getTimeParts(timestamp: number, timezone?: string): TimeParts {
  if (!timezone) {
    const date = new Date(timestamp);
    return {
      minute: date.getUTCMinutes(),
      hour: date.getUTCHours(),
      dayOfMonth: date.getUTCDate(),
      month: date.getUTCMonth() + 1,
      dayOfWeek: date.getUTCDay(),
    };
  }

  const formatter = getFormatter(timezone);
  const parts = formatter.formatToParts(new Date(timestamp));
  const values = new Map<string, string>();
  for (const part of parts) {
    values.set(part.type, part.value);
  }

  const weekday = values.get("weekday");
  const dayOfWeek = weekday ? WEEKDAY_TO_INDEX[weekday] : undefined;

  if (dayOfWeek === undefined) {
    throw new Error(`Unable to resolve weekday for timezone "${timezone}"`);
  }

  return {
    minute: Number.parseInt(values.get("minute") ?? "", 10),
    hour: Number.parseInt(values.get("hour") ?? "", 10),
    dayOfMonth: Number.parseInt(values.get("day") ?? "", 10),
    month: Number.parseInt(values.get("month") ?? "", 10),
    dayOfWeek,
  };
}

/**
 * Tests whether the given time parts match a parsed cron expression.
 *
 * When both day-of-month and day-of-week constraints are specified, either one
 * matching is sufficient (OR semantics).
 *
 * @param cron - The parsed cron expression to test against.
 * @param timeParts - The time components to evaluate.
 * @returns True if the time matches the cron expression.
 */
export function matchesCron(
  cron: ParsedCronExpression,
  timeParts: TimeParts,
): boolean {
  if (!cron.minute.any && !cron.minute.values.has(timeParts.minute)) return false;
  if (!cron.hour.any && !cron.hour.values.has(timeParts.hour)) return false;
  if (!cron.month.any && !cron.month.values.has(timeParts.month)) return false;

  const dayOfMonthMatch = cron.dayOfMonth.any || cron.dayOfMonth.values.has(timeParts.dayOfMonth);
  const dayOfWeekMatch = cron.dayOfWeek.any || cron.dayOfWeek.values.has(timeParts.dayOfWeek);

  if (!cron.dayOfMonth.any && !cron.dayOfWeek.any) {
    return dayOfMonthMatch || dayOfWeekMatch;
  }

  return dayOfMonthMatch && dayOfWeekMatch;
}

/**
 * Calculates the next Unix timestamp (in milliseconds) when a cron expression will match,
 * starting from the given reference time. Searches minute-by-minute within a 5-year window.
 *
 * @param cron - A standard 5-field cron expression string.
 * @param fromTimestamp - The reference timestamp in milliseconds.
 * @param timezone - An optional IANA timezone string for evaluation.
 * @returns The next matching timestamp in milliseconds.
 * @throws If no matching time is found within the lookahead window.
 */
export function calculateNextOccurrence(
  cron: string,
  fromTimestamp: number,
  timezone?: string,
): number {
  const parsed = parseCronExpression(cron);
  const MINUTE_MS = 60_000;

  let current = Math.floor((fromTimestamp + MINUTE_MS) / MINUTE_MS) * MINUTE_MS;
  const maxLookahead = fromTimestamp + (5 * 366 * 24 * 60 * MINUTE_MS);

  while (current <= maxLookahead) {
    const parts = getTimeParts(current, timezone);
    if (matchesCron(parsed, parts)) {
      return current;
    }
    current += MINUTE_MS;
  }

  throw new Error(`Unable to find next occurrence for cron "${cron}" within lookahead window.`);
}
