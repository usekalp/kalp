import type { EffectInterceptor } from "./types";

export function createStateContext(interceptEffect: EffectInterceptor): Record<string, unknown> {
  return {
    get: (key: string) =>
      interceptEffect("storage.get", { key: `state:${key}` }),
    set: (key: string, value: unknown) =>
      interceptEffect("storage.put", { key: `state:${key}`, value }),
    delete: (key: string) =>
      interceptEffect("storage.delete", { key: `state:${key}` }),
    compareAndSet: (key: string, expected: unknown, next: unknown) =>
      interceptEffect("storage.batch", { 
        operations: [{ op: "cas", key: `state:${key}`, expected, next }] 
      }) as any,
    increment: (key: string, amt: number) =>
      interceptEffect("storage.batch", { 
        operations: [{ op: "increment", key: `state:${key}`, amount: amt }] 
      }) as any,
  } as unknown as Record<string, unknown>;
}
