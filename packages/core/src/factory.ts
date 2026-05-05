/**
 * Engine factory — the ONLY way to create a reactor instance.
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
import { OrchestrationReactor } from "@/engine/reactor";
import type { HandlerModule } from "@/engine/types";
import type { PersistenceAdapter, SchedulerAdapter } from "@/adapters/interfaces";
import type { RuntimeProviders } from "@/engine/context-builder";

/**
 * Configuration for creating a new reactor instance.
 *
 * All fields are required. Platform wiring files are responsible for
 * creating the adapter instances and passing them here.
 */
export interface ReactorConfig {
  /** The compiled IR graph for the agent. */
  ir: IRGraph;
  /** Map from moduleRef to bundled handler module. */
  bundles: Map<string, HandlerModule>;
  /** Composite persistence adapter (state, events, idempotency, threads). */
  persistence: PersistenceAdapter;
  /** Scheduler adapter for deferred wake-ups. */
  scheduler: SchedulerAdapter;
  /** External providers for ai, auth, memory, vault. */
  providers: RuntimeProviders;
}

/**
 * Creates a new {@link OrchestrationReactor} instance.
 *
 * This is the standard entrypoint for all platform adapters.
 * The factory performs no validation — callers are responsible for
 * ensuring the config is complete and correct.
 *
 * @param config - The reactor configuration.
 * @returns A fully initialized reactor ready to handle events.
 *
 * @example
 * ```ts
 * import { createReactor } from "@kalphq/core/factory";
 *
 * const reactor = createReactor({
 *   ir, bundles, persistence, scheduler, providers,
 * });
 * await reactor.handleEvent(event);
 * ```
 */
export function createReactor(config: ReactorConfig): OrchestrationReactor {
  return new OrchestrationReactor(
    config.ir,
    config.bundles,
    config.persistence,
    config.scheduler,
    config.providers,
  );
}
