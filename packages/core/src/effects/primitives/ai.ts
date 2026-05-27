import { z, type KalpAI, type ModelTier } from "@kalphq/sdk";
import type { EffectInterceptor } from "./types";

export function createAIContext(interceptEffect: EffectInterceptor): KalpAI {
  return {
    generate: <T extends z.ZodTypeAny | undefined = undefined>(
      params: {
        tier?: ModelTier;
        prompt: string;
        system?: string;
        schema?: T;
        temperature?: number;
        maxTokens?: number;
      },
    ) =>
      interceptEffect("ai.generate", {
        tier: params.tier ?? "low",
        prompt: params.prompt,
        system: params.system,
        schema: params.schema,
      }) as Promise<T extends z.ZodTypeAny ? z.infer<T> : string>,

    stream: (
      params: {
        tier?: ModelTier;
        prompt: string;
        system?: string;
        temperature?: number;
        maxTokens?: number;
      },
    ): AsyncIterable<string> => {
      let done = false;
      return {
        [Symbol.asyncIterator]: () => ({
          next: async () => {
            if (done) return { done: true as const, value: undefined as never };
            done = true;
            const result = await interceptEffect("ai.stream", {
              tier: params.tier ?? "low",
              prompt: params.prompt,
              system: params.system,
            });
            const value = typeof result === "string" ? result : JSON.stringify(result);
            return { done: false as const, value };
          },
        }),
      };
    },

    classify: <T extends string>(
      params: {
        input: string;
        labels: readonly T[];
        tier?: ModelTier;
        confidenceThreshold?: number;
      },
    ) =>
      interceptEffect("ai.classify", {
        tier: params.tier ?? "low",
        input: params.input,
        classes: [...params.labels],
        confidenceThreshold: params.confidenceThreshold,
      }) as Promise<T>,
  } as KalpAI;
}
