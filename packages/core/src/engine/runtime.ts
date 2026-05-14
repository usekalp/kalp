/**
 * Kalp Proxy-Listener Runtime.
 *
 * The runtime executes agent handlers with intercepted context proxies.
 * On suspension, the handler state is persisted via events. On resume,
 * the handler re-executes from line 1, with proxies returning cached
 * results for already-completed operations.
 *
 * @module
 */

import type { IRGraph, KalpContext } from "@kalphq/sdk";
import type {
  PersistenceAdapter,
  SchedulerAdapter,
} from "@/adapters/interfaces";
import type {
  RuntimeEvent,
  EventDispatchEnvelope,
  ExecutionContext,
} from "@/engine/types";
import type { IntentEvent } from "@/engine/event-log-buffer";
import { EventLogBuffer } from "@/engine/event-log-buffer";
import { SuspensionException } from "@/engine/suspension";
import {
  buildKalpContext,
  type RuntimeProviders,
} from "@/engine/context-builder";

/**
 * The Kalp Proxy-Listener Runtime.
 *
 * Processes external events by:
 * 1. Loading persisted events from EventStore
 * 2. Creating context proxies with EventLogBuffer
 * 3. Executing the handler from line 1
 * 4. Catching SuspensionException for deferred wake-up
 */
export class KalpRuntime {
  private static readonly SUPPORTED_IR_VERSION = 1;

  constructor(
    private ir: IRGraph,
    private persistence: PersistenceAdapter,
    private scheduler: SchedulerAdapter,
    private providers: RuntimeProviders,
  ) {
    if (Number(ir.version) !== KalpRuntime.SUPPORTED_IR_VERSION) {
      throw new Error(
        `IR incompatible (received v${String(ir.version)}, expected v${KalpRuntime.SUPPORTED_IR_VERSION}). Recompile with the current SDK/Compiler.`,
      );
    }
  }

  /**
   * Handles an external event by executing the corresponding handler.
   *
   * On resume events, the executionId from the payload is used to load
   * the correct event history. The handler re-executes from line 1,
   * with proxies returning cached results for already-completed operations.
   *
   * @param event - The external runtime event.
   * @returns The result of the handler execution, or suspension info.
   * @throws If no entry exists for the event type.
   */
  async handleEvent(event: RuntimeEvent): Promise<unknown> {
    const { threadId, payload } = event;

    // Preserve executionId on resume to load correct EventLog
    const executionId =
      event.type === "resume" && payload && typeof payload === "object"
        ? (payload as { executionId: string }).executionId
        : crypto.randomUUID();

    // Preserve incoming trace for causal chains (emit -> listener fan-out)
    const traceId =
      event.traceId ??
      (this.isDispatchEnvelope(payload) ? payload.traceId : crypto.randomUUID());

    // Load event log from SQLite into memory
    const log = new EventLogBuffer();
    await log.loadFromSQLite(this.persistence.events, { threadId, traceId });

    // O(1) lookup in entries
    const handlerHash = this.resolveHandlerHash(event.type);
    if (!handlerHash) {
      throw new Error(`No handler for event: ${event.type}`);
    }

    // Calculate starting sequence number from existing events
    const execCtx: ExecutionContext = {
      executionId,
      traceId,
      threadId: threadId ?? "",
      untrackedIOCount: 0,
      untrackedIOByType: { network: 0, timer: 0, fs: 0, unknown: 0 },
      hasUntrustedPlugins: false,
      seqCounter: this.calculateStartingSeq(log, executionId),
    };

    // Execute handler with drift protection
    return this.executeHandler(handlerHash, event, execCtx, log);
  }

  private isDispatchEnvelope(payload: unknown): payload is EventDispatchEnvelope {
    if (!payload || typeof payload !== "object") return false;
    const value = payload as Record<string, unknown>;
    return (
      typeof value.eventName === "string" &&
      typeof value.traceId === "string" &&
      typeof value.parentExecutionId === "string"
    );
  }

  private async dispatchListenersFromEmit(
    envelope: EventDispatchEnvelope,
    threadId: string,
  ): Promise<void> {
    const listeners =
      this.ir.metadata.listeners?.filter((listener) => {
        if (listener.event !== envelope.eventName) return false;
        if (!envelope.sourceAgentId) return true;
        return listener.sourceAgentId === envelope.sourceAgentId;
      }) ?? [];

    for (const listener of listeners) {
      await this.persistence.events.append({
        type: "listener.queued",
        listenerEntryKey: listener.targetEntryKey,
        payload: envelope,
        executionId: envelope.parentExecutionId,
        traceId: envelope.traceId,
        threadId,
        timestamp: Date.now(),
      });

      void (async () => {
        const listenerExecutionId = crypto.randomUUID();
        await this.persistence.events.append({
          type: "listener.started",
          listenerEntryKey: listener.targetEntryKey,
          payload: envelope,
          executionId: listenerExecutionId,
          traceId: envelope.traceId,
          threadId,
          timestamp: Date.now(),
        });

        try {
          await this.handleEvent({
            type: listener.targetEntryKey as RuntimeEvent["type"],
            payload: envelope.payload,
            threadId,
            traceId: envelope.traceId,
          });
          await this.persistence.events.append({
            type: "listener.completed",
            listenerEntryKey: listener.targetEntryKey,
            payload: envelope,
            executionId: listenerExecutionId,
            traceId: envelope.traceId,
            threadId,
            timestamp: Date.now(),
          });
        } catch (error) {
          await this.persistence.events.append({
            type: "listener.failed",
            listenerEntryKey: listener.targetEntryKey,
            error: error instanceof Error ? error.message : String(error),
            payload: envelope,
            executionId: listenerExecutionId,
            traceId: envelope.traceId,
            threadId,
            timestamp: Date.now(),
          });
        }
      })();
    }
  }

