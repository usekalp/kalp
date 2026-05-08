/**
 * Deterministic math primitive for the Proxy-Listener Runtime.
 *
 * Provides deterministic random number generation and standard math operations.
 *
 * @module
 */

import type { KalpMath } from "@kalphq/sdk";
import type { EventStore } from "@/adapters/interfaces";
import type { ExecutionContext } from "@/engine/types";

/**
 * Creates a math primitive that emits events to EventStore.
 *
 * @param eventStore - The event store for event emission.
 * @param execCtx - Optional execution context for event identity.
 * @returns A {@link KalpMath} instance.
 */
export function createMathPrimitive(
  eventStore: EventStore,
  execCtx?: ExecutionContext,
): KalpMath {
  const ids = {
    executionId: execCtx?.executionId ?? "",
    traceId: execCtx?.traceId ?? "",
    threadId: execCtx?.threadId ?? "",
  };

  let seed =
    execCtx?.executionId.split("").reduce((a, c) => a + c.charCodeAt(0), 0) ??
    Date.now();

  return {
    /**
     * Generates a deterministic pseudo-random number between 0 (inclusive) and 1 (exclusive).
     *
     * The generator is seeded by the execution runId (ULID) for replay consistency.
     * This ensures that "path A" chosen randomly in original execution will be "path A" again in replay.
     *
     * @returns A deterministic float between 0 (inclusive) and 1 (exclusive).
     */
    random(): number {
      const timestamp = Date.now();
      seed = (seed * 9301 + 49297) % 233280;
      const result = seed / 233280;
      void eventStore.append({
        type: "primitive.invoked",
        name: "math.random",
        params: undefined,
        result,
        executionId: ids.executionId,
        traceId: ids.traceId,
        threadId: ids.threadId,
        timestamp,
      });
      return result;
    },

    /**
     * Rounds down to the nearest integer.
     *
     * @param x - The number to round down.
     * @returns The largest integer less than or equal to x.
     */
    floor(x: number): number {
      const result = Math.floor(x);
      const timestamp = Date.now();
      void eventStore.append({
        type: "primitive.invoked",
        name: "math.floor",
        params: x,
        result,
        executionId: ids.executionId,
        traceId: ids.traceId,
        threadId: ids.threadId,
        timestamp,
      });
      return result;
    },

    /**
     * Rounds up to the nearest integer.
     *
     * @param x - The number to round up.
     * @returns The smallest integer greater than or equal to x.
     */
    ceil(x: number): number {
      const result = Math.ceil(x);
      const timestamp = Date.now();
      void eventStore.append({
        type: "primitive.invoked",
        name: "math.ceil",
        params: x,
        result,
        executionId: ids.executionId,
        traceId: ids.traceId,
        threadId: ids.threadId,
        timestamp,
      });
      return result;
    },

    /**
     * Rounds to the nearest integer.
     *
     * @param x - The number to round.
     * @returns The nearest integer to x.
     */
    round(x: number): number {
      const result = Math.round(x);
      const timestamp = Date.now();
      void eventStore.append({
        type: "primitive.invoked",
        name: "math.round",
        params: x,
        result,
        executionId: ids.executionId,
        traceId: ids.traceId,
        threadId: ids.threadId,
        timestamp,
      });
      return result;
    },

    /**
     * Returns the smallest of the provided values.
     *
     * @param values - The numbers to compare.
     * @returns The smallest number in the set.
     */
    min(...values: number[]): number {
      const result = Math.min(...values);
      const timestamp = Date.now();
      void eventStore.append({
        type: "primitive.invoked",
        name: "math.min",
        params: values,
        result,
        executionId: ids.executionId,
        traceId: ids.traceId,
        threadId: ids.threadId,
        timestamp,
      });
      return result;
    },

    /**
     * Returns the largest of the provided values.
     *
     * @param values - The numbers to compare.
     * @returns The largest number in the set.
     */
    max(...values: number[]): number {
      const result = Math.max(...values);
      const timestamp = Date.now();
      void eventStore.append({
        type: "primitive.invoked",
        name: "math.max",
        params: values,
        result,
        executionId: ids.executionId,
        traceId: ids.traceId,
        threadId: ids.threadId,
        timestamp,
      });
      return result;
    },

    /**
     * Returns the absolute value of a number.
     *
     * @param x - The number to get the absolute value of.
     * @returns The absolute value of x.
     */
    abs(x: number): number {
      const result = Math.abs(x);
      const timestamp = Date.now();
      void eventStore.append({
        type: "primitive.invoked",
        name: "math.abs",
        params: x,
        result,
        executionId: ids.executionId,
        traceId: ids.traceId,
        threadId: ids.threadId,
        timestamp,
      });
      return result;
    },

    /**
     * Returns base raised to the power of exponent.
     *
     * @param base - The base number.
     * @param exponent - The exponent.
     * @returns base raised to the power of exponent.
     */
    pow(base: number, exponent: number): number {
      const result = Math.pow(base, exponent);
      const timestamp = Date.now();
      void eventStore.append({
        type: "primitive.invoked",
        name: "math.pow",
        params: { base, exponent },
        result,
        executionId: ids.executionId,
        traceId: ids.traceId,
        threadId: ids.threadId,
        timestamp,
      });
      return result;
    },

    /**
     * Returns the square root of a number.
     *
     * @param x - The number to get the square root of.
     * @returns The square root of x.
     */
    sqrt(x: number): number {
      const result = Math.sqrt(x);
      const timestamp = Date.now();
      void eventStore.append({
        type: "primitive.invoked",
        name: "math.sqrt",
        params: x,
        result,
        executionId: ids.executionId,
        traceId: ids.traceId,
        threadId: ids.threadId,
        timestamp,
      });
      return result;
    },
  };
}
