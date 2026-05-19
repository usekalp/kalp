/**
 * Controlled suspension exception for durable execution.
 *
 * Thrown when a handler calls ctx.actions.waitUntil() or ctx.actions.suspend().
 * The host adapter catches this, persists the suspension state, and schedules wake-up.
 *
 * @module
 */

import type { ExecutionTask } from "@/engine/types";

/**
 * Serializable suspension state for checkpointing and resuming a paused execution.
 */
export interface SuspensionState {
  /** Timestamp in milliseconds when to resume execution. */
  resumeAt: number;
  /** Reason for waking ("timer", "external", etc.). */
  wakeReason: string;
  /** Serializable checkpoint state to restore the execution context on resume. */
  checkpoint: unknown;
  /** Unique execution identifier. */
  executionId: string;
  /** Per-handleEvent call trace identifier. */
  traceId: string;
  /** Thread identifier for the suspended execution. */
  threadId: string;
  /** Hash of the handler code at suspension time for sequence key drift protection. */
  handlerHash: string;
  /** Node ID that was executing when the suspension occurred. */
  nodeId: string;
  /** The execution task to re-enqueue when resuming. */
  task: ExecutionTask;
  /** Sequence counter at suspension time for exact replay positioning. */
  seqCounter: number;
}

/**
 * Controlled suspension exception for durable execution.
 *
 * Thrown when a handler needs to pause execution (e.g., after waitUntil or suspend).
 * The reactor catches this exception, persists the suspension state, and halts processing.
 * The host adapter resumes execution at a later time.
 */
export class SuspensionException extends Error {
  /**
   * Creates a new SuspensionException.
   *
   * @param resumeAt - Timestamp when to wake up.
   * @param wakeReason - Why we're waking ("timer", "external", etc.).
   * @param checkpoint - Serializable state to restore context.
   * @param seqCounter - Sequence counter at suspension for exact replay.
   */
  constructor(
    public readonly resumeAt: number,
    public readonly wakeReason: string,
    public readonly checkpoint: unknown,
    public readonly seqCounter: number,
  ) {
    super(`Suspended until ${new Date(resumeAt).toISOString()}`);
    this.name = "SuspensionException";
  }
}
