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

import type { IRGraph, KalpContext, KalpHistoryMessage } from "@kalphq/sdk";
import type { RuntimeEvent, EventDispatchEnvelope } from "@/engine/types";
import type { PersistenceAdapter } from "@/adapters/interfaces";
import { ReplayLog } from "../state/replay-log";
import { SuspensionException } from "@/engine/suspension";
import { createProxyContext } from "../effects/context";
import type { EffectResolver } from "../effects/types";
import { createRootFrame, type ExecutionContext, type ExecutionFrame } from "../execution/frame";
import { isDispatchEnvelope, resolveHandlerHash, calculateStartingSeq } from "./runtime-utils";

/**
 * The Kalp Proxy-Listener Runtime.
 *
 * This is the core engine responsible for executing agent handlers in a durable
 * and deterministic manner. It uses a "Proxy-Listener" architecture where:
 * 1. SDK primitives are injected via proxies.
 * 2. Side effects are intercepted and recorded as "events".
 * 3. Execution can be suspended and resumed from the exact same point by replaying the log.
 *
 * @module
 */
export class KalpRuntime {
  /**
   * Initializes the Kalp runtime with an IR graph and host adapters.
   * 
   * @param ir - The Intermediate Representation (IR) graph containing agent logic and bundles.
   * @param persistence - Host adapters for state, events, and scheduling.
   * @param resolver - The effect resolver that executes external side effects (AI, storage, etc.).
   */
  constructor(
    private readonly ir: IRGraph,
    private readonly persistence: PersistenceAdapter,
    private readonly resolver: EffectResolver,
  ) {
    // Ensure IR version compatibility
    if (Number(ir.version) !== 2) {
      throw new Error(
        `IR incompatible (received v${String(ir.version)}). Please recompile the agent with the current SDK/Compiler.`,
      );
    }
  }

  /**
   * Processes an incoming event by triggering the appropriate handler.
   * 
   * This method handles both initial triggers and resume-from-suspension events.
   * It performs the following steps:
   * 1. Resolves execution and trace identifiers.
   * 2. Hydrates the Replay Log from the persistent store.
   * 3. Locates the correct handler bundle in the IR graph.
   * 4. Initializes a new execution frame and counter.
   * 5. Starts deterministic execution.
   *
   * @param event - The incoming event (hook, route, listener, or resume).
   * @returns The handler's result or suspension details.
   */
  async handleEvent(event: RuntimeEvent): Promise<unknown> {
    const { threadId, payload } = event;

    // 1. Resolve Execution & Trace Context
    // On 'resume', we must use the original executionId to re-link to the correct log.
    const executionId = (event.type === "resume" && payload && typeof payload === "object")
      ? (payload as { executionId: string }).executionId
      : crypto.randomUUID();

    // Preserve the traceId for causality tracking (e.g., cross-agent event fan-out).
    const traceId = event.traceId ?? 
      (isDispatchEnvelope(payload) ? payload.traceId : crypto.randomUUID());

    // 2. Initialize Replay Engine
    // The ReplayLog acts as a local cache of already-executed effects.
    const log = new ReplayLog();
    await log.loadFromSQLite(this.persistence.events, { threadId, traceId });

    // 3. Resolve Handler
    const handlerHash = resolveHandlerHash(event.type, this.ir);
    if (!handlerHash) {
      throw new Error(`No handler found for event type: ${event.type}`);
    }

    // 4. Bootstrap Execution Frame
    const execCtx: ExecutionContext = {
      traceId,
      threadId: threadId ?? "system",
      untrackedIOCount: 0,
      untrackedIOByType: { network: 0, timer: 0, fs: 0, unknown: 0 },
      hasUntrustedPlugins: false,
    };
    
    const startingSeq = calculateStartingSeq(log, executionId);
    const frame = createRootFrame(execCtx, executionId, startingSeq);

    // 5. Execute Handler
    return this.executeHandler(handlerHash, event, frame, log);
  }

