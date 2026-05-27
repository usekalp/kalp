import type { PersistenceAdapter, EffectMap } from "@kalphq/core";

export async function resolveCacheGet(
  payload: Record<string, unknown>,
  persistence: PersistenceAdapter | undefined,
): Promise<EffectMap["cache.get"]["result"]> {
  if (!persistence) return null as EffectMap["cache.get"]["result"];
  return (await persistence.state.get(payload.key as string)) as EffectMap["cache.get"]["result"];
}

export async function resolveCacheSet(
  payload: Record<string, unknown>,
  persistence: PersistenceAdapter | undefined,
): Promise<EffectMap["cache.set"]["result"]> {
  if (!persistence) return undefined as EffectMap["cache.set"]["result"];
  const { key, value } = payload as { key: string; value: unknown };
  await persistence.state.set(key, value);
  return undefined as EffectMap["cache.set"]["result"];
}

export async function resolveCacheDelete(
  payload: Record<string, unknown>,
  persistence: PersistenceAdapter | undefined,
): Promise<EffectMap["cache.delete"]["result"]> {
  if (!persistence) return undefined as EffectMap["cache.delete"]["result"];
  await persistence.state.delete(payload.key as string);
  return undefined as EffectMap["cache.delete"]["result"];
}