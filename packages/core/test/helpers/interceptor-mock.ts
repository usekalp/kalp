import { vi } from "vitest";
import type { EffectType, EffectMap } from "../../src/effects/types";
import type { EffectInterceptor, SyncInterceptor } from "../../src/effects/primitives/types";

export function createInterceptorMock(handlers?: Partial<Record<string, (payload: unknown) => unknown>>) {
  const calls: Array<{ type: string; payload: unknown }> = [];

  const interceptEffect: EffectInterceptor = vi.fn(
    <T extends EffectType>(type: T, payload: EffectMap[T]["payload"]): Promise<EffectMap[T]["result"]> => {
      calls.push({ type, payload });
      const handler = handlers?.[type];
      if (handler) {
        return Promise.resolve(handler(payload) as EffectMap[T]["result"]);
      }
      return Promise.resolve(undefined as EffectMap[T]["result"]);
    },
  );

  const interceptSync: SyncInterceptor = vi.fn(
    <T>(type: string, _payload: unknown, compute: () => T): T => {
      calls.push({ type, payload: _payload });
      return compute();
    },
  );

  return {
    interceptEffect,
    interceptSync,
    calls,
    getCalls: () => [...calls],
    clear: () => {
      calls.length = 0;
      vi.clearAllMocks();
    },
  };
}
