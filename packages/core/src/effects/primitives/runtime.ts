import type { KalpRuntime, WakeReason } from "@kalphq/sdk";

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
