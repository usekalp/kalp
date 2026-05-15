/**
 * Cron parsing and matching utilities.
 */

export interface CronField {
  any: boolean;
  values: Set<number>;
}

export interface ParsedCronExpression {
  minute: CronField;
  hour: CronField;
  dayOfMonth: CronField;
  month: CronField;
  dayOfWeek: CronField;
}

export interface TimeParts {
  minute: number;
  hour: number;
  dayOfMonth: number;
  month: number;
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
const cronCache = new Map<string, ParsedCronExpression>();

/**
 * Parses a single cron field (e.g., "0", "*", "1-5").
 */
function parseCronField(
  rawField: string,
  min: number,
  max: number,
  fieldName: string,
): CronField {
  const field = rawField.trim();

  if (!field) {
    throw new Error(`Invalid cron: empty ${fieldName} field`);
  }

  if (field === "*") {
    return { any: true, values: new Set<number>() };
  }

  const values = new Set<number>();
  const segments = field.split(",");

  for (const segment of segments) {
    const token = segment.trim();
    if (!token) {
      throw new Error(`Invalid cron: malformed ${fieldName} field "${rawField}"`);
    }

    const [basePart, stepPart] = token.split("/");
    if (!basePart) {
      throw new Error(`Invalid cron: malformed ${fieldName} token "${token}"`);
    }

    const step = stepPart !== undefined ? Number.parseInt(stepPart, 10) : undefined;

    if (stepPart !== undefined && (step === undefined || !Number.isInteger(step) || step <= 0)) {
      throw new Error(`Invalid cron: invalid step "${stepPart}" in ${fieldName}`);
    }

    let rangeStart: number;
    let rangeEnd: number;

    if (basePart === "*") {
      rangeStart = min;
      rangeEnd = max;
    } else if (basePart.includes("-")) {
      const [rawStart, rawEnd] = basePart.split("-");
      const start = Number.parseInt(rawStart ?? "", 10);
      const end = Number.parseInt(rawEnd ?? "", 10);
      if (!Number.isInteger(start) || !Number.isInteger(end)) {
        throw new Error(`Invalid cron: malformed range "${basePart}" in ${fieldName}`);
      }
      rangeStart = Math.min(start, end);
      rangeEnd = Math.max(start, end);
    } else {
      const value = Number.parseInt(basePart, 10);
      if (!Number.isInteger(value)) {
        throw new Error(`Invalid cron: invalid value "${basePart}" in ${fieldName}`);
      }
      rangeStart = value;
      rangeEnd = value;
    }

    if (rangeStart < min || rangeEnd > max) {
      throw new Error(`Invalid cron: ${fieldName} value out of range (${min}-${max}) in "${token}"`);
    }

    const increment = step ?? 1;
    for (let value = rangeStart; value <= rangeEnd; value += increment) {
      values.add(value);
    }
  }

  return { any: false, values };
}

/**
 * Parses a standard 5-field cron expression.
 */
export function parseCronExpression(cron: string): ParsedCronExpression {
  const cached = cronCache.get(cron);
  if (cached) return cached;

  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Invalid cron: expected 5 fields, received ${parts.length}`);
  }

  const parsed: ParsedCronExpression = {
    minute: parseCronField(parts[0]!, 0, 59, "minute"),
    hour: parseCronField(parts[1]!, 0, 23, "hour"),
    dayOfMonth: parseCronField(parts[2]!, 1, 31, "day-of-month"),
    month: parseCronField(parts[3]!, 1, 12, "month"),
    dayOfWeek: parseCronField(parts[4]!, 0, 7, "day-of-week"),
  };

  // Normalize Sunday aliases (0 and 7)
  if (!parsed.dayOfWeek.any && parsed.dayOfWeek.values.has(7)) {
    parsed.dayOfWeek.values.delete(7);
    parsed.dayOfWeek.values.add(0);
  }

  cronCache.set(cron, parsed);
  return parsed;
}

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
 * Extracts time components from a timestamp for a given timezone.
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
 * Checks if a parsed cron expression matches the given time parts.
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

  // POSIX semantics for DOM/DOW
  if (!cron.dayOfMonth.any && !cron.dayOfWeek.any) {
    return dayOfMonthMatch || dayOfWeekMatch;
  }

  return dayOfMonthMatch && dayOfWeekMatch;
}

/**
 * Calculates the next occurrence of a cron expression after a given timestamp.
 */
export function calculateNextOccurrence(
  cron: string,
  fromTimestamp: number,
  timezone?: string,
): number {
  const parsed = parseCronExpression(cron);
  const MINUTE_MS = 60_000;
  
  // Start searching from the next minute
  let current = Math.floor((fromTimestamp + MINUTE_MS) / MINUTE_MS) * MINUTE_MS;
  const maxLookahead = fromTimestamp + (5 * 366 * 24 * 60 * MINUTE_MS); // 5 years

  while (current <= maxLookahead) {
    const parts = getTimeParts(current, timezone);
    if (matchesCron(parsed, parts)) {
      return current;
    }
    current += MINUTE_MS;
  }

  throw new Error(`Unable to find next occurrence for cron "${cron}" within lookahead window.`);
}
