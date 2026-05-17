/**
 * Platform wiring — creates CF-specific adapters and delegates to core factory.
 *
 * This is NOT a factory. It is the Cloudflare-specific composition step that:
 * 1. Creates DurableObjectPersistence from DO storage
 * 2. Creates an EffectResolver for AI and external effects
 * 3. Calls createRuntime() from @kalphq/core/factory
 *
 * The runtime instance is fully owned by the DO lifecycle shell.
 * This file must NEVER contain engine logic, retry logic, or scheduling hacks.
 *
 * @module
 */

import { createRuntime } from "@kalphq/core/factory";
import type { KalpRuntime, EffectResolver } from "@kalphq/core";
import type {
  BundleManifest,
  BundleNodeBinding,
  IRGraph,
  SchemaRegistry,
} from "@kalphq/sdk";
import { DurableObjectPersistence } from "./adapters/durable-object";
import { CloudflareEffectResolver } from "./adapters/effect-resolver";

export interface CloudflareProviders {
  ai?: {
    baseUrl?: string;
    apiKey?: string;
    defaultModel?: string;
  };
  vault?: Record<string, string>;
}

/**
 * Wires Cloudflare-specific adapters to the core runtime factory.
 *
 * Creates DO-backed persistence and resolver from the provided
 * storage instance, then delegates to the core factory for runtime creation.
 *
 * @param storage - The Durable Object's `DurableObjectStorage` instance.
 * @param ir - The compiled IR graph for the agent.
 * @param providers - External providers (ai, vault).
 * @returns A fully initialized KalpRuntime.
 */
export function wireRuntime(
  storage: DurableObjectStorage,
  ir: IRGraph,
  schemas: SchemaRegistry,
  bundleManifest: BundleManifest,
  bundleLoader: (binding: BundleNodeBinding, nodeId: string) => Promise<string>,
  providers?: CloudflareProviders,
): KalpRuntime {
  const persistence = new DurableObjectPersistence(storage);
  persistence.ensureReady();

  const resolver: EffectResolver = new CloudflareEffectResolver(providers);

  return createRuntime({
    ir,
    schemas,
    bundleManifest,
    bundleLoader,
    persistence,
    resolver,
  });
}
