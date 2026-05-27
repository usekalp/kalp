import type { KalpCache } from "@kalphq/sdk";
import type { EffectInterceptor } from "./types";

/**
 * Create the cache primitive for ephemeral key-value operations.
 *
 * All operations go through the effect pipeline for deterministic replay.
 *
 * @param interceptEffect - Effect interceptor for routing cache operations.
 */
export function createCacheContext(
  interceptEffect: EffectInterceptor,
): KalpCache {
  return {
    get: <T = unknown>(key: string) =>
      interceptEffect("cache.get", { key }) as Promise<T | null>,

    set: (key: string, value: unknown) =>
      interceptEffect("cache.set", { key, value }),

    delete: (key: string) =>
      interceptEffect("cache.delete", { key }),
  };
}