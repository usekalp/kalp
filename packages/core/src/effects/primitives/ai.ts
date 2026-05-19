import { z, type KalpAI, type AIParams, type KalpModelId } from "@kalphq/sdk";
import type { EffectInterceptor } from "./types";

/**
 * Create the AI primitive providing generate, stream, and classify capabilities.
 * Each method delegates to the effect system for resolution and replay.
 *
 * @param interceptEffect - Effect interceptor for routing AI operations through the effect pipeline.
 */
export function createAIContext(interceptEffect: EffectInterceptor): KalpAI {
  return {
    generate: <T extends z.ZodTypeAny | undefined = undefined>(
      params: AIParams & { schema?: T },
    ) =>
      interceptEffect("ai.generate", {
        prompt: params.prompt,
        schema: params.schema,
        system: params.system,
      }) as Promise<T extends z.ZodTypeAny ? z.infer<T> : string>,

    stream: <T extends z.ZodTypeAny | undefined = undefined>(
      params: AIParams & { schema?: T },
    ): T extends z.ZodTypeAny
      ? AsyncIterable<Partial<z.infer<T>>>
      : AsyncIterable<string> => {
      let done = false;
      return {
        [Symbol.asyncIterator]: () => ({
          next: async () => {
            if (done) return { done: true as const, value: undefined as never };
            done = true;
            const result = await interceptEffect("ai.stream", {
              prompt: params.prompt,
              schema: params.schema,
              system: params.system,
            });
            const value = (typeof result === "string" ? result : JSON.stringify(result)) as string;
            return { done: false as const, value };
          },
        }),
      } as T extends z.ZodTypeAny ? AsyncIterable<Partial<z.infer<T>>> : AsyncIterable<string>;
    },

    classify: <T extends string>(params: {
      input: string;
      labels: readonly T[];
      model?: KalpModelId;
      confidenceThreshold?: number;
    }) =>
      interceptEffect("ai.classify", {
        prompt: params.input,
        classes: [...params.labels],
        model: params.model,
        confidenceThreshold: params.confidenceThreshold,
      }) as Promise<T>,
  } as KalpAI;
}
