/**
 * Runtime factory — the ONLY way to create a KalpRuntime instance.
 *
 * This file is deliberately separate from the barrel (index.ts) to prevent
 * coupling between type consumers and runtime consumers.
 *
 * Import path: `@kalphq/core/factory`
 *
 * This is NOT a composition root. It does NOT create adapters.
 * Platform packages (cloudflare, node, bun) create adapters in their own
 * wiring files and pass them here.
 *
 * @module
 */

import type { IRGraph } from "@kalphq/sdk";
import { KalpRuntime } from "@/engine/runtime";
import type {
  PersistenceAdapter,
  SchedulerAdapter,
} from "@/adapters/interfaces";
import type { RuntimeProviders } from "@/engine/context-builder";

export { KalpRuntime };

/**
 * Configuration for creating a new KalpRuntime instance.
 *
 * All fields are required. Platform wiring files are responsible for
 * creating the adapter instances and passing them here.
 */
export interface RuntimeConfig {
  /** The compiled IR manifest for the agent. */
  ir: IRGraph;
  /** Composite persistence adapter (state, events, idempotency, threads). */
  persistence: PersistenceAdapter;
  /** Scheduler adapter for deferred wake-ups. */
  scheduler: SchedulerAdapter;
  /** External providers for ai, auth, memory, vault. */
  providers: RuntimeProviders;
}

/**
 * Creates a new {@link KalpRuntime} instance.
 *
 * This is the standard entrypoint for all platform adapters.
 * The factory performs no validation — callers are responsible for
 * ensuring the config is complete and correct.
 *
 * @param config - The runtime configuration.
 * @returns A fully initialized runtime ready to handle events.
 *
 * @example
 * ```ts
 * import { createRuntime } from "@kalphq/core/factory";
 *
 * const runtime = createRuntime({
 *   ir, persistence, scheduler, providers,
 * });
 * await runtime.handleEvent(event);
 * ```
 */
export function createRuntime(config: RuntimeConfig): KalpRuntime {
  return new KalpRuntime(
    config.ir,
    config.persistence,
    config.scheduler,
    config.providers,
  );
}
