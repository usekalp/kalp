import type { KalpVault } from "@kalphq/sdk";
import type { EffectInterceptor } from "./types";

export function createVaultContext(interceptEffect: EffectInterceptor): KalpVault {
  return {
    get: (key: string) => interceptEffect("vault.get", { key }) as any,
  };
}
