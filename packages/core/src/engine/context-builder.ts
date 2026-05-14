/**
 * Handler context builder for the Kalp Proxy-Listener Runtime.
 *
 * Assembles the {@link KalpContext} that is passed to every handler function.
 * The context shape matches the SDK's `KalpContext` interface exactly.
 *
 * @module
 */

import type {
  KalpContext,
  KalpAuth,
  KalpMemory,
  KalpVault,
  IRGraph,
} from "@kalphq/sdk";
import type {
  StateStore,
  EventStore,
  SchedulerAdapter,
  CrossThreadAdapter,
} from "@/adapters/interfaces";
import type { AIProvider } from "@/engine/primitives/ai";
import type { EventDispatchEnvelope, ExecutionContext } from "@/engine/types";
import type { EventLogBuffer } from "@/engine/event-log-buffer";
import type { BundleExecutor, EventPersister } from "@/engine/proxy-factory";
import { createAIPrimitive } from "@/engine/primitives/ai";
import { createStoragePrimitive } from "@/engine/primitives/storage";
import { createDatePrimitive } from "@/engine/primitives/date";
import { createMathPrimitive } from "@/engine/primitives/math";
import { createMcpPrimitive } from "@/engine/primitives/mcp";
import { createActionProxy } from "@/engine/proxy-factory";

// ────────────────────────────────────────────────────────────────────────────
// External providers injected by the host adapter
// ────────────────────────────────────────────────────────────────────────────

/**
 * External provider implementations injected by the host adapter.
 * These are NOT part of the reactor core — they come from infrastructure.
 */
export interface RuntimeProviders {
  /** AI provider implementation (e.g. OpenAI, Anthropic, Cloudflare AI). */
  ai: AIProvider;
  /** Authentication context for the current request. */
  auth?: KalpAuth;
  /** Memory (conversation history) provider. */
  memory: KalpMemory;
  /** Secrets vault provider. */
  vault: KalpVault;
}

// ────────────────────────────────────────────────────────────────────────────
// Context builder
// ────────────────────────────────────────────────────────────────────────────

/**
 * Builds a {@link KalpContext} with intercepted primitives.
 *
 * @param stateStore - The state sub-store for KV operations.
 * @param eventStore - The event store for event emission.
 * @param scheduler - The scheduler adapter for deferred execution.
 * @param log - The event log buffer for cache lookup.
 * @param executeBundle - Callback to execute a handler bundle.
 * @param persistEvent - Callback to persist events to the store.
 * @param ir - The IR manifest for resolving handler hashes.
 * @param providers - External providers (ai, auth, memory, vault).
 * @param execCtx - Optional execution context for event identity.
 * @param agentConfig - Optional agent configuration for metadata.
 * @returns A complete {@link KalpContext} matching the SDK interface.
 */
export function buildKalpContext(
  stateStore: StateStore,
  eventStore: EventStore,
  scheduler: SchedulerAdapter,
  log: EventLogBuffer,
  executeBundle: BundleExecutor,
  persistEvent: EventPersister,
  ir: IRGraph,
  providers: RuntimeProviders,
  execCtx: ExecutionContext,
  agentConfig?: {
    name: string;
    systemPrompt: string;
    metadata?: Record<string, unknown>;
  },
  crossThread?: CrossThreadAdapter,
  emitDispatch?: {
    sourceAgentId?: string;
    onEmitDispatch?: (envelope: EventDispatchEnvelope) => Promise<void> | void;
  },
): KalpContext {
  const ids = {
    executionId: execCtx.executionId,
    traceId: execCtx.traceId,
    threadId: execCtx.threadId,
  };

  return {
    ai: createAIPrimitive(providers.ai, eventStore, execCtx),
    storage: createStoragePrimitive(stateStore, eventStore, execCtx),
    actions: createActionProxy(
      log,
      scheduler,
      execCtx,
      executeBundle,
      persistEvent,
      ir,
      crossThread,
      emitDispatch,
    ),
    auth: providers.auth,
    memory: providers.memory,
    vault: providers.vault,
    mcp: createMcpPrimitive(eventStore, execCtx),
    agent: {
      agentId: agentConfig?.name ?? execCtx.threadId ?? "unknown",
      runId: execCtx.executionId,
      name: agentConfig?.name ?? "unknown",
      systemPrompt: agentConfig?.systemPrompt ?? "",
      metadata: agentConfig?.metadata,
    },
    date: createDatePrimitive(eventStore, execCtx),
    math: createMathPrimitive(eventStore, execCtx),
    log: {
      debug: (msg: string, data?: Record<string, unknown>) =>
        void eventStore.append({
          type: "log",
          level: "debug",
          msg,
          data,
          executionId: ids.executionId,
          traceId: ids.traceId,
          threadId: ids.threadId,
          timestamp: Date.now(),
        }),
      info: (msg: string, data?: Record<string, unknown>) =>
        void eventStore.append({
          type: "log",
          level: "info",
          msg,
          data,
          executionId: ids.executionId,
          traceId: ids.traceId,
          threadId: ids.threadId,
          timestamp: Date.now(),
        }),
      warn: (msg: string, data?: Record<string, unknown>) =>
        void eventStore.append({
          type: "log",
          level: "warn",
          msg,
          data,
          executionId: ids.executionId,
          traceId: ids.traceId,
          threadId: ids.threadId,
          timestamp: Date.now(),
        }),
      error: (err: unknown, data?: Record<string, unknown>) => {
        const msg = err instanceof Error ? err.message : String(err);
        const errorData =
          err instanceof Error ? { ...data, stack: err.stack } : data;
        void eventStore.append({
          type: "log",
          level: "error",
          msg,
          data: errorData,
          executionId: ids.executionId,
          traceId: ids.traceId,
          threadId: ids.threadId,
          timestamp: Date.now(),
        });
      },
    },
    history: [],
    state: {},
  } as unknown as KalpContext;
}
