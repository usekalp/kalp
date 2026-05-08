/**
 * Memory primitive for the Kalp Proxy-Listener Runtime.
 *
 * Wraps the memory provider with event logging for durability.
 * This primitive manages conversation history with deterministic replay.
 *
 * @module
 */

import type {
  KalpMemory,
  KalpHistoryMessage,
  MemoryListParams,
  MemoryListResult,
} from "@kalphq/sdk";
import type { EventStore } from "@/adapters/interfaces";
import type { ExecutionContext } from "@/engine/types";

/**
 * Creates a memory primitive with event logging.
 *
 * @param memoryProvider - The underlying memory provider implementation.
 * @param eventStore - The event store for persistence.
 * @param execCtx - The execution context for event identity.
 * @returns A memory primitive matching the KalpMemory interface.
 */
export function createMemoryPrimitive(
  memoryProvider: KalpMemory,
  eventStore: EventStore,
  execCtx: ExecutionContext,
): KalpMemory {
  // Get sequence counter reference for intent events
  const getNextSeq = () => ++execCtx.seqCounter;

  const ids = {
    executionId: execCtx.executionId,
    traceId: execCtx.traceId,
    threadId: execCtx.threadId,
  };

  return {
    async list(params?: MemoryListParams): Promise<MemoryListResult> {
      const result = await memoryProvider.list(params);

      // Log memory list for observability
      void eventStore.append({
        seq: getNextSeq(),
        type: "intent.memory_list",
        executionId: ids.executionId,
        traceId: ids.traceId,
        threadId: ids.threadId,
        timestamp: Date.now(),
        payload: { params, itemCount: result.items.length },
      });

      return result;
    },

    async append(
      message: Omit<KalpHistoryMessage, "timestamp">,
    ): Promise<void> {
      // Log before write for deterministic ordering
      void eventStore.append({
        seq: getNextSeq(),
        type: "intent.memory_append",
        executionId: ids.executionId,
        traceId: ids.traceId,
        threadId: ids.threadId,
        timestamp: Date.now(),
        payload: {
          role: message.role,
          contentLength: message.content?.length ?? 0,
        },
      });

      await memoryProvider.append(message);
    },

    async summarize(): Promise<string> {
      const summary = await memoryProvider.summarize();

      void eventStore.append({
        seq: getNextSeq(),
        type: "intent.memory_summarize",
        executionId: ids.executionId,
        traceId: ids.traceId,
        threadId: ids.threadId,
        timestamp: Date.now(),
        payload: { summaryLength: summary.length },
      });

      return summary;
    },
  };
}
