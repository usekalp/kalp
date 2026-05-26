import type { EffectMap } from "@kalphq/core";

export type VaultProviders = {
  vault?: Record<string, string>;
};

export function resolveVaultGet(
  payload: Record<string, unknown>,
  providers: VaultProviders,
): EffectMap["vault.get"]["result"] {
  const key = payload.key as string;
  return (providers.vault?.[key] ?? null) as EffectMap["vault.get"]["result"];
}