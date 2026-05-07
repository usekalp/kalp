/**
 * Deterministic math primitive interface for Event Sourcing.
 *
 * Provides deterministic random number generation and standard
 * math operations. Do NOT use native Math.random() in agent code.
 *
 * @module
 */

/**
 * Deterministic math primitive for agent execution.
 *
 * The `random()` method is seeded by the execution runId (ULID),
 * ensuring that replays produce identical random sequences.
 *
 * @example
 * ```typescript
 * // Deterministic random (seeded by runId)
 * const roll = Math.floor(ctx.math.random() * 6) + 1;
 *
 * // Standard math operations
 * const max = ctx.math.max(1, 5, 3);
 * const rounded = ctx.math.floor(3.7);
 * ```
 */
export interface KalpMath {
  /**
   * Deterministic pseudo-random number generator.
   * Seeded by the execution runId (ULID) for replay consistency.
   *
   * Guarantees: Same runId produces identical random sequence.
   * This ensures that "path A" chosen randomly in original execution
   * will be "path A" again in Studio replay.
   *
   * @returns A deterministic float between 0 (inclusive) and 1 (exclusive).
   */
  random: () => number;

  /** Round down to nearest integer. */
  floor: (x: number) => number;

  /** Round up to nearest integer. */
  ceil: (x: number) => number;

  /** Round to nearest integer. */
  round: (x: number) => number;

  /** Return smallest of provided values. */
  min: (...values: number[]) => number;

  /** Return largest of provided values. */
  max: (...values: number[]) => number;

  /** Return absolute value. */
  abs: (x: number) => number;

  /** Return base to the power of exponent. */
  pow: (base: number, exponent: number) => number;

  /** Return square root. */
  sqrt: (x: number) => number;
}
