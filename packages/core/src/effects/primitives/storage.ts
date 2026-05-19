import type {
  StoragePrimitive,
  StorageTransaction,
  StoragePutOptions,
  TransactionOptions,
} from "@kalphq/sdk";
import type { EffectInterceptor } from "./types";
import type { StorageOperation } from "./shared";

/**
 * Create the storage primitive for persistent key-value operations and transactions.
 * Provides get, put, delete, increment, list, batch, and transactional access to the agent's
 * persistent key-value store.
 *
 * @param interceptEffect - Effect interceptor for routing storage operations through the effect pipeline.
 */
export function createStorageContext(
  interceptEffect: EffectInterceptor,
): StoragePrimitive {
  return {
    get: <T = unknown>(key: string) =>
      interceptEffect("storage.get", { key }) as Promise<T | null>,

    put: (key: string, value: unknown, options?: StoragePutOptions) =>
      interceptEffect("storage.put", { key, value, options }),

    delete: (key: string) => interceptEffect("storage.delete", { key }),

    increment: (key: string, amount?: number) =>
      interceptEffect("storage.increment", { key, amount }) as Promise<number>,

    transaction: async <T>(
      fn: (tx: StorageTransaction) => Promise<T>,
      _options?: TransactionOptions,
    ): Promise<T> => {
      const operations: StorageOperation[] = [];

      const tx: StorageTransaction = {
        get: async <U = unknown>(k: string): Promise<U | null> => {
          const value = await interceptEffect("storage.get", { key: k });
          return (value ?? null) as U | null;
        },

        put: (k: string, v: unknown) => {
          operations.push({ op: "put", key: k, value: v });
        },

        delete: (k: string) => {
          operations.push({ op: "delete", key: k });
        },

        keys: () => operations.map((op) => op.key),
      };

      const result = await fn(tx);

      if (operations.length > 0) {
        await interceptEffect("storage.batch", { operations });
      }

      return result as T;
    },
  };
}
