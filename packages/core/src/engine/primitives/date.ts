/**
 * Deterministic date/time primitive.
 *
 * Provides deterministic time operations using the event timestamp.
 *
 * @module
 */

import type { ExecutionLog } from "@/engine/execution-log";
import type { KalpDate, TimezoneFormatter } from "@kalphq/sdk";
import type { ExecutionContext } from "@/engine/types";

/**
 * Creates a date primitive that emits events to the execution log.
 *
 * @param log - The execution log for event emission.
 * @param execCtx - Optional execution context for event identity.
 * @returns A {@link KalpDate} instance.
 */
export function createDatePrimitive(
  log: ExecutionLog,
  execCtx?: ExecutionContext,
): KalpDate {
  const ids = {
    executionId: execCtx?.executionId ?? "",
    traceId: execCtx?.traceId ?? "",
    threadId: execCtx?.threadId ?? "",
  };

  // Use current time as base (in production, use event timestamp)
  const baseTime = Date.now();

  return {
    /**
     * Get the current time (event timestamp).
     */
    now(): number {
      return baseTime;
    },

    /**
     * Format the current time as ISO string.
     */
    toISOString(): string {
      return new Date(baseTime).toISOString();
    },

    /**
     * Check if the original event occurred after the given date.
     *
     * @param isoString - ISO 8601 date string to compare against.
     */
    isAfter(isoString: string): boolean {
      const timestamp = Date.now();
      void log.emit({
        type: "primitive.invoked",
        name: "date.isAfter",
        params: isoString,
        result: undefined,
        ...ids,
        timestamp,
      });
      return baseTime > new Date(isoString).getTime();
    },

    /**
     * Add a duration to the current time.
     *
     * @param duration - Duration string (e.g., "1h", "30m", "24h") or milliseconds.
     */
    add(duration: string | number): number {
      const timestamp = Date.now();
      void log.emit({
        type: "primitive.invoked",
        name: "date.add",
        params: duration,
        result: undefined,
        ...ids,
        timestamp,
      });

      // If duration is a number, treat as milliseconds
      if (typeof duration === "number") {
        return baseTime + duration;
      }

      // Parse duration string
      const match = duration.match(/^(\d+)([smhd])$/);
      if (!match) {
        throw new Error(`Invalid duration format: ${duration}`);
      }

      const value = parseInt(match[1]!, 10);
      const unit = match[2]!;
      if (!unit) {
        throw new Error(`Invalid duration format: ${duration}`);
      }

      const multipliers: Record<string, number> = {
        s: 1000,
        m: 60000,
        h: 3600000,
        d: 86400000,
      };

      const multiplier = multipliers[unit];
      if (!multiplier) {
        throw new Error(`Invalid duration unit: ${unit}`);
      }

      return baseTime + value * multiplier;
    },

    /**
     * Convert the event timestamp to a specific timezone.
     *
     * @param tz - IANA timezone identifier.
     * @returns TimezoneFormatter for the converted time.
     */
    timezone(tz: string): TimezoneFormatter {
      const formatter: TimezoneFormatter = {
        format(format: string): string {
          const timestamp = Date.now();
          void log.emit({
            type: "primitive.invoked",
            name: "date.timezone.format",
            params: { tz, format },
            result: undefined,
            ...ids,
            timestamp,
          });

          // Simple formatting - in production use a proper date library
          const date = new Date(baseTime);
          return date.toISOString().replace("T", " ").slice(0, 19);
        },
        toISOString(): string {
          return new Date(baseTime).toISOString();
        },
      };
      return formatter;
    },
  };
}
