import { createRuntime } from "@kalphq/core/factory";
import type { KalpRuntime } from "@kalphq/core";
import type {
  BundleManifest,
  BundleNodeBinding,
  IRGraph,
  SchemaRegistry,
} from "@kalphq/sdk";
import { AgentPersistence } from "@/persistence";
import { CloudflareEffectResolver, type CloudflareProviders } from "@/effects";

export function wireRuntime(
  persistence: AgentPersistence,
  ir: IRGraph,
  schemas: SchemaRegistry,
  bundleManifest: BundleManifest,
  bundleLoader: (binding: BundleNodeBinding, nodeId: string) => Promise<string>,
  providers?: CloudflareProviders,
): KalpRuntime {
  persistence.ensureReady();

  const resolver = new CloudflareEffectResolver(providers, persistence);

  return createRuntime({
    ir,
    schemas,
    bundleManifest,
    bundleLoader,
    persistence,
    resolver,
  });
}