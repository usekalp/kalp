import type { BundleNodeBinding, KalpContext } from "@kalphq/sdk";
import type { RuntimeBundleLoader } from "./handler-executor";

const bundleModuleCache = new Map<string, Promise<(payload: unknown, ctx: KalpContext) => unknown>>();

export async function loadHandlerModule(
  binding: BundleNodeBinding,
  nodeId: string,
  bundleLoader: RuntimeBundleLoader,
): Promise<(payload: unknown, ctx: KalpContext) => unknown> {
  const cacheKey = `${binding.sha256}:${nodeId}`;
  if (!bundleModuleCache.has(cacheKey)) {
    bundleModuleCache.set(
      cacheKey,
      (async () => {
        const code = await bundleLoader(binding, nodeId);
        const dataUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`;
        const mod = await import(dataUrl) as { default?: (payload: unknown, ctx: KalpContext) => unknown };
        if (typeof mod.default !== "function") {
          throw new Error(`Bundle ${binding.bundle} for node ${nodeId} does not export a default handler.`);
        }
        return mod.default;
      })(),
    );
  }

  return bundleModuleCache.get(cacheKey)!;
}
