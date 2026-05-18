/**
 * Runtime execution context.
 *
 * Contains metadata about the current agent execution run.
 *
 * @module
 */

import type { WakeReason } from "@/actions/types";

export interface KalpRuntime {
  /** Unique identifier for this execution run. */
  runId: string;

  /** Environment where the agent is running. */
  environment: "dev" | "production";

  /** Generation number (increments on restarts/replays). */
  generation?: number;

  /** Reason why the agent was last woken up (if applicable). */
  lastWakeReason?: WakeReason;

  /** Timestamp when this run started (ms since epoch). */
  startedAt: number;

  /** Unique identifier for this specific execution (per-wake). */
  executionId: string;

  /** Distributed tracing correlation ID. */
  traceId: string;

  /** Conversation/thread this execution belongs to. */
  threadId: string;
}
