import type { PersistenceAdapter, EffectResolver, Effect, EffectType, EffectMap } from "@kalphq/core";
import type { CloudflareAIConfig, McpServerRuntimeConfig } from "@kalphq/sdk";
import { resolveAiGenerate, resolveAiStream, resolveAiClassify, type AiTransportConfig } from "./ai.transport";
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

export type { AiTransportConfig, VaultProviders };

export type CloudflareProviders = {
  ai?: CloudflareAIConfig;
  mcp?: Record<string, McpServerRuntimeConfig>;
  vault?: Record<string, string>;
  cloudflareApiToken?: string;
  cloudflareAccountId?: string;
};

export class CloudflareEffectResolver implements EffectResolver {
  private mcpRegistry: McpRegistry;
  private aiTransport: AiTransportConfig;
  private providers: CloudflareProviders;

  constructor(
    providers: CloudflareProviders = {},
    private persistence?: PersistenceAdapter,
  ) {
    this.providers = providers;
    this.mcpRegistry = new McpRegistry({ mcp: providers.mcp });
    this.aiTransport = {
      modelTiers: providers.ai?.models,
      cloudflareAccountId: providers.cloudflareAccountId,
      cloudflareApiToken: providers.cloudflareApiToken,
      cloudflareGatewayId: providers.ai?.gatewayId,
    };
  }

  async resolve<T extends EffectType>(
    effect: Effect<T>,
  ): Promise<EffectMap[T]["result"]> {
    const p = effect.payload as Record<string, unknown>;
    switch (effect.type) {
      case "ai.generate":
        return resolveAiGenerate(p, this.aiTransport) as Promise<EffectMap[T]["result"]>;
      case "ai.stream":
        return resolveAiStream(p, this.aiTransport) as Promise<EffectMap[T]["result"]>;
      case "ai.classify":
        return resolveAiClassify(p, this.aiTransport) as Promise<EffectMap[T]["result"]>;
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