/**
 * Platform wiring — creates CF-specific adapters and delegates to core factory.
 *
 * This is NOT a factory. It is the Cloudflare-specific composition step that:
 * 1. Creates DurableObjectPersistence + DurableObjectScheduler from DO storage
 * 2. Calls createRuntime() from @kalphq/core/factory
 *
 * The runtime instance is fully owned by the DO lifecycle shell.
 * This file must NEVER contain engine logic, retry logic, or scheduling hacks.
 *
 * @module
 */

import { createRuntime } from "@kalphq/core/factory";
import type { KalpRuntime } from "@kalphq/core";
import type { RuntimeProviders } from "@kalphq/core";
import type { IRGraph } from "@kalphq/sdk";
import {
  DurableObjectPersistence,
  DurableObjectScheduler,
} from "./adapters/durable-object";

/**
 * Wires Cloudflare-specific adapters to the core runtime factory.
 *
 * Creates DO-backed persistence and scheduler adapters from the provided
 * storage instance, then delegates to the core factory for runtime creation.
 *
 * @param storage - The Durable Object's `DurableObjectStorage` instance.
 * @param ir - The compiled IR graph for the agent.
 * @param providers - External providers (ai, auth, memory, vault).
 * @returns A fully initialized KalpRuntime.
 */
export function wireRuntime(
  storage: DurableObjectStorage,
  ir: IRGraph,
  providers: RuntimeProviders,
): KalpRuntime {
  const persistence = new DurableObjectPersistence(storage);
  persistence.ensureReady();
  const scheduler = new DurableObjectScheduler(storage);
  return createRuntime({ ir, persistence, scheduler, providers });
}
