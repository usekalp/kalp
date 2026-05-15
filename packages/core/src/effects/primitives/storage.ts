import type { StoragePrimitive } from "@kalphq/sdk";
import type { EffectInterceptor } from "./types";

export function createStorageContext(interceptEffect: EffectInterceptor): StoragePrimitive {
  return {
    get: (key: string) => interceptEffect("storage.get", { key }),
    put: (key: string, value: unknown) =>
      interceptEffect("storage.put", { key, value }),
    delete: (key: string) => interceptEffect("storage.delete", { key }),
    increment: (key: string, amt: number) =>
      interceptEffect("storage.put", { key, value: amt }) as any, // Or a dedicated increment
    list: (prefix?: string) => interceptEffect("storage.list", { prefix }) as any,
    transaction: async (fn: (tx: any) => Promise<void>) => {
      // Accumulate operations in memory
      const operations: any[] = [];
      const tx = {
        put: async (key: string, value: unknown) => {
          operations.push({ op: "put", key, value });
        },
        delete: async (key: string) => {
          operations.push({ op: "delete", key });
        },
        increment: async (key: string, amount: number) => {
          operations.push({ op: "increment", key, amount });
        },
      };

      await fn(tx);

      // Emit a single deterministic batch effect
      if (operations.length > 0) {
        await interceptEffect("storage.batch", { operations });
      }
    },
  } as unknown as StoragePrimitive;
}
