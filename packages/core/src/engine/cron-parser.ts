/**
 * Represents a parsed field from a cron expression.
 * Indicates whether the field matches any value (wildcard) or a specific set of values.
 */
export interface CronField {
  /** Whether the field matches any value ("*" wildcard). */
  any: boolean;
  /** The set of matching numeric values when not a wildcard. */
  values: Set<number>;
}

/**
 * A fully parsed 5-field cron expression with each field resolved to its matching values.
 */
export interface ParsedCronExpression {
  /** Minute field (0-59). */
  minute: CronField;
  /** Hour field (0-23). */
  hour: CronField;
  /** Day of month field (1-31). */
  dayOfMonth: CronField;
  /** Month field (1-12). */
  month: CronField;
  /** Day of week field (0-7, where 0 and 7 both represent Sunday). */
  dayOfWeek: CronField;
}

const cronCache = new Map<string, ParsedCronExpression>();

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
 * Parses a standard 5-field cron expression into its structured components.
 * Results are cached to avoid re-parsing identical expressions.
 *
 * @param cron - A standard 5-field cron expression (e.g. "0 0 * * 1" for mondays at midnight).
 * @returns The parsed cron expression with all fields resolved.
 * @throws If the expression is invalid or has fewer/more than 5 fields.
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

  if (!parsed.dayOfWeek.any && parsed.dayOfWeek.values.has(7)) {
    parsed.dayOfWeek.values.delete(7);
    parsed.dayOfWeek.values.add(0);
  }

  cronCache.set(cron, parsed);
  return parsed;
}
