/**
 * Proxy factory for the Kalp Proxy-Listener Runtime.
 *
 * Creates intercepted proxies that emit intents with synchronous sequence
 * assignment. Each proxy method checks the EventLogBuffer for cached results
 * before executing, enabling deterministic replay.
 *
 * @module
 */

import type {
  KalpActions,
  ExecutableNode,
  InputOf,
  OutputOf,
  WakeReason,
  AskOptions,
  EmitOptions,
  AgentContract,
} from "@kalphq/sdk";
import { z } from "@kalphq/sdk";
import type { EventLogBuffer, IntentEvent } from "@/engine/event-log-buffer";
import type {
  SchedulerAdapter,
  CrossThreadAdapter,
} from "@/adapters/interfaces";
import type { ExecutionContext } from "@/engine/types";
import { SuspensionException } from "@/engine/suspension";
import { serializeError } from "@/engine/event-log-buffer";
import type { IRGraph } from "@kalphq/sdk";

/** Callback to execute a bundled handler by hash. */
export type BundleExecutor = (
  handlerHash: string,
  input: unknown,
) => Promise<unknown>;

/** Callback to persist an event to the EventStore. */
export type EventPersister = (event: IntentEvent) => Promise<void>;

/**
 * Creates the intercepted actions proxy.
 *
 * All methods assign sequence numbers synchronously at call time (before any
 * await), ensuring deterministic parallel execution with Promise.all.
 *
 * @param log - The event log buffer for cache lookup.
 * @param scheduler - The scheduler adapter for deferred execution.
 * @param execCtx - The execution context for event identity.
 * @param executeBundle - Callback to execute a handler bundle.
 * @param persistEvent - Callback to persist events to the store.
 * @param ir - The IR manifest for resolving handler hashes.
 * @param crossThread - Optional adapter for cross-thread agent calls.
 * @returns A KalpActions proxy with intercepted methods.
 */
