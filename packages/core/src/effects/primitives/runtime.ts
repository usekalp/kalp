import type { KalpRuntime, WakeReason } from "@kalphq/sdk";

/**
 * Options for creating the runtime context, describing the current execution environment
 * including identifiers for the run, execution, trace, and thread.
 */
export interface CreateRuntimeContextOptions {
  runId: string;
  executionId: string;
  traceId: string;
  threadId: string;
  environment: "dev" | "production";
  generation?: number;
  lastWakeReason?: WakeReason;
  startedAt: number;
}

/**
 * Create the runtime context providing execution metadata to the agent,
 * including run ID, environment, generation, and tracing identifiers.
 *
 * @param opts - Runtime context options describing the current execution environment.
 */
export function createRuntimeContext(opts: CreateRuntimeContextOptions): KalpRuntime {
  return {
    runId: opts.runId,
    environment: opts.environment,
    generation: opts.generation,
    lastWakeReason: opts.lastWakeReason,
    startedAt: opts.startedAt,
    executionId: opts.executionId,
    traceId: opts.traceId,
    threadId: opts.threadId,
  };
}
