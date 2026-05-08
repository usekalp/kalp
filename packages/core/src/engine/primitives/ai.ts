/**
 * AI primitive — intercepted LLM calls with event emission.
 *
 * Every generate/stream/classify call is logged to the execution log.
 * The actual LLM provider call is delegated to the injected implementation.
 *
 * @module
 */

import type { KalpAI } from "@kalphq/sdk";
import type { EventStore } from "@/adapters/interfaces";
import type { ExecutionContext } from "@/engine/types";

/**
 * A concrete AI provider implementation that performs the actual LLM calls.
 * This is injected by the host adapter (e.g. Cloudflare AI, OpenAI fetch, etc.).
 */
export type AIProvider = KalpAI;

/**
 * Creates an intercepted AI primitive that wraps every call with event emission.
 *
 * The returned object matches the SDK's {@link KalpAI} interface exactly.
 * Internally, each method:
 * 1. Emits a `primitive.invoked` event before calling the provider.
 * 2. Calls the actual provider implementation.
 * 3. Emits a `primitive.invoked` event with the result.
 *
 * @param provider - The concrete AI provider implementation.
 * @param log - The execution log for event emission.
 * @param execCtx - Optional execution context for event identity.
 * @returns An intercepted {@link KalpAI} matching the SDK interface.
 */
export function createAIPrimitive(
  provider: AIProvider,
  eventStore: EventStore,
  execCtx?: ExecutionContext,
): KalpAI {
  const ids = {
    executionId: execCtx?.executionId ?? "",
    traceId: execCtx?.traceId ?? "",
    threadId: execCtx?.threadId ?? "",
  };

  return {
    async generate(params) {
      const result = await provider.generate(params);
      await eventStore.append({
        type: "primitive.invoked",
        name: "ai.generate",
        params: { model: params.model, prompt: params.prompt },
        result,
        executionId: ids.executionId,
        traceId: ids.traceId,
        threadId: ids.threadId,
        timestamp: Date.now(),
      });
      return result;
    },

    stream(params) {
      // Stream is special — we log the invocation but return the iterable.
      // Individual chunks are NOT logged (too noisy). The caller consumes them.
      void eventStore.append({
        type: "primitive.invoked",
        name: "ai.stream",
        params: { model: params.model, prompt: params.prompt },
        result: "[stream]",
        executionId: ids.executionId,
        traceId: ids.traceId,
        threadId: ids.threadId,
        timestamp: Date.now(),
      });
      return provider.stream(params);
    },

    async classify(params) {
      const result = await provider.classify(params);
      await eventStore.append({
        type: "primitive.invoked",
        name: "ai.classify",
        params: { input: params.input, labels: params.labels },
        result,
        executionId: ids.executionId,
        traceId: ids.traceId,
        threadId: ids.threadId,
        timestamp: Date.now(),
      });
      return result;
    },
  };
}
