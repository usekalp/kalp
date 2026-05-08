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

import type { IRGraph, HandlerContext } from "@kalphq/sdk";
import type {
  PersistenceAdapter,
  SchedulerAdapter,
} from "@/adapters/interfaces";
import type { RuntimeEvent, ExecutionContext } from "@/engine/types";
import type { IntentEvent } from "@/engine/event-log-buffer";
import { EventLogBuffer } from "@/engine/event-log-buffer";
import { SuspensionException } from "@/engine/suspension";
import {
  buildHandlerContext,
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
  constructor(
    private ir: IRGraph,
    private persistence: PersistenceAdapter,
    private scheduler: SchedulerAdapter,
    private providers: RuntimeProviders,
  ) {}

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

    // CORRECTION 1: Preserve executionId on resume to load correct EventLog
    const executionId =
      event.type === "resume" && payload && typeof payload === "object"
        ? (payload as { executionId: string }).executionId
        : crypto.randomUUID();

    // Generate traceId for this handleEvent call
    const traceId = crypto.randomUUID();

    // Load event log from SQLite into memory
    const log = new EventLogBuffer();
    await log.loadFromSQLite(this.persistence.events, { threadId, traceId });

    // Find entry handler hash
    const handlerHash = this.ir.entries[event.type];
    if (!handlerHash) {
      throw new Error(`No handler for event: ${event.type}`);
    }

    // Build execution context with sequence counter starting at 0
    const execCtx: ExecutionContext = {
      executionId,
      traceId,
      threadId: threadId ?? "",
      untrackedIOCount: 0,
      untrackedIOByType: { network: 0, timer: 0, fs: 0, unknown: 0 },
      hasUntrustedPlugins: false,
      seqCounter: 0,
    };

    // Create context proxies
    const ctx = this.buildContext(log, execCtx);

    // Execute handler from line 1
    try {
      const bundle = this.ir.bundles[handlerHash];
      if (!bundle) {
        throw new Error(`Bundle not found: ${handlerHash}`);
      }

      // Create and execute the handler function
      const fn = new Function(`
        ${bundle.code}
        return __handler.default;
      `)();

      const result = await fn(ctx, event.payload);

      return result;
    } catch (err) {
      if (err instanceof SuspensionException) {
        // Normal suspension - DO will be re-invoked by alarm
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
   * Builds the HandlerContext with intercepted proxies.
   *
   * Uses the context-builder to create a full HandlerContext with all primitives.
   *
   * @param log - The event log buffer for cache lookup.
   * @param execCtx - The execution context for event identity.
   * @returns A HandlerContext matching the SDK interface.
   */
  private buildContext(
    log: EventLogBuffer,
    execCtx: ExecutionContext,
  ): HandlerContext {
    // Persist event helper
    const persistEvent = async (event: IntentEvent): Promise<void> => {
      log.append(event);
      await this.persistence.events.append(event);
    };

    // Bundle executor
    const executeBundle = async (
      handlerHash: string,
      input: unknown,
    ): Promise<unknown> => {
      const bundle = this.ir.bundles[handlerHash];
      if (!bundle) {
        throw new Error(`Bundle not found: ${handlerHash}`);
      }
      const fn = new Function(`
        ${bundle.code}
        return __handler.default;
      `)();
      return fn(input);
    };

    return buildHandlerContext(
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
        systemPrompt:
          typeof this.ir.metadata.systemPrompt === "string"
            ? this.ir.metadata.systemPrompt
            : "",
        metadata: this.ir.metadata.metadata,
      },
    );
  }
}
