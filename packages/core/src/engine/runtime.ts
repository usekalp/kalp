import type { IRGraph } from "@kalphq/sdk";
import type { RuntimeEvent } from "@/engine/types";
import type { PersistenceAdapter } from "@/adapters/interfaces";
import type { EffectResolver } from "@/effects/types";
import { ReplayLog } from "../state/replay-log";
import { createRootFrame, type ExecutionContext } from "../execution/frame";
import { isDispatchEnvelope, resolveHandlerHash, calculateStartingSeq } from "./runtime-utils";
import { executeHandlerBundle } from "./handler-executor";

export class KalpRuntime {
  constructor(
    private readonly ir: IRGraph,
    private readonly persistence: PersistenceAdapter,
    private readonly resolver: EffectResolver,
  ) {
    if (Number(ir.version) !== 2) {
      throw new Error(
        `IR incompatible (received v${String(ir.version)}). Please recompile the agent with the current SDK/Compiler.`,
      );
    }
  }

  async handleEvent(event: RuntimeEvent): Promise<unknown> {
    const executionId = resolveExecutionId(event);
    const traceId = resolveTraceId(event);
    const log = await this.initReplayLog(event.threadId, traceId);

    const handlerHash = resolveHandlerHash(event.type, this.ir);
    if (!handlerHash) {
      throw new Error(`No handler found for event type: ${event.type}`);
    }

    const frame = this.bootstrapFrame(executionId, traceId, event.threadId, log);
    return this.runHandler(handlerHash, event, frame, log);
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
    handlerHash: string,
    event: RuntimeEvent,
    frame: ReturnType<typeof createRootFrame>,
    log: ReplayLog,
  ): Promise<unknown> {
    const result = await executeHandlerBundle(
      handlerHash,
      event,
      frame,
      log,
      this.persistence,
      this.resolver,
      this.ir,
    );

    return result.value ?? { suspended: true, until: result.until, wakeReason: result.wakeReason };
  }
}

function resolveExecutionId(event: RuntimeEvent): string {
  if (event.type === "resume" && event.payload && typeof event.payload === "object") {
    return (event.payload as { executionId: string }).executionId;
  }
  return crypto.randomUUID();
}

function resolveTraceId(event: RuntimeEvent): string {
  if (event.traceId) return event.traceId;
  if (isDispatchEnvelope(event.payload)) return event.payload.traceId;
  return crypto.randomUUID();
}