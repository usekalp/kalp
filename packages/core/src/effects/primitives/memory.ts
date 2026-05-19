import type {
  KalpMemory,
  MemoryListParams,
  MemoryListResult,
  KalpHistoryMessage,
} from "@kalphq/sdk";
import type { EffectInterceptor } from "./types";

/**
 * Create the memory primitive for conversation history management.
 * Provides append, list, and summarize operations against the agent's memory store.
 *
 * @param interceptEffect - Effect interceptor for routing memory operations through the effect pipeline.
 */
export function createMemoryContext(interceptEffect: EffectInterceptor): KalpMemory {
  return {
    append: (message: Omit<KalpHistoryMessage, "timestamp">) =>
      interceptEffect("memory.append", {
        content: message.content,
        role: message.role,
      }),
    list: async (params?: MemoryListParams): Promise<MemoryListResult> => {
      const result = await interceptEffect("memory.list", {
        limit: params?.limit,
        cursor: params?.cursor,
        order: params?.order,
      });
      return {
        items: (result.items ?? []) as KalpHistoryMessage[],
        nextCursor: result.nextCursor,
      };
    },
    summarize: () =>
      interceptEffect("memory.summarize", {}),
  };
}
