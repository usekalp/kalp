/**
 * Controlled suspension exception for durable execution.
 *
 * Thrown when a handler calls ctx.actions.waitUntil() or ctx.actions.suspend().
 * The host adapter catches this, persists the suspension state, and schedules wake-up.
 *
 * @module
 */

/**
 * Serializable suspension state for persistence.
 */
import type { ExecutionTask } from "@/engine/types";

export interface SuspensionState {
  /** Timestamp when to resume execution. */
  resumeAt: number;
  /** Reason for waking ("timer", "external", etc.). */
  wakeReason: string;
  /** Serializable checkpoint state to restore execution context. */
  checkpoint: unknown;
  /** Unique execution identifier. */
  executionId: string;
  /** Per-handleEvent call identifier. */
  traceId: string;
  /** Opaque actor identifier. */
  threadId: string;
  /** Hash of the handler code at suspension time (Sequence Key Drift protection). */
  handlerHash: string;
  /** Node ID that was executing when suspended. */
  nodeId: string;
  /** The task to re-enqueue when resuming. */
  task: ExecutionTask;
}

/**
 * Controlled suspension exception.
 *
 * Thrown when a handler needs to pause execution (e.g., after waitUntil).
 * The reactor catches this, persists state, and stops processing.
 * The host adapter later calls resumeFromSuspension to continue.
 */
export class SuspensionException extends Error {
  /**
   * Creates a new SuspensionException.
   *
   * @param resumeAt - Timestamp when to wake up.
   * @param wakeReason - Why we're waking ("timer", "external", etc.).
   * @param checkpoint - Serializable state to restore context.
   */
  constructor(
    public readonly resumeAt: number,
    public readonly wakeReason: string,
    public readonly checkpoint: unknown,
  ) {
    super(`Suspended until ${new Date(resumeAt).toISOString()}`);
    this.name = "SuspensionException";
  }
}
