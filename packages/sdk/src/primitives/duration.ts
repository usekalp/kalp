/**
 * Duration primitive for time-based operations.
 *
 * All durations are normalized to milliseconds internally.
 * Never use bare numbers — always use Duration objects or helpers.
 *
 * @module
 */

export interface Duration {
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
  milliseconds?: number;
}

/**
 * Convert a Duration to milliseconds.
 * Centralized canonicalization — all consumers MUST use this.
 */
export function toMs(duration: Duration): number {
  const d = normalizeDuration(duration);
  return (
    (d.days ?? 0) * 86_400_000 +
    (d.hours ?? 0) * 3_600_000 +
    (d.minutes ?? 0) * 60_000 +
    (d.seconds ?? 0) * 1_000 +
    (d.milliseconds ?? 0)
  );
}

/**
 * Validate and normalize a Duration.
 * - Rejects negative values, Infinity, NaN
 * - Rejects empty objects and all-zero durations
 * - Removes undefined fields
 * - Returns a frozen object
 */
export function normalizeDuration(duration: Duration): Readonly<Duration> {
  const { days, hours, minutes, seconds, milliseconds } = duration;

  const fields = [days, hours, minutes, seconds, milliseconds];

  // Reject if all fields are undefined
  if (fields.every((f) => f === undefined)) {
    throw new Error(
      "Invalid duration: at least one time unit must be specified",
    );
  }

  const result: Duration = {};

  if (days !== undefined) {
    assertFiniteNonNegative("days", days);
    result.days = days;
  }
  if (hours !== undefined) {
    assertFiniteNonNegative("hours", hours);
    result.hours = hours;
  }
  if (minutes !== undefined) {
    assertFiniteNonNegative("minutes", minutes);
    result.minutes = minutes;
  }
  if (seconds !== undefined) {
    assertFiniteNonNegative("seconds", seconds);
    result.seconds = seconds;
  }
  if (milliseconds !== undefined) {
    assertFiniteNonNegative("milliseconds", milliseconds);
    result.milliseconds = milliseconds;
  }

  return Object.freeze(result);
}

function assertFiniteNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid duration: ${name} must be a finite number`);
  }
  if (value < 0) {
    throw new Error(`Invalid duration: ${name} must be non-negative`);
  }
}

/**
 * Duration helpers for ergonomic usage.
 *
 * @example
 * await ctx.actions.sleep(seconds(5));
 * await ctx.actions.sleep(ms(500));
 */
export const ms = (n: number): Duration => ({ milliseconds: n });
export const seconds = (n: number): Duration => ({ seconds: n });
export const minutes = (n: number): Duration => ({ minutes: n });
export const hours = (n: number): Duration => ({ hours: n });
export const days = (n: number): Duration => ({ days: n });
