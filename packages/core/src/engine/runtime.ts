import type { BundleManifest, IRGraph, SchemaRegistry } from "@kalphq/sdk";
import type { RuntimeEvent } from "@/engine/types";
import type { PersistenceAdapter } from "@/adapters/interfaces";
import type { EffectResolver } from "@/effects/types";
import { ReplayLog } from "../state/replay-log";
import { createRootFrame, type ExecutionContext } from "../execution/frame";
import { resolveNodeId } from "./event-router";
import {
  executeHandlerBundle,
  type RuntimeBundleLoader,
} from "./handler-executor";
import { loadAgentState, persistValidatedState } from "./state-manager";
import { resolveSchema, applyStateDefaults } from "./schema-utils";

function calculateStartingSeq(
  log: ReplayLog,
  executionId: string,
): number {
  const events = log.getAll(executionId);
  if (!events) return 0;

  let maxSeq = 0;
  for (const event of events) {
    if (event && event.seq !== undefined) {
      maxSeq = Math.max(maxSeq, event.seq);
    }
  }
  return maxSeq > 0 ? maxSeq + 1 : 0;
}

function resolveExecutionId(event: RuntimeEvent): string {
  if (event.type === "resume" && event.payload && typeof event.payload === "object") {
    return (event.payload as { executionId: string }).executionId;
  }
  return crypto.randomUUID();
}

function resolveTraceId(event: RuntimeEvent): string {
  if (event.traceId) return event.traceId;
  return crypto.randomUUID();
}

/**
 * The Kalp runtime engine.
 *
 * Orchestrates event handling, execution framing, state management, and
 * replay log initialization for durable agent execution. Validates IR compatibility,
 * ABI version, and runtime capability requirements on construction.
 */
export class KalpRuntime {
  /**
   * @param ir - The agent's IR graph definition.
   * @param schemas - The schema registry for state validation.
   * @param bundleManifest - The bundle manifest for handler resolution.
   * @param bundleLoader - The bundle loader for handler code.
   * @param persistence - The persistence adapter for state and event storage.
   * @param resolver - The effect resolver for side effects.
   * @throws If the IR schema, ABI, or capability requirements are incompatible.
   */
  constructor(
    private readonly ir: IRGraph,
    private readonly schemas: SchemaRegistry,
    private readonly bundleManifest: BundleManifest,
    private readonly bundleLoader: RuntimeBundleLoader,
    private readonly persistence: PersistenceAdapter,
    private readonly resolver: EffectResolver,
  ) {
    if (ir.schemaVersion !== 3) {
      throw new Error(
        `IR incompatible (received schemaVersion ${String(ir.schemaVersion)}). Please recompile the agent with the current SDK/Compiler.`,
      );
    }

    if (!bundleManifest.targets.default) {
      throw new Error("Bundle manifest missing targets.default.");
    }

    if (bundleManifest.targets.default.abiVersion !== 1) {
      throw new Error(
        `Unsupported runtime ABI ${String(bundleManifest.targets.default.abiVersion)}. Expected ABI 1.`,
      );
    }
  }

  /**
   * Handles an incoming runtime event through the full lifecycle:
   * execution ID resolution, replay log initialization, handler lookup,
   * state loading, handler execution, and state persistence.
   *
   * @param event - The runtime event to process.
   * @returns The handler execution result, or suspension metadata if suspended.
   */
  async handleEvent(event: RuntimeEvent): Promise<unknown> {
    const executionId = resolveExecutionId(event);
    const traceId = resolveTraceId(event);
    const log = await this.initReplayLog(event.threadId, traceId);

    const nodeId = resolveNodeId(event.type, this.ir);
    if (!nodeId) {
      throw new Error(`No handler found for event type: ${event.type}`);
    }

    const stateSchema = resolveSchema(this.ir.agent?.stateSchema, this.schemas);
    const state = applyStateDefaults(
      stateSchema,
      await loadAgentState(this.persistence),
    );
    const frame = this.bootstrapFrame(executionId, traceId, event.threadId, log);
    const result = await this.runHandler(nodeId, event, frame, log, state);

    await persistValidatedState(stateSchema, state, frame, this.persistence);
    return result;
  }

  private async initReplayLog(
    threadId: string | undefined,
    traceId: string,
  ): Promise<ReplayLog> {
    const log = new ReplayLog();
    await log.loadFromSQLite(this.persistence.events, { threadId, traceId });
    return log;
  }

  private bootstrapFrame(
    executionId: string,
    traceId: string,
    threadId: string | undefined,
    log: ReplayLog,
  ) {
    const execCtx: ExecutionContext = {
      traceId,
      threadId: threadId ?? "system",
      untrackedIOCount: 0,
      untrackedIOByType: { network: 0, timer: 0, fs: 0, unknown: 0 },
      hasUntrustedPlugins: false,
    };

    const startingSeq = calculateStartingSeq(log, executionId);
    return createRootFrame(execCtx, executionId, startingSeq);
  }

  private async runHandler(
    nodeId: string,
    event: RuntimeEvent,
    frame: ReturnType<typeof createRootFrame>,
    log: ReplayLog,
    state: Record<string, unknown>,
  ): Promise<unknown> {
    const result = await executeHandlerBundle(
      nodeId, event, frame, log, this.persistence, this.resolver, this.ir,
      this.schemas, this.bundleManifest, this.bundleLoader, state,
    );

    return result.value ?? { suspended: true, until: result.until, wakeReason: result.wakeReason };
  }
}
