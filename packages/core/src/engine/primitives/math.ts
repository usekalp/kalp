/**
 * Deterministic math primitive.
 *
 * Provides deterministic random number generation and standard math operations.
 *
 * @module
 */

import type { ExecutionLog } from "@/engine/execution-log";
import type { KalpMath } from "@kalphq/sdk";
import type { ExecutionContext } from "@/engine/types";

/**
 * Creates a math primitive that emits events to the execution log.
 *
 * @param log - The execution log for event emission.
 * @param execCtx - Optional execution context for event identity.
 * @returns A {@link KalpMath} instance.
 */
export function createMathPrimitive(
  log: ExecutionLog,
  execCtx?: ExecutionContext,
): KalpMath {
  const ids = {
    executionId: execCtx?.executionId ?? "",
    traceId: execCtx?.traceId ?? "",
    threadId: execCtx?.threadId ?? "",
  };

  // Simple seeded random for deterministic behavior
  let seed = execCtx?.executionId.split("").reduce((a, c) => a + c.charCodeAt(0), 0) ?? Date.now();

  return {
    /**
     * Deterministic pseudo-random number generator.
     * Seeded by the execution runId (ULID) for replay consistency.
     */
    random(): number {
      const timestamp = Date.now();
      seed = (seed * 9301 + 49297) % 233280;
      const result = seed / 233280;
      void log.emit({
        type: "primitive.invoked",
        name: "math.random",
        params: undefined,
        result,
        ...ids,
        timestamp,
      });
      return result;
    },

    /** Round down to nearest integer. */
    floor(x: number): number {
      const result = Math.floor(x);
      const timestamp = Date.now();
      void log.emit({
        type: "primitive.invoked",
        name: "math.floor",
        params: x,
        result,
        ...ids,
        timestamp,
      });
      return result;
    },

    /** Round up to nearest integer. */
    ceil(x: number): number {
      const result = Math.ceil(x);
      const timestamp = Date.now();
      void log.emit({
        type: "primitive.invoked",
        name: "math.ceil",
        params: x,
        result,
        ...ids,
        timestamp,
      });
      return result;
    },

    /** Round to nearest integer. */
    round(x: number): number {
      const result = Math.round(x);
      const timestamp = Date.now();
      void log.emit({
        type: "primitive.invoked",
        name: "math.round",
        params: x,
        result,
        ...ids,
        timestamp,
      });
      return result;
    },

    /** Return smallest of provided values. */
    min(...values: number[]): number {
      const result = Math.min(...values);
      const timestamp = Date.now();
      void log.emit({
        type: "primitive.invoked",
        name: "math.min",
        params: values,
        result,
        ...ids,
        timestamp,
      });
      return result;
    },

    /** Return largest of provided values. */
    max(...values: number[]): number {
      const result = Math.max(...values);
      const timestamp = Date.now();
      void log.emit({
        type: "primitive.invoked",
        name: "math.max",
        params: values,
        result,
        ...ids,
        timestamp,
      });
      return result;
    },

    /** Return absolute value. */
    abs(x: number): number {
      const result = Math.abs(x);
      const timestamp = Date.now();
      void log.emit({
        type: "primitive.invoked",
        name: "math.abs",
        params: x,
        result,
        ...ids,
        timestamp,
      });
      return result;
    },

    /** Return base to the power of exponent. */
    pow(base: number, exponent: number): number {
      const result = Math.pow(base, exponent);
      const timestamp = Date.now();
      void log.emit({
        type: "primitive.invoked",
        name: "math.pow",
        params: { base, exponent },
        result,
        ...ids,
        timestamp,
      });
      return result;
    },

    /** Return square root. */
    sqrt(x: number): number {
      const result = Math.sqrt(x);
      const timestamp = Date.now();
      void log.emit({
        type: "primitive.invoked",
        name: "math.sqrt",
        params: x,
        result,
        ...ids,
        timestamp,
      });
      return result;
    },
  };
}
