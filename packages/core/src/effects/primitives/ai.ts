import type { KalpAI } from "@kalphq/sdk";
import type { EffectInterceptor } from "./types";

export function createAIContext(interceptEffect: EffectInterceptor): KalpAI {
  return {
    generate: (params: any) => interceptEffect("ai.generate", params),
    stream: async function* (params: any) {
      // Stream is a delivery mechanism, but we persist it as a single effect
      // to ensure determinism and avoid log inflation. Replay yields synthetically.
      const result = await interceptEffect("ai.stream", params);
      
      // Yield the final result synthetically
      // Note: KalpAI stream type might need adjusting in SDK if it yields structured chunks
      // For now, we simulate yielding a single chunk with the final text
      yield { text: result } as any; 
    },
    classify: (params: any) => interceptEffect("ai.classify", params),
  } as unknown as KalpAI;
}
