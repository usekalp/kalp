/**
 * loop() — typed loop action primitive.
 *
 * Executes a body function repeatedly until stop() is called,
 * maxIterations is reached, timeout expires, or signal is aborted.
 *
 * Behavioral invariants:
 * - stop() exits immediately
 * - AbortSignal has highest precedence
 * - maxIterations enforced strictly
 * - LoopStopError never escapes boundary (internal sentinel only)
 *
 * @module
 */

import type { Duration } from "@/primitives/duration";

export interface LoopContext<T = void> {
  /** Current iteration index (0-based). */
  index: number;

  /** Stop the loop and optionally return a value. */
  stop(value?: T): void;

  /** AbortSignal for external cancellation. */
  signal: AbortSignal;
}

export interface LoopOptions {
  delay?: Duration;
  maxIterations?: number;
  timeout?: Duration;
  signal?: AbortSignal;
}

export type LoopAction = <T = void>(
  body: (ctx: LoopContext<T>) => Promise<void>,
  options?: LoopOptions,
) => Promise<T | undefined>;
