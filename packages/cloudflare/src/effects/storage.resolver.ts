import type { PersistenceAdapter, EffectMap } from "@kalphq/core";

export async function resolveStorageGet(
  payload: Record<string, unknown>,
  persistence: PersistenceAdapter | undefined,
): Promise<EffectMap["storage.get"]["result"]> {
  if (!persistence) return null as EffectMap["storage.get"]["result"];
  return (await persistence.state.get(payload.key as string)) as EffectMap["storage.get"]["result"];
}

export async function resolveStoragePut(
  payload: Record<string, unknown>,
  persistence: PersistenceAdapter | undefined,
): Promise<EffectMap["storage.put"]["result"]> {
  if (!persistence) return undefined as EffectMap["storage.put"]["result"];
  const { key, value } = payload as { key: string; value: unknown };
  await persistence.state.set(key, value);
  return undefined as EffectMap["storage.put"]["result"];
}

export async function resolveStorageDelete(
  payload: Record<string, unknown>,
  persistence: PersistenceAdapter | undefined,
): Promise<EffectMap["storage.delete"]["result"]> {
  if (!persistence) return undefined as EffectMap["storage.delete"]["result"];
  await persistence.state.delete(payload.key as string);
  return undefined as EffectMap["storage.delete"]["result"];
}

export async function resolveStorageIncrement(
  payload: Record<string, unknown>,
  persistence: PersistenceAdapter | undefined,
): Promise<EffectMap["storage.increment"]["result"]> {
  if (!persistence) return (payload.amount as number ?? 1) as EffectMap["storage.increment"]["result"];
  const { key, amount } = payload as { key: string; amount?: number };
  return (await persistence.state.increment(key, amount ?? 1)) as EffectMap["storage.increment"]["result"];
}

export async function resolveStorageList(
  payload: Record<string, unknown>,
  persistence: PersistenceAdapter | undefined,
): Promise<EffectMap["storage.list"]["result"]> {
  if (!persistence) return [] as EffectMap["storage.list"]["result"];
  return (await persistence.state.list(payload.prefix as string | undefined)) as EffectMap["storage.list"]["result"];
}

export async function resolveStorageBatch(
  payload: Record<string, unknown>,
  persistence: PersistenceAdapter | undefined,
): Promise<EffectMap["storage.batch"]["result"]> {
  if (!persistence) return undefined as EffectMap["storage.batch"]["result"];
  const operations = payload.operations as Array<
    | { op: "put"; key: string; value: unknown }
    | { op: "delete"; key: string }
    | { op: "increment"; key: string; amount: number }
    | { op: "cas"; key: string; expected: unknown; next: unknown }
  >;
  await persistence.state.batch(operations);
  return undefined as EffectMap["storage.batch"]["result"];
}