  /**
   * Resolves the handler hash for an event type via entries (O(1)).
   *
   * @param eventType - The runtime event type.
   * @returns The handler hash, or null if not found.
   */
  private resolveHandlerHash(eventType: string): string | null {
    // Direct entry lookup (O(1))
    const direct = this.ir.entries[eventType];
    if (direct) return direct;

    // Route matching with prefix
    if (eventType.startsWith("route:")) {
      const routeKey = eventType.replace("route:", "");
      return this.ir.entries[routeKey] ?? null;
    }

    return null;
  }

  /**
   * Calculate starting sequence number from existing events.
   * Ensures new calls get seq = max(existing seq) + 1.
   *
   * @param log - The event log buffer.
   * @param executionId - The execution identifier.
   * @returns The starting sequence number.
   */
  private calculateStartingSeq(
    log: EventLogBuffer,
    executionId: string,
  ): number {
    const events = log.getAll(executionId);
    if (!events) return 0;

    let maxSeq = 0;
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (event && event.seq !== undefined) {
        maxSeq = Math.max(maxSeq, event.seq);
      }
    }
    return maxSeq;
  }

  /**
   * Executes a handler with Sequence Key Drift protection.
   *
   * @param handlerHash - The hash of the handler bundle.
   * @param event - The runtime event.
   * @param execCtx - The execution context.
   * @param log - The event log buffer.
   * @returns The result of the handler execution.
   * @throws SuspensionException if the handler suspends.
   */
  private async executeHandler(
    handlerHash: string,
    event: RuntimeEvent,
    execCtx: ExecutionContext,
    log: EventLogBuffer,
  ): Promise<unknown> {
    const bundle = this.ir.bundles[handlerHash];
    if (!bundle) {
      throw new Error(`Bundle not found: ${handlerHash}`);
    }

    // Sequence Key Drift protection: verify bundle type is valid
    if (
      bundle.type !== "entry" &&
      bundle.type !== "step" &&
      bundle.type !== "tool" &&
      bundle.type !== "route"
    ) {
      throw new Error(`Invalid bundle type: ${bundle.type}`);
    }

    // Create context proxies
    const ctx = this.buildContext(log, execCtx, handlerHash);

    // Create and execute the handler function
    const fn = new Function(`
      ${bundle.code}
      return __handler.default;
    `)();

    try {
      const result = await fn(ctx, event.payload);
      return result;
    } catch (err) {
      if (err instanceof SuspensionException) {
        // Persist suspension state
        await this.persistence.events.append({
          type: "execution.suspended",
          nodeId: event.type,
          resumeAt: err.resumeAt,
          executionId: execCtx.executionId,
          traceId: execCtx.traceId,
          threadId: execCtx.threadId,
          timestamp: Date.now(),
        });

        return {
          suspended: true,
          until: err.resumeAt,
          wakeReason: err.wakeReason,
        };
      }
      throw err;
    }
  }

  /**
   * Builds the KalpContext with intercepted proxies.
   *
   * Uses the context-builder to create a full KalpContext with all primitives.
   *
   * @param log - The event log buffer for cache lookup.
   * @param execCtx - The execution context for event identity.
   * @param handlerHash - The hash of the handler bundle.
   * @returns A KalpContext matching the SDK interface.
   */
  private buildContext(
    log: EventLogBuffer,
    execCtx: ExecutionContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _handlerHash: string,
  ): KalpContext {
    // Persist event helper
    const persistEvent = async (event: IntentEvent): Promise<void> => {
      log.append(event);
      await this.persistence.events.append(event);
    };

    let runtimeContext: KalpContext | null = null;

    const executeBundle = async (
      targetHandlerHash: string,
      input: unknown,
    ): Promise<unknown> => {
      const bundle = this.ir.bundles[targetHandlerHash];

      if (!bundle) {
        throw new Error(`Bundle not found: ${targetHandlerHash}`);
      }

      const fn = new Function(`
        ${bundle.code}
        return __handler.default;
      `)();

      return fn(input, runtimeContext);
    };

    // Resolve system prompt (support both static string and dynamic function)
    const systemPrompt = this.ir.metadata.systemPrompt;
    const resolvedSystemPrompt =
      typeof systemPrompt === "object" &&
      systemPrompt !== null &&
      "dynamic" in systemPrompt
        ? "" // Dynamic prompts resolved at runtime by the handler
        : (systemPrompt ?? "");

    const context = buildKalpContext(
      this.persistence.state,
      this.persistence.events,
      this.scheduler,
      log,
      executeBundle,
      persistEvent,
      this.ir,
      this.providers,
      execCtx,
      {
        name: this.ir.metadata.name,
        systemPrompt: resolvedSystemPrompt,
        metadata: {
          ...this.ir.metadata.metadata,
          label: this.ir.metadata.label,
          tags: this.ir.metadata.tags,
          emits: this.ir.metadata.emits,
          public: this.ir.metadata.public,
          routesPublic: this.ir.metadata.routesPublic,
          listeners: this.ir.metadata.listeners,
        },
      },
      undefined,
      {
        sourceAgentId: this.ir.metadata.name,
        onEmitDispatch: (envelope) =>
          this.dispatchListenersFromEmit(envelope, execCtx.threadId),
      },
    );

    runtimeContext = context;
    return context;
  }
}
