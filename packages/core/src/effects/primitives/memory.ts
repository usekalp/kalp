import type { KalpMemory, MemoryListParams, KalpHistoryMessage } from "@kalphq/sdk";
import type { EffectInterceptor } from "./types";

export function createMemoryContext(interceptEffect: EffectInterceptor): KalpMemory {
  return {
    append: (message: Omit<KalpHistoryMessage, "timestamp">) =>
      interceptEffect("memory.append", message as any) as any,
    list: (params?: MemoryListParams) =>
      interceptEffect("memory.list", params as any) as any,
    summarize: () =>
      interceptEffect("memory.summarize", undefined as any) as any,
  };
}
