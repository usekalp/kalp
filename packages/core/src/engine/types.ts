/**
 * Core runtime types for the Kalp v2 Orchestration Reactor.
 *
 * These types define the execution event model, task primitives, and runtime
 * event contracts. They are intentionally infrastructure-agnostic — no
 * Cloudflare, Durable Object, or platform-specific types appear here.
 *
 * @module
 */

import type { IRNodeId } from "@kalphq/sdk";

// ────────────────────────────────────────────────────────────────────────────
// Execution Events — the system's source of truth
// ────────────────────────────────────────────────────────────────────────────

/**
 * Union of all structured events emitted during agent execution.
 *
 * Every runtime operation MUST emit an event. If it doesn't emit an event,
 * it doesn't exist in the system. This is the fundamental invariant.
 *
 * These events enable: replay, debugging, billing, observability, and
 * deterministic re-execution.
 */
export type ExecutionEvent =
  | { type: "node.started"; nodeId: IRNodeId; timestamp: number }
  | { type: "node.completed"; nodeId: IRNodeId; result: unknown; timestamp: number }
  | { type: "primitive.invoked"; name: string; params: unknown; result: unknown; timestamp: number }
  | { type: "action.run"; target: string; input: unknown; timestamp: number }
  | { type: "action.run.completed"; target: string; result: unknown; timestamp: number }
  | { type: "action.wait"; duration: string | number; timestamp: number }
  | { type: "action.loop.start"; loopId: string; timestamp: number }
  | { type: "action.loop.iteration"; loopId: string; iteration: number; timestamp: number }
  | { type: "action.loop.end"; loopId: string; reason: string; timestamp: number }
  | { type: "state.write"; key: string; value: unknown; timestamp: number }
  | { type: "state.read"; key: string; value: unknown; timestamp: number }
  | { type: "error"; nodeId?: IRNodeId; error: string; timestamp: number };

// ────────────────────────────────────────────────────────────────────────────
// Runtime Events — external stimuli entering the reactor
// ────────────────────────────────────────────────────────────────────────────

/**
 * An external event that enters the reactor from the host adapter.
 * Each event maps to an entry in the IR via `type` → `ir.entries[type]`.
 */
export interface RuntimeEvent {
  /** Event name matching an IR entry key (e.g. "onMessage", "route:GET:/health"). */
  type: string;
  /** Arbitrary payload associated with the event. */
  payload: unknown;
}

// ────────────────────────────────────────────────────────────────────────────
// Execution Tasks — internal work items in the reactor queue
// ────────────────────────────────────────────────────────────────────────────

/**
 * A task in the reactor's internal execution queue.
 * Created when a node needs to be processed (entry traversal, handler execution, etc.).
 */
export interface ExecutionTask {
  /** The IR node to process. */
  nodeId: IRNodeId;
  /** Context data passed to the handler. */
  context: unknown;
  /**
   * Optional resolve callback for action.run intent pattern.
   * When a handler calls `actions.run(step, input)`, the reactor creates a
   * task with a resolve function. The handler's Promise awaits this resolve.
   */
  resolve?: (result: unknown) => void;
}

// ────────────────────────────────────────────────────────────────────────────
// Handler Module — the shape of a bundled handler
// ────────────────────────────────────────────────────────────────────────────

/**
 * The runtime representation of a bundled handler module.
 *
 * Each handler is an isolated function that receives a {@link HandlerContext}
 * (from `@kalphq/sdk`) and returns a result. The reactor executes these in a
 * sandboxed context with intercepted primitives.
 */
export interface HandlerModule {
  /** The handler's entry function. */
  default: (context: unknown, input?: unknown) => Promise<unknown>;
}
