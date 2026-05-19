import type { KalpVault, SecretKey, RegisteredSecrets } from "@kalphq/sdk";
import type { EffectInterceptor } from "./types";

/**
 * Create the vault primitive for retrieving secrets by key.
 * Provides a single `get` method that fetches the secret value from the agent's secure vault.
 *
 * @param interceptEffect - Effect interceptor for routing vault operations through the effect pipeline.
 */
export function createVaultContext(interceptEffect: EffectInterceptor): KalpVault {
  return {
    get: (key: SecretKey<RegisteredSecrets>) => interceptEffect("vault.get", { key }),
  };
}
