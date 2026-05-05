/**
 * Platform wiring — creates CF-specific adapters and delegates to core factory.
 *
 * This is NOT a factory. It is the Cloudflare-specific composition step that:
 * 1. Creates DurableObjectPersistence + DurableObjectScheduler from DO storage
 * 2. Calls createReactor() from @kalphq/core/factory
 *
 * The reactor instance is fully owned by the DO lifecycle shell.
 * This file must NEVER contain engine logic, retry logic, or scheduling hacks.
 *
 * @module
 */

import { createReactor } from "@kalphq/core/factory";
import type { RuntimeProviders, HandlerModule } from "@kalphq/core";
import type { IRGraph } from "@kalphq/sdk";
import {
  DurableObjectPersistence,
  DurableObjectScheduler,
} from "./adapters/durable-object";

/**
 * Wires Cloudflare-specific adapters to the core reactor factory.
 *
 * Creates DO-backed persistence and scheduler adapters from the provided
 * storage instance, then delegates to the core factory for reactor creation.
 *
 * @param storage - The Durable Object's `DurableObjectStorage` instance.
 * @param ir - The compiled IR graph for the agent.
 * @param bundles - Map of moduleRef to handler modules.
 * @param providers - External providers (ai, auth, memory, vault).
 * @returns A fully initialized OrchestrationReactor.
 */
export function wireReactor(
  storage: DurableObjectStorage,
  ir: IRGraph,
  bundles: Map<string, HandlerModule>,
  providers: RuntimeProviders,
) {
  const persistence = new DurableObjectPersistence(storage);
  persistence.ensureReady();
  const scheduler = new DurableObjectScheduler(storage);
  return createReactor({ ir, bundles, persistence, scheduler, providers });
}
