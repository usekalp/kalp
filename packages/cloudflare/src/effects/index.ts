import type { PersistenceAdapter, EffectResolver, Effect, EffectType, EffectMap } from "@kalphq/core";
import type { McpServerRuntimeConfig } from "@kalphq/sdk";
import { resolveAiGenerate, resolveAiStream, resolveAiClassify, type AiProviders } from "./ai.resolver";
import {
  resolveCacheGet,
  resolveCacheSet,
  resolveCacheDelete,
} from "./cache.resolver";
import {
  resolveMemoryAppend,
  resolveMemoryList,
  resolveMemorySummarize,
} from "./memory.resolver";
import { resolveVaultGet, type VaultProviders } from "./vault.resolver";
import { McpRegistry } from "./mcp.resolver";
import { resolveFetch } from "./fetch.resolver";

export type { AiProviders, VaultProviders };
export type McpProviders = { mcp?: Record<string, McpServerRuntimeConfig> };
export type CloudflareProviders = AiProviders & VaultProviders & McpProviders;

export class CloudflareEffectResolver implements EffectResolver {
  private mcpRegistry: McpRegistry;

  constructor(
    private providers: CloudflareProviders = {},
    private persistence?: PersistenceAdapter,
  ) {
    this.mcpRegistry = new McpRegistry({ mcp: providers.mcp });
  }

  async resolve<T extends EffectType>(
    effect: Effect<T>,
  ): Promise<EffectMap[T]["result"]> {
    const p = effect.payload as Record<string, unknown>;
    switch (effect.type) {
      case "ai.generate":
        return resolveAiGenerate(p, this.providers) as Promise<EffectMap[T]["result"]>;
      case "ai.stream":
        return resolveAiStream(p, this.providers) as Promise<EffectMap[T]["result"]>;
      case "ai.classify":
        return resolveAiClassify(p, this.providers) as Promise<EffectMap[T]["result"]>;
      case "cache.get":
        return resolveCacheGet(p, this.persistence) as Promise<EffectMap[T]["result"]>;
      case "cache.set":
        return resolveCacheSet(p, this.persistence) as Promise<EffectMap[T]["result"]>;
      case "cache.delete":
        return resolveCacheDelete(p, this.persistence) as Promise<EffectMap[T]["result"]>;
      case "memory.append":
        return resolveMemoryAppend(p, this.persistence) as Promise<EffectMap[T]["result"]>;
      case "memory.list":
        return resolveMemoryList(p, this.persistence) as Promise<EffectMap[T]["result"]>;
      case "memory.summarize":
        return resolveMemorySummarize(p, this.persistence) as Promise<EffectMap[T]["result"]>;
      case "vault.get":
        return resolveVaultGet(p, this.providers) as EffectMap[T]["result"];
      case "mcp.call":
        return this.mcpRegistry.resolve(p) as Promise<EffectMap[T]["result"]>;
      case "fetch":
        return resolveFetch(p) as Promise<EffectMap[T]["result"]>;
      default:
        throw new Error(`Unknown effect type: ${effect.type}`);
    }
  }

  async disconnectAll(): Promise<void> {
    await this.mcpRegistry.disconnectAll();
  }
}