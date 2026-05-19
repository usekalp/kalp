import type { BundleManifest, BundleNodeBinding } from "@kalphq/sdk";

/**
 * Resolves a bundle node binding from the manifest by node ID and target.
 *
 * @param nodeId - The node identifier to look up.
 * @param bundleManifest - The bundle manifest containing target bindings.
 * @param target - The target platform name (defaults to "default").
 * @returns The matching bundle node binding, or null if not found.
 */
export function resolveBundleBinding(
  nodeId: string,
  bundleManifest: BundleManifest,
  target = "default",
): BundleNodeBinding | null {
  return bundleManifest.targets[target]?.nodes[nodeId] ?? null;
}
