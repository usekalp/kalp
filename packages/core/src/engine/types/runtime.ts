/**
 * Runtime event types - external stimuli entering the reactor.
 *
 * @module
 */

export type RuntimeEventType =
  | "onMessage"
  | "onInit"
  | "onTick"
  | `contract:${string}`
  | `route:${string}`
  | `schedule:${string}`
  | `listener:${string}`
  | "resume";

export interface RuntimeEvent {
  type: RuntimeEventType;
  payload: unknown;
  threadId?: string;
  traceId?: string;
}