  /**
   * Internal method to dispatch listeners triggered by an 'emit' action.
   * This implements the cross-agent event sourcing logic.
   * 
   * @param envelope - The event metadata and payload.
   * @param threadId - The target thread ID for the listeners.
   */
  private async dispatchListenersFromEmit(
    envelope: EventDispatchEnvelope,
    threadId: string,
  ): Promise<void> {
    // Find all listener nodes in the IR graph that match the event name
    const listeners = Object.entries(this.ir.nodes || {})
      .filter(([_, node]) => {
        if (node.kind !== "listener" || !node.source) return false;
        if (node.source.event !== envelope.eventName) return false;
        if (!envelope.sourceAgentId) return true;
        return node.source.agentId === envelope.sourceAgentId;
      })
      .map(([key]) => ({ targetEntryKey: key }));

    for (const listener of listeners) {
      // 1. Record the queueing of the listener
      await this.persistence.events.append({
        type: "listener.queued",
        listenerEntryKey: listener.targetEntryKey,
        payload: envelope,
        executionId: envelope.parentExecutionId,
        traceId: envelope.traceId,
        threadId,
        timestamp: Date.now(),
      });

      // 2. Start asynchronous execution (fire-and-forget for the current emitter)
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
   * Orchestrates the actual JavaScript execution of a handler.
   * 
   * It wraps the bundled code into a dynamic function, injects the Proxy context,
   * and handles potential suspensions or failures.
   * 
   * @param handlerHash - The hash of the code bundle to execute.
   * @param event - The event that triggered the execution.
   * @param frame - The current execution frame.
   * @param log - The replay log buffer.
   */
  private async executeHandler(
    handlerHash: string,
    event: RuntimeEvent,
    frame: ExecutionFrame,
    log: ReplayLog,
  ): Promise<unknown> {
    const bundle = this.ir.bundles[handlerHash];
    if (!bundle) {
      throw new Error(`Execution failed: Bundle ${handlerHash} not found in IR.`);
    }

    // 1. Rehydrate conversation history if available
    const historyEntries = await this.loadHistory(frame.ctx.threadId);

    // 2. Build the context with proxies
    const ctx = this.buildContext(log, frame, historyEntries);

    // 3. Compile and execute the handler
    // We use 'new Function' to isolate the handler code and return its default export.
    const fn = new Function(`
      ${bundle.code}
      return __handler.default;
    `)();

    // 4. Handle calling convention differences
    // Lifecycle hooks usually don't receive the payload as the first argument.
    const isContextOnly =
      event.type === "onInit" ||
      event.type === "onTick" ||
      event.type.startsWith("schedule:");

    try {
      return isContextOnly
        ? await fn(ctx)
        : await fn(event.payload, ctx);
    } catch (err) {
      // 5. Handle Suspension (Durable Execution)
      if (err instanceof SuspensionException) {
        await this.persistence.events.append({
          type: "execution.suspended",
          nodeId: event.type,
          resumeAt: err.resumeAt,
          executionId: frame.executionId,
          traceId: frame.ctx.traceId,
          threadId: frame.ctx.threadId,
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
   * Loads the conversation history from the event store.
   * Filters for completed nodes to build the semantic history of the thread.
   */
  private async loadHistory(threadId: string): Promise<KalpHistoryMessage[]> {
    if (!threadId) return [];

    try {
      const rawEvents = await this.persistence.events.loadByThread(threadId);
      return rawEvents
        .filter((e) => e.type === "node.completed" || e.type === "action.run.completed")
        .map((e) => ({
          role: "assistant" as const,
          content: JSON.stringify({
            type: e.type,
            result: (e as { result?: unknown }).result,
          }),
          timestamp: e.timestamp,
        }));
    } catch {
      return [];
    }
  }

  /**
   * Constructs the Proxy Context for the handler.
   * Delegates to createProxyContext while injecting host-specific metadata.
   */
  private buildContext(
    log: ReplayLog,
    frame: ExecutionFrame,
    history: KalpHistoryMessage[],
  ): KalpContext {
    const systemPrompt = this.ir.agent?.systemPrompt;
    
    // Resolve static system prompt (dynamic ones are handled inside the AI primitive)
    const resolvedSystemPrompt = (typeof systemPrompt === "object" && systemPrompt !== null && "dynamic" in systemPrompt)
      ? ""
      : (systemPrompt ?? "");

    return createProxyContext(
      this.resolver,
      log,
      frame,
      async (effect) => {
        // 1. Persist the effect
        await this.persistence.events.append(effect);

        // 2. Handle cross-agent emissions (fan-out)
        if (effect.type === "action.emit") {
          const { event: emitEvent, data, options } = effect.payload;
          const envelope: EventDispatchEnvelope = {
            eventName: emitEvent,
            payload: data,
            traceId: effect.traceId,
            parentExecutionId: effect.executionId,
            sourceAgentId: options?.sourceAgentId ?? this.ir.agent?.name ?? "unknown",
          };
          await this.dispatchListenersFromEmit(envelope, effect.threadId);
        }
      },
      {
        agentId: this.ir.agent?.name ?? frame.ctx.threadId ?? "unknown",
        runId: frame.executionId,
        name: this.ir.agent?.name ?? "unknown",
        systemPrompt: resolvedSystemPrompt,
        metadata: {
          label: this.ir.agent?.label,
          tags: this.ir.agent?.tags,
          skipAuth: this.ir.agent?.skipAuth,
        },
      },
      history
    );
  }
}

