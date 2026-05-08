/**
 * Storage primitive — intercepted key-value state with event emission.
 *
 * Every read/write is logged to the execution log. The actual storage
 * is delegated to the {@link StateStore}.
 *
 * @module
 */

import type { StoragePrimitive } from "@kalphq/sdk";
import type { StateStore, EventStore } from "@/adapters/interfaces";
import type { ExecutionContext } from "@/engine/types";

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
  eventStore: EventStore,
  execCtx?: ExecutionContext,
): StoragePrimitive {
  const ids = {
    executionId: execCtx?.executionId ?? "",
    traceId: execCtx?.traceId ?? "",
    threadId: execCtx?.threadId ?? "",
  };

  return {
    async get<T = unknown>(key: string): Promise<T | null> {
      const value = (await stateStore.get(key)) as T | null;
      await eventStore.append({
        type: "state.read",
        key,
        value,
        executionId: ids.executionId,
        traceId: ids.traceId,
        threadId: ids.threadId,
        timestamp: Date.now(),
      });
      return value;
    },

    async put(key: string, value: unknown): Promise<void> {
      await stateStore.set(key, value);
      await eventStore.append({
        type: "state.write",
        key,
        value,
        executionId: ids.executionId,
        traceId: ids.traceId,
        threadId: ids.threadId,
        timestamp: Date.now(),
      });
    },

    async delete(key: string): Promise<void> {
      await stateStore.delete(key);
      await eventStore.append({
        type: "state.write",
        key,
        value: undefined,
        executionId: ids.executionId,
        traceId: ids.traceId,
        threadId: ids.threadId,
        timestamp: Date.now(),
      });
    },

    async increment(key: string, amount: number = 1): Promise<number> {
      const newValue = await stateStore.increment(key, amount);
      await eventStore.append({
        type: "state.write",
        key,
        value: newValue,
        executionId: ids.executionId,
        traceId: ids.traceId,
        threadId: ids.threadId,
        timestamp: Date.now(),
      });
      return newValue;
    },

    async transaction<T>(
      callback: (tx: any) => Promise<T>,
      _options?: any,
    ): Promise<T> {
      // Basic transaction wrapping (without full interceptor for tx context yet)
      return stateStore.transaction(async (tx) => {
        return callback(tx as any);
      });
    },
  };
}
