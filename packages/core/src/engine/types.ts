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
// Execution Model — identity, hierarchy, and observability
// ────────────────────────────────────────────────────────────────────────────

/**
 * Categories of untracked IO that Kalp can detect (best-effort).
 *
 * - `"network"` — bare `globalThis.fetch` or similar outside `actions.fetch`.
 * - `"timer"` — `setTimeout` / `setInterval` outside `actions.wait`.
 * - `"fs"` — Node `fs` access (not applicable in all runtimes; kept for portability).
 * - `"unknown"` — anything else the heuristic can’t classify.
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
}

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
  | {
      type: "node.started";
      nodeId: IRNodeId;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "node.completed";
      nodeId: IRNodeId;
      result: unknown;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "primitive.invoked";
      name: string;
      params: unknown;
      result: unknown;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "action.run";
      target: string;
      input: unknown;
      idempotencyKey?: string;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "action.run.completed";
      target: string;
      result: unknown;
      idempotencyKey?: string;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "action.wait";
      duration: string | number;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "action.loop.start";
      loopId: string;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "action.loop.iteration";
      loopId: string;
      iteration: number;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "action.loop.end";
      loopId: string;
      reason: string;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "action.fetch";
      url: string;
      method: string;
      status: number;
      durationMs: number;
      idempotencyKey?: string;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "action.emit";
      event: string;
      payload: unknown;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "action.schedule";
      at: number;
      payload: unknown;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "state.write";
      key: string;
      value: unknown;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "state.read";
      key: string;
      value: unknown;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "action.ask";
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "action.approval";
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "action.call";
      contract: string;
      input: unknown;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "execution.untracked";
      source: UntrackedIOSource;
      location?: string;
      nodeId?: IRNodeId;
      action?: string;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "log";
      level: "debug" | "info" | "warn" | "error";
      msg: string;
      data?: Record<string, unknown>;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "error";
      nodeId?: IRNodeId;
      error: string;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    };

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
  /** Opaque thread identifier. Adapter sets this from infrastructure (DO id, etc.). */
  threadId?: string;
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
