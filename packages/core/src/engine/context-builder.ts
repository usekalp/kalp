/**
 * Handler context builder for the Kalp v2 Orchestration Reactor.
 *
 * Assembles the {@link HandlerContext} that is passed to every handler function.
 * Each primitive in the context is intercepted — all operations emit structured
 * events to the execution log.
 *
 * The context shape matches the SDK's `HandlerContext` interface exactly,
 * preserving DX:
 *
 * ```ts
 * const { fetch, loop, run, wait } = actions;
 * const { delete: deleteKey, get, put } = storage;
 * const { classify, generate, stream } = ai;
 * ```
 *
 * @module
 */

import type {
  HandlerContext,
  KalpAuth,
  KalpMemory,
  KalpVault,
} from "@kalphq/sdk";
import type { StateStore, SchedulerAdapter } from "@/adapters/interfaces";
import type { ExecutionLog } from "@/engine/execution-log";
import type { AIProvider } from "@/engine/primitives/ai";
import type { DispatchAction } from "@/engine/primitives/actions";
import { createAIPrimitive } from "@/engine/primitives/ai";
import { createStoragePrimitive } from "@/engine/primitives/storage";
import { createActionsPrimitive } from "@/engine/primitives/actions";

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
  auth: KalpAuth;
  /** Memory (conversation history) provider. */
  memory: KalpMemory;
  /** Secrets vault provider. */
  vault: KalpVault;
}

// ────────────────────────────────────────────────────────────────────────────
// Context builder
// ────────────────────────────────────────────────────────────────────────────

/**
 * Builds a {@link HandlerContext} with fully intercepted primitives.
 *
 * Every operation on the returned context (ai.generate, storage.put,
 * actions.run, etc.) is intercepted to emit structured events to the
 * execution log. The handler never touches infrastructure directly.
 *
 * @param log - The execution log for event emission.
 * @param stateStore - The state sub-store for KV operations.
 * @param scheduler - The scheduler adapter for deferred execution.
 * @param dispatch - Callback to enqueue handler tasks in the reactor.
 * @param providers - External providers (ai, auth, memory, vault).
 * @returns A complete {@link HandlerContext} matching the SDK interface.
 */
export function buildHandlerContext(
  log: ExecutionLog,
  stateStore: StateStore,
  scheduler: SchedulerAdapter,
  dispatch: DispatchAction,
  providers: RuntimeProviders,
): HandlerContext {
  return {
    ai: createAIPrimitive(providers.ai, log),
    storage: createStoragePrimitive(stateStore, log),
    actions: createActionsPrimitive(log, scheduler, dispatch),
    auth: providers.auth,
    memory: providers.memory,
    vault: providers.vault,
  };
}
