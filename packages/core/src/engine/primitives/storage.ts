/**
 * Storage primitive — intercepted key-value state with event emission.
 *
 * Every read/write is logged to the execution log. The actual storage
 * is delegated to the {@link StateStore}.
 *
 * @module
 */

import type { StateStore } from "@/adapters/interfaces";
import type { ExecutionLog } from "@/engine/execution-log";
import type { ExecutionContext } from "@/engine/types";

/**
 * The shape of the `storage` primitive exposed to handler context.
 * Matches the SDK's `HandlerContext.storage` interface exactly.
 */
export interface StoragePrimitive {
  get: <T = unknown>(key: string) => Promise<T | null>;
  put: (key: string, value: unknown) => Promise<void>;
  delete: (key: string) => Promise<void>;
}

/**
 * Creates an intercepted storage primitive that emits events for every operation.
 *
 * @param stateStore - The state sub-store for KV operations.
 * @param log - The execution log for event emission.
 * @param execCtx - The current execution context (identity for events).
 * @returns A {@link StoragePrimitive} matching the SDK's storage API.
 */
export function createStoragePrimitive(
  stateStore: StateStore,
  log: ExecutionLog,
  execCtx?: ExecutionContext,
): StoragePrimitive {
  const ids = {
    executionId: execCtx?.executionId ?? "",
    traceId: execCtx?.traceId ?? "",
    threadId: execCtx?.threadId ?? "",
  };

  return {
    async get<T = unknown>(key: string): Promise<T | null> {
      const value = await stateStore.get(key);
      await log.emit({
        type: "state.read",
        key,
        value,
        ...ids,
        timestamp: Date.now(),
      });
      return value as T | null;
    },

    async put(key: string, value: unknown): Promise<void> {
      await stateStore.set(key, value);
      await log.emit({
        type: "state.write",
        key,
        value,
        ...ids,
        timestamp: Date.now(),
      });
    },

    async delete(key: string): Promise<void> {
      await stateStore.delete(key);
      await log.emit({
        type: "state.write",
        key,
        value: undefined,
        ...ids,
        timestamp: Date.now(),
      });
    },
  };
}
