/**
 * Deterministic time primitive interface for Event Sourcing.
 *
 * All methods return the timestamp of the original event execution,
 * ensuring perfect replay behavior. Do NOT use native Date.now() in agent code.
 *
 * @module
 */

import type { Duration } from "./duration";
import type { IanaTimezone } from "@/schedule/timezones";

/**
 * Timezone-aware formatter interface.
 */
export interface TimezoneFormatter {
  /** Format the date using a format string. */
  format: (format: string) => string;
  /** Return as ISO 8601 string. */
  toISOString: () => string;
}

/**
 * Deterministic time primitive for agent execution.
 *
 * All operations are based on the original event timestamp,
 * ensuring that replays produce identical behavior.
 *
 * @example
 * ```typescript
 * // Get deterministic timestamp
 * const now = ctx.time.now();
 *
 * // Format current event time
 * const iso = ctx.time.toISOString();
 *
 * // Format a different timestamp
 * const otherIso = ctx.time.toISOString(otherTimestamp);
 *
 * // Check if event happened after a date
 * if (ctx.time.isAfter("2024-01-01T00:00:00Z")) { ... }
 *
 * // Add duration
 * const tomorrow = ctx.time.add({ days: 1 });
 *
 * // Format in specific timezone
 * const localTime = ctx.time.timezone("America/Argentina/Buenos_Aires")
 *   .format("YYYY-MM-DD HH:mm");
 * ```
 */
export interface KalpTime {
  /**
   * Timestamp of the original event (milliseconds since epoch).
   * Deterministic — returns same value on replay.
   * NEVER use Date.now() directly in agent code.
   */
  now: () => number;

  /**
   * ISO 8601 string. No argument formats the original event timestamp.
   * With argument, formats the specific timestamp (unix ms).
   * Deterministic — returns same value on replay.
   */
  toISOString: (timestamp?: number) => string;

  /**
   * Check if the original event occurred after the given date.
   * @param isoString — ISO 8601 date string to compare against.
   * @returns True if event is after the given date.
   */
  isAfter: (isoString: string) => boolean;

  /**
   * Check if the original event occurred before the given date.
   * @param isoString — ISO 8601 date string to compare against.
   * @returns True if event is before the given date.
   */
  isBefore: (isoString: string) => boolean;

  /**
   * Add duration to the original event timestamp.
   * @param duration — Duration object (e.g., { days: 1, hours: 2 }).
   * @returns New timestamp in milliseconds.
   */
  add: (duration: Duration) => number;

  /**
   * Subtract duration from the original event timestamp.
   * @param duration — Duration object (e.g., { days: 1 }).
   * @returns New timestamp in milliseconds.
   */
  sub: (duration: Duration) => number;

  /**
   * Convert the event timestamp to a specific timezone.
   * @param tz — IANA timezone identifier.
   * @returns TimezoneFormatter for the converted time.
   * @example "America/Argentina/Buenos_Aires"
   */
  timezone: (tz: IanaTimezone) => TimezoneFormatter;
}

/**
 * Assert that a value is a valid TimestampInput (Date or number).
 * Returns the validated unix milliseconds.
 *
 * Rejects:
 * - NaN
 * - Invalid Date objects
 * - Negative timestamps
 */
export function assertTimestampInput(when: Date | number): number {
  let ms: number;

  if (typeof when === "number") {
    ms = when;
  } else {
    ms = when.getTime();
  }

  if (!Number.isFinite(ms)) {
    throw new Error(
      "Invalid timestamp: must be a finite number or valid Date",
    );
  }

  if (ms < 0) {
    throw new Error("Invalid timestamp: must be non-negative");
  }

  return ms;
}
