import type { EffectType, EffectMap } from "../types";

/**
 * Intercepts an async effect by type and payload, returning the resolved result.
 * Used by primitives to delegate operations to the effect resolution pipeline.
 */
export type EffectInterceptor = <T extends EffectType>(
  type: T,
  payload: EffectMap[T]["payload"],
) => Promise<EffectMap[T]["result"]>;

/**
 * Intercepts a synchronous side-effect, computing and returning a value immediately
 * without awaiting external resolution. Used for logging, math, and other sync operations.
 */
export type SyncInterceptor = <T>(
  type: string,
  payload: unknown,
  compute: () => T,
) => T;
