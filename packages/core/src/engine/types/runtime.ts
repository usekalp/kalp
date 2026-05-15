/**
 * Runtime event types - external stimuli entering the reactor.
 *
 * @module
 */

/**
 * Runtime event types matching IR entries.
 * Includes lifecycle hooks, routes, schedules, and resume events.
 */
export type RuntimeEventType =
  | "onMessage"
  | "onCall"
  | "onInit"
  | "onTick"
  | `route:${string}`
  | `schedule:${string}`
  | `event:${string}`
  | "resume";

/**
 * An external event that enters the reactor from the host adapter.
 * Each event maps to an entry in the IR via `type` -> `ir.entries[type]`.
 */
export interface RuntimeEvent {
  /** Event name matching an IR entry key (e.g. "onMessage", "route:GET:/health"). */
  type: RuntimeEventType;
  /** Arbitrary payload associated with the event. */
  payload: unknown;
  /** Opaque thread identifier. Adapter sets this from infrastructure (DO id, etc.). */
  threadId?: string;
  /** Per-handleEvent call identifier for grouping executions. */
  traceId?: string;
}