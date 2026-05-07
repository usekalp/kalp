/**
 * Deterministic date primitive interface for Event Sourcing.
 *
 * All methods return the timestamp of the original event execution,
 * ensuring perfect replay behavior. Do NOT use native Date in agent code.
 *
 * @module
 */

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
 * Deterministic date primitive for agent execution.
 *
 * All operations are based on the original event timestamp,
 * ensuring that replays produce identical behavior.
 *
 * @example
 * ```typescript
 * // Get deterministic timestamp
 * const now = ctx.date.now();
 *
 * // Check if event happened after a date
 * if (ctx.date.isAfter("2024-01-01T00:00:00Z")) { ... }
 *
 * // Add duration
 * const tomorrow = ctx.date.add("1d");
 *
 * // Format in specific timezone
 * const localTime = ctx.date.timezone("America/Argentina/Buenos_Aires")
 *   .format("YYYY-MM-DD HH:mm");
 * ```
 */
export interface KalpDate {
  /**
   * Timestamp of the original event (milliseconds since epoch).
   * Deterministic - returns same value on replay.
   */
  now: () => number;

  /**
   * ISO 8601 string of the original event timestamp.
   * Deterministic - returns same value on replay.
   */
  toISOString: () => string;

  /**
   * Check if the original event occurred after the given date.
   * @param isoString - ISO 8601 date string to compare against.
   * @returns True if event is after the given date.
   */
  isAfter: (isoString: string) => boolean;

  /**
   * Add duration to the original event timestamp.
   * @param duration - Duration string (e.g., "3d", "2h", "1w") or milliseconds.
   * @returns New timestamp in milliseconds.
   */
  add: (duration: string | number) => number;

  /**
   * Convert the event timestamp to a specific timezone.
   * @param tz - IANA timezone identifier.
   * @returns TimezoneFormatter for the converted time.
   * @example "America/Argentina/Buenos_Aires"
   */
  timezone: (tz: string) => TimezoneFormatter;
}
