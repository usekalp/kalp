/**
 * Deterministic date primitive for the Proxy-Listener Runtime.
 *
 * Provides deterministic time operations using EventStore for logging.
 *
 * @module
 */

import type { KalpDate, TimezoneFormatter } from "@kalphq/sdk";
import type { EventStore } from "@/adapters/interfaces";
import type { ExecutionContext } from "@/engine/types";

/**
 * Creates a date primitive that emits events to EventStore.
 *
 * @param eventStore - The event store for event emission.
 * @param execCtx - Optional execution context for event identity.
 * @returns A {@link KalpDate} instance.
 */
export function createDatePrimitive(
  eventStore: EventStore,
  execCtx?: ExecutionContext,
): KalpDate {
  const ids = {
    executionId: execCtx?.executionId ?? "",
    traceId: execCtx?.traceId ?? "",
    threadId: execCtx?.threadId ?? "",
  };

  const baseTime = Date.now();

  return {
    /**
     * Gets the current time (event timestamp).
     *
     * @returns The timestamp of the original event in milliseconds since epoch.
     */
    now(): number {
      return baseTime;
    },

    /**
     * Formats the current time as an ISO 8601 string.
     *
     * @returns The ISO 8601 string representation of the event timestamp.
     */
    toISOString(): string {
      return new Date(baseTime).toISOString();
    },

    /**
     * Checks if the original event occurred after the given date.
     *
     * @param isoString - ISO 8601 date string to compare against.
     * @returns True if the event timestamp is after the given date.
     */
    isAfter(isoString: string): boolean {
      const timestamp = Date.now();
      void eventStore.append({
        type: "primitive.invoked",
        name: "date.isAfter",
        params: isoString,
        result: undefined,
        executionId: ids.executionId,
        traceId: ids.traceId,
        threadId: ids.threadId,
        timestamp,
      });
      return baseTime > new Date(isoString).getTime();
    },

    /**
     * Adds a duration to the current event timestamp.
     *
     * @param duration - Duration string (e.g., "1h", "30m", "24h") or milliseconds.
     * @returns The new timestamp in milliseconds since epoch.
     * @throws Error if the duration format is invalid.
     */
    add(duration: string | number): number {
      const timestamp = Date.now();
      void eventStore.append({
        type: "primitive.invoked",
        name: "date.add",
        params: duration,
        result: undefined,
        executionId: ids.executionId,
        traceId: ids.traceId,
        threadId: ids.threadId,
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
     * Converts the event timestamp to a specific timezone.
     *
     * @param tz - IANA timezone identifier (e.g., "America/Argentina/Buenos_Aires").
     * @returns A TimezoneFormatter for the converted time.
     */
    timezone(tz: string): TimezoneFormatter {
      const formatter: TimezoneFormatter = {
        /**
         * Formats the date in the specified timezone using a format string.
         *
         * @param format - Format string (simple implementation uses ISO format).
         * @returns The formatted date string.
         */
        format(format: string): string {
          const timestamp = Date.now();
          void eventStore.append({
            type: "primitive.invoked",
            name: "date.timezone.format",
            params: { tz, format },
            result: undefined,
            executionId: ids.executionId,
            traceId: ids.traceId,
            threadId: ids.threadId,
            timestamp,
          });

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
