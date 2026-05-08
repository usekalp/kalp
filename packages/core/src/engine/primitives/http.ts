/**
 * HTTP primitive — intercepted fetch with event emission.
 *
 * Every outbound HTTP request is logged to the execution log.
 * The actual fetch is delegated to the runtime's fetch implementation.
 *
 * @module
 */

import type { EventStore } from "@/adapters/interfaces";
import type { ExecutionContext } from "@/engine/types";

/**
 * Creates an intercepted fetch function that emits events for every call.
 *
 * @param log - The execution log for event emission.
 * @param execCtx - Optional execution context for event identity.
 * @returns A fetch function matching the standard `fetch` signature.
 */
export function createHttpPrimitive(
  eventStore: EventStore,
  execCtx?: ExecutionContext,
): (input: string | URL | Request, init?: RequestInit) => Promise<Response> {
  const ids = {
    executionId: execCtx?.executionId ?? "",
    traceId: execCtx?.traceId ?? "",
    threadId: execCtx?.threadId ?? "",
  };

  return async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const method =
      init?.method ?? (input instanceof Request ? input.method : "GET");

    const response = await globalThis.fetch(input, init);

    await eventStore.append({
      type: "primitive.invoked",
      name: "http.fetch",
      params: { url, method },
      result: { status: response.status, statusText: response.statusText },
      executionId: ids.executionId,
      traceId: ids.traceId,
      threadId: ids.threadId,
      timestamp: Date.now(),
    });

    return response;
  };
}
