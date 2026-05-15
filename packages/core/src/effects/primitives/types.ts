import type { EffectType, EffectMap } from "../types";

export type EffectInterceptor = <T extends EffectType>(
  type: T,
  payload: EffectMap[T]["payload"],
) => Promise<EffectMap[T]["result"]>;

export type SyncInterceptor = <T>(
  type: string,
  payload: unknown,
  compute: () => T,
) => T;