export function createActionProxy(
  log: EventLogBuffer,
  scheduler: SchedulerAdapter,
  execCtx: ExecutionContext,
  executeBundle: BundleExecutor,
  persistEvent: EventPersister,
  ir: IRGraph,
  crossThread?: CrossThreadAdapter,
): KalpActions {
  return {
    async run<T extends ExecutableNode>(
      node: T,
      ...args: InputOf<T> extends never ? [] : [input: InputOf<T>]
    ): Promise<OutputOf<T>> {
      // SYNCHRONOUS: assign sequence number NOW (before any await)
      const seq = ++execCtx.seqCounter;

      // Check cache AND error - re-throw deterministically
      const cached = log.get(execCtx.executionId, seq);
      if (cached) {
        if (cached.error) {
          const error = new Error(cached.error.message);
          error.name = cached.error.name;
          if (cached.error.stack) error.stack = cached.error.stack;
          throw error;
        }
        if (cached.result !== undefined) {
          return cached.result as OutputOf<T>;
        }
      }

      // Resolve handler hash from node
      const nodeId = `${node.kind}s.${node.id}`;
      const handlerHash = ir.entries[nodeId];
      if (!handlerHash) {
        throw new Error(`Handler not found for node: ${nodeId}`);
      }

      // Not cached: execute real handler
      try {
        const input = args[0];
        const result = await executeBundle(handlerHash, input);

        // Persist intent + result
        await persistEvent({
          seq,
          type: "intent.run_step",
          executionId: execCtx.executionId,
          traceId: execCtx.traceId,
          threadId: execCtx.threadId,
          timestamp: Date.now(),
          payload: { nodeId, input },
          result,
        });

        return result as OutputOf<T>;
      } catch (error) {
        // Cache error for deterministic re-throw on replay
        await persistEvent({
          seq,
          type: "intent.run_step",
          executionId: execCtx.executionId,
          traceId: execCtx.traceId,
          threadId: execCtx.threadId,
          timestamp: Date.now(),
          payload: { nodeId, input: args[0] },
          error: serializeError(error),
        });
        throw error;
      }
    },

    async wait(duration: string | number): Promise<WakeReason> {
      const ms = parseDuration(duration);
      return this.waitUntil(Date.now() + ms);
    },

    async waitUntil(timestamp: number | string | Date): Promise<WakeReason> {
      // SYNCHRONOUS: assign sequence number NOW
      const seq = ++execCtx.seqCounter;

      const resumeAt =
        typeof timestamp === "number"
          ? timestamp
          : new Date(timestamp).getTime();

      // Check cache first
      const cached = log.get(execCtx.executionId, seq);
      if (cached?.result) {
        return cached.result as WakeReason;
      }

      // First time: schedule alarm + suspend
      await persistEvent({
        seq,
        type: "intent.suspend",
        executionId: execCtx.executionId,
        traceId: execCtx.traceId,
        threadId: execCtx.threadId,
        timestamp: Date.now(),
        payload: { until: resumeAt, wakeReason: "timer" },
      });

      await scheduler.scheduleAlarm(resumeAt, {
        executionId: execCtx.executionId,
        traceId: execCtx.traceId,
        wakeReason: "timer",
      });

      throw new SuspensionException(
        resumeAt,
        "timer",
        { until: resumeAt },
        seq,
      );
    },

    loop(body: () => Promise<void>): void {
      // SYNCHRONOUS: assign sequence number NOW
      const loopStartSeq = ++execCtx.seqCounter;
      const loopId = `loop_${loopStartSeq}_${Date.now()}`;

      // Fire-and-forget - the loop runs asynchronously
      void (async () => {
        await persistEvent({
          seq: loopStartSeq,
          type: "intent.loop_start",
          executionId: execCtx.executionId,
          traceId: execCtx.traceId,
          threadId: execCtx.threadId,
          timestamp: Date.now(),
          payload: { loopId },
        });

        let iteration = 0;
        while (true) {
          // Each iteration gets its own sequence number
          const iterSeq = ++execCtx.seqCounter;

          await persistEvent({
            seq: iterSeq,
            type: "intent.loop_iteration",
            executionId: execCtx.executionId,
            traceId: execCtx.traceId,
            threadId: execCtx.threadId,
            timestamp: Date.now(),
            payload: { loopId, iteration },
          });

          try {
            await body();
          } catch (err) {
            const errorSeq = ++execCtx.seqCounter;
            await persistEvent({
              seq: errorSeq,
              type: "intent.loop_end",
              executionId: execCtx.executionId,
              traceId: execCtx.traceId,
              threadId: execCtx.threadId,
              timestamp: Date.now(),
              payload: {
                loopId,
                reason: err instanceof Error ? err.message : "error",
              },
            });
            break;
          }

          iteration++;
        }
      })();
    },

    async fetch(
      input: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> {
      // SYNCHRONOUS: assign sequence number NOW
      const seq = ++execCtx.seqCounter;

      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const method =
        init?.method ?? (input instanceof Request ? input.method : "GET");

      // Capture body if present
      const requestBody = init?.body ? String(init.body) : undefined;

      // Check cache
      const cached = log.get(execCtx.executionId, seq);
      if (cached?.result) {
        // Reconstruct Response from cached data
        const cachedData = cached.result as {
          body: string;
          status: number;
          headers: Record<string, string>;
        };
        return new Response(cachedData.body, {
          status: cachedData.status,
          headers: cachedData.headers,
        });
      }

      // Execute fetch
      const start = Date.now();
      const response = await globalThis.fetch(input, init);
      const durationMs = Date.now() - start;

      // Read body for caching
      const body = await response.text();

      // Persist with serializable result
      await persistEvent({
        seq,
        type: "intent.fetch",
        executionId: execCtx.executionId,
        traceId: execCtx.traceId,
        threadId: execCtx.threadId,
        timestamp: Date.now(),
        payload: { url, method, body: requestBody },
        result: {
          body,
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          durationMs,
        },
      });

      // Return new Response (body can only be read once)
      return new Response(body, {
        status: response.status,
        headers: response.headers,
      });
    },

    async ask<T extends z.ZodTypeAny>(
      prompt: string,
      schema: T,
      options?: AskOptions,
    ): Promise<z.infer<T>> {
      // SYNCHRONOUS: assign sequence number NOW
      const seq = ++execCtx.seqCounter;

      // Check if human already responded (injected by webhook)
      const cached = log.get(execCtx.executionId, seq);
      if (cached?.result) {
        return cached.result as z.infer<T>;
      }
      if (cached?.error) {
        const error = new Error(cached.error.message);
        error.name = cached.error.name;
        throw error;
      }

      // First time: emit ask, schedule timeout, suspend
      await persistEvent({
        seq,
        type: "intent.ask",
        executionId: execCtx.executionId,
        traceId: execCtx.traceId,
        threadId: execCtx.threadId,
        timestamp: Date.now(),
        payload: { prompt, schema, options },
        status: "waiting",
      });

      // Schedule timeout alarm if provided
      const timeout = options?.timeout
        ? parseDuration(options.timeout)
        : 7 * 24 * 60 * 60 * 1000; // 7 days default
      const resumeAt = Date.now() + timeout;

      await scheduler.scheduleAlarm(resumeAt, {
        executionId: execCtx.executionId,
        traceId: execCtx.traceId,
        wakeReason: "ask_timeout",
      });

      throw new SuspensionException(resumeAt, "ask", { prompt, seq }, seq);
    },

    async requestApproval(
      reason: string,
      options?: AskOptions,
    ): Promise<boolean> {
      return this.ask(reason, z.boolean(), options);
    },

    emit(eventName: string, payload: unknown, options?: EmitOptions): void {
      // SYNCHRONOUS: assign sequence number NOW
      const seq = ++execCtx.seqCounter;

      // Fire-and-forget emit
      void persistEvent({
        seq,
        type: "intent.emit",
        executionId: execCtx.executionId,
        traceId: execCtx.traceId,
        threadId: execCtx.threadId,
        timestamp: Date.now(),
        payload: { eventName, payload, options },
      });
    },

    async callAgent<TInput extends z.ZodTypeAny, TOutput extends z.ZodTypeAny>(
      contract: AgentContract<TInput, TOutput>,
      input: z.infer<TInput>,
    ): Promise<z.infer<TOutput>> {
      // SYNCHRONOUS: assign sequence number NOW
      const seq = ++execCtx.seqCounter;

      // Check cache
      const cached = log.get(execCtx.executionId, seq);
      if (cached?.result) {
        return cached.result as z.infer<TOutput>;
      }

      if (!crossThread) {
        throw new Error("CrossThreadAdapter not configured - cannot callAgent");
      }

      // Validate input if contract has input schema
      if (contract.inputSchema) {
        const validation = contract.inputSchema.safeParse(input);
        if (!validation.success) {
          throw new Error(
            `Contract input validation failed: ${validation.error.message}`,
          );
        }
      }

      // Execute cross-agent call via adapter
      const result = await crossThread.callAgent<
        z.infer<TInput>,
        z.infer<TOutput>
      >(
        contract.agentId,
        {
          name: contract.agentId,
          input: contract.inputSchema,
          output: contract.outputSchema,
        },
        input,
      );

      // Validate output if contract has output schema
      if (contract.outputSchema) {
        const validation = contract.outputSchema.safeParse(result);
        if (!validation.success) {
          throw new Error(
            `Contract output validation failed: ${validation.error.message}`,
          );
        }
      }

      // Persist the intent and result
      await persistEvent({
        seq,
        type: "intent.call_agent",
        executionId: execCtx.executionId,
        traceId: execCtx.traceId,
        threadId: execCtx.threadId,
        timestamp: Date.now(),
        payload: { contract: contract.agentId, input },
        result,
      });

      return result;
    },

    async waitForEvent(
      eventName: string,
      timeout?: string | number,
    ): Promise<WakeReason> {
      // SYNCHRONOUS: assign sequence number NOW
      const seq = ++execCtx.seqCounter;

      // Check cache
      const cached = log.get(execCtx.executionId, seq);
      if (cached?.result) {
        return cached.result as WakeReason;
      }

      const duration = timeout ? parseDuration(timeout) : 0;
      const resumeAt = Date.now() + duration;

      await persistEvent({
        seq,
        type: "intent.wait_for_event",
        executionId: execCtx.executionId,
        traceId: execCtx.traceId,
        threadId: execCtx.threadId,
        timestamp: Date.now(),
        payload: { eventName, timeout: duration },
        status: "waiting",
      });

      if (timeout) {
        await scheduler.scheduleAlarm(resumeAt, {
          executionId: execCtx.executionId,
          traceId: execCtx.traceId,
          wakeReason: "event_timeout",
        });
      }

      throw new SuspensionException(resumeAt, "event", { eventName, seq }, seq);
    },

    async schedule<T extends ExecutableNode>(
      node: T,
      date: Date | string | number,
      ...args: InputOf<T> extends never ? [] : [input: InputOf<T>]
    ): Promise<{ scheduleId: string }> {
      // SYNCHRONOUS: assign sequence number NOW
      const seq = ++execCtx.seqCounter;

      const targetTime =
        typeof date === "number"
          ? date
          : typeof date === "string"
            ? new Date(date).getTime()
            : date.getTime();

      const nodeId = `${node.kind}s.${node.id}`;
      const handlerHash = ir.entries[nodeId];
      if (!handlerHash) {
        throw new Error(`Handler not found for node: ${nodeId}`);
      }

      const input = args[0];
      const scheduleId = `sched_${execCtx.executionId}_${seq}`;

      await persistEvent({
        seq,
        type: "intent.schedule",
        executionId: execCtx.executionId,
        traceId: execCtx.traceId,
        threadId: execCtx.threadId,
        timestamp: Date.now(),
        payload: { scheduleId, handlerHash, input, at: targetTime },
      });

      // Schedule the alarm for future execution
      await scheduler.scheduleAlarm(targetTime, {
        executionId: scheduleId, // New execution context
        traceId: crypto.randomUUID(),
        wakeReason: "scheduled",
      });

      return { scheduleId };
    },
  };
}

/**
 * Parses a human-readable duration string to milliseconds.
 *
 * @param duration - String like "5m", "1h", "30s", or raw milliseconds.
 * @returns Duration in milliseconds.
 */
function parseDuration(duration: string | number): number {
  if (typeof duration === "number") return duration;

  const match = duration.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)$/i);
  if (!match) {
    throw new Error(
      `Invalid duration format: "${duration}". Expected e.g. "5m", "30s", "1h".`,
    );
  }

  const value = parseFloat(match[1]!);
  const unit = match[2]!.toLowerCase();

  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };

  return value * (multipliers[unit] ?? 1);
}
