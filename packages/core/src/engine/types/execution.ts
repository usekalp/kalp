/**
 * Execution model types - identity, hierarchy, and observability.
 *
 * @module
 */

/**
 * Categories of untracked IO that Kalp can detect (best-effort).
 *
 * - `"network"` — bare `globalThis.fetch` or similar outside `actions.fetch`.
 * - `"timer"` — `setTimeout` / `setInterval` outside `actions.wait`.
 * - `"fs"` — Node `fs` access (not applicable in all runtimes; kept for portability).
 * - `"unknown"` — anything else the heuristic can't classify.
 */
export type UntrackedIOSource = "network" | "timer" | "fs" | "unknown";

/**
 * Execution identity carried through every handler invocation.
 *
 * Hierarchy:
 * ```
 * thread = actor instance (identified by threadId)
 *   +-- trace = one handleEvent() call into the actor
 *         +-- execution = one handler invocation (step/tool/lifecycle run)
 * ```
 *
 * `threadId` is opaque in Core. The adapter maps it to infrastructure
 * (e.g. Durable Object id, in-memory key). Core never parses or assumes its format.
 */
export interface ExecutionContext {
  /** Unique per handler invocation (UUID). Distinguishes retries, loop iterations. */
  executionId: string;
  /** Per `handleEvent()` call. Groups all executions from one external stimulus. */
  traceId: string;
  /** Opaque actor identifier. Adapter maps to infrastructure (CF: DO id, tests: in-memory). */
  threadId: string;
  /** Total count of detected untracked IO operations. */
  untrackedIOCount: number;
  /** Breakdown of untracked IO by source type. */
  untrackedIOByType: Record<UntrackedIOSource, number>;
  /** Whether any plugin has been loaded (observability may be incomplete). */
  hasUntrustedPlugins: boolean;
  /**
   * Synchronous sequence counter for deterministic replay.
   * Assigned at call time (before any await), ensuring parallel
   * execution with Promise.all remains deterministic.
   */
  seqCounter: number;
}