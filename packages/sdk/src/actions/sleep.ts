/**
 * sleep() — wait by duration action primitive.
 *
 * Pauses agent execution for the given duration.
 * Alias of the internal wait implementation.
 *
 * Behavioral invariants:
 * - Deterministic
 * - Replay-safe
 * - Cancellation-aware (via AbortSignal)
 *
 * @module
 */

import type { Duration } from "@/primitives/duration";

export interface SleepOptions {
  signal?: AbortSignal;
}

export type SleepAction = (
  duration: Duration,
  options?: SleepOptions,
) => Promise<void>;
