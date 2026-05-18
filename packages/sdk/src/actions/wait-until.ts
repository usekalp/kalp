/**
 * waitUntil() — wait by timestamp action primitive.
 *
 * Pauses agent execution until the given absolute date/time.
 *
 * Behavioral invariants:
 * - Deterministic
 * - Replay-safe
 * - Cancellation-aware (via AbortSignal)
 *
 * @module
 */

export type TimestampInput = Date | number;

export interface WaitUntilOptions {
  signal?: AbortSignal;
}

export type WaitUntilAction = (
  when: TimestampInput,
  options?: WaitUntilOptions,
) => Promise<void>;
