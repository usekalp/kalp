/**
 * Execution events - the system's source of truth.
 *
 * @module
 */

import type { UntrackedIOSource } from "./execution";

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
      nodeId: string;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "node.completed";
      nodeId: string;
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
      type: "action.sleep";
      duration: number;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "action.suspend";
      resumeAt: number;
      wakeReason: string;
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
      type: "action.call.started";
      listener: string;
      data: unknown;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "action.call.completed";
      listener: string;
      result: unknown;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "listener.queued";
      listenerEntryKey: string;
      payload: unknown;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "listener.started";
      listenerEntryKey: string;
      payload: unknown;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "listener.completed";
      listenerEntryKey: string;
      payload: unknown;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "listener.failed";
      listenerEntryKey: string;
      error: string;
      payload: unknown;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "listener.invoked";
      sourceAgentId: string;
      eventName: string;
      payload: unknown;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "route.started";
      routeId: string;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "route.completed";
      routeId: string;
      result: unknown;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "schedule.fired";
      scheduleId: string;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "schedule.completed";
      scheduleId: string;
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
      nodeId?: string;
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
      type: "execution.suspended";
      nodeId: string;
      resumeAt: number;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "execution.resumed";
      nodeId: string;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    }
  | {
      type: "error";
      nodeId?: string;
      error: string;
      executionId: string;
      traceId: string;
      threadId: string;
      timestamp: number;
    };