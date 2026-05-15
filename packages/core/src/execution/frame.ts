import type { UntrackedIOSource } from "@/engine/types";

/**
 * Global execution context for an entire `handleEvent` trace.
 */
export interface ExecutionContext {
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

/**
 * Local scope for a specific handler invocation.
 * Supports nested executions by isolating sequence scopes.
 */
export interface ExecutionFrame {
  /** Unique per handler invocation (UUID). Distinguishes retries, loop iterations. */
  executionId: string;
  /** 
   * Synchronous sequence counter for deterministic replay inside this frame.
   * Scoped locally to prevent drift from nested child executions.
   */
  seqCounter: number;
  /** The trace context this frame belongs to. */
  ctx: ExecutionContext;
  /** Parent execution frame if nested (e.g. action.run) */
  parentExecutionId?: string;
}

/**
 * Initialize a root frame.
 */
export function createRootFrame(
  ctx: ExecutionContext,
  executionId: string,
  startingSeq: number = 0
): ExecutionFrame {
  return {
    executionId,
    seqCounter: startingSeq,
    ctx,
  };
}

/**
 * Claim the next sequence number in this frame.
 */
export function nextSeq(frame: ExecutionFrame): number {
  const seq = frame.seqCounter;
  frame.seqCounter += 1;
  return seq;
}
