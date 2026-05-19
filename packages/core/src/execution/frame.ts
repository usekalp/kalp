import type { UntrackedIOSource } from "@/engine/types";

/**
 * Captures the causal scope of a single `handleEvent` stimulus.
 *
 * Provides a globally unique trace identity and tracks side-effect purity
 * across the entire execution tree rooted at one external input.
 */
export interface ExecutionContext {
  /** Groups all frames, effects, and events produced by one external stimulus into a single trace for replay and observability. */
  traceId: string;
  /** Identifies the actor executing this trace. Maps to infrastructure primitives (e.g. Cloudflare DO, test in-memory actor) via the adapter layer. */
  threadId: string;
  /** Accumulates best-effort detections of IO that bypassed the effect system, compromising deterministic replay guarantees. */
  untrackedIOCount: number;
  /** Breaks down untracked IO detections by source category for debugging replay fidelity. */
  untrackedIOByType: Record<UntrackedIOSource, number>;
  /** Flags whether untrusted plugin code was loaded, which may have performed IO outside the tracked effect system. */
  hasUntrustedPlugins: boolean;
}

/**
 * Isolates a single handler invocation's sequencing state.
 *
 * Nested executions (e.g. `action.run`, listener dispatch) each get their own
 * frame so that effect sequences remain independently scoped and deterministic
 * replay does not drift across nesting levels.
 */
export interface ExecutionFrame {
  /** UUID uniquely identifying this handler invocation. Changes on retries and loop iterations to prevent sequence collision. */
  executionId: string;
  /** 
   * Monotonically increasing counter scoped to this frame.
   * Determines the ordering of effect emission for deterministic replay.
   * Scoped locally to prevent drift from nested child executions.
   */
  seqCounter: number;
  /** Reference to the parent execution context that owns this frame. */
  ctx: ExecutionContext;
  /** Links to the frame that spawned this nested execution, or absent if this is a root frame. */
  parentExecutionId?: string;
}

/**
 * Creates the initial {@link ExecutionFrame} for a new handler invocation.
 *
 * Establishes the execution identity and sequence scope that all effects
 * emitted by this handler will anchor to for deterministic replay.
 *
 * @param ctx - The execution context this frame belongs to.
 * @param executionId - Unique identifier for this handler invocation.
 * @param startingSeq - Initial sequence counter value (default 0).
 * @returns A new root frame with no parent.
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
