import type { AskOptions, Duration } from "@kalphq/sdk";
import type { ListenerRef } from "./shared";
import type { EffectInterceptor, SyncInterceptor } from "./types";

/**
 * Local action callbacks provided by the runtime for invoking and dispatching
 * events within the same process, bypassing the external effect system.
 */
export interface LocalActions {
  call: (
    listener: ListenerRef,
    payload: unknown,
    options?: unknown,
  ) => Promise<unknown>;
  dispatch: (
    listener: ListenerRef,
    payload: unknown,
    options?: unknown,
  ) => Promise<{ eventId: string }>;
}

/**
 * Create the actions primitive providing run, sleep, schedule, dispatch, fetch, approval,
 * and agent-calling capabilities. Central controller for agent workflow actions.
 *
 * @param interceptEffect - Async effect interceptor for routing action operations through the effect pipeline.
 * @param interceptSync - Synchronous effect interceptor for routing synchronous action operations.
 * @param localActions - Optional local action handlers for in-process call and dispatch.
 */
export function createActionsContext(
  interceptEffect: EffectInterceptor,
  interceptSync: SyncInterceptor,
  localActions?: LocalActions,
) {
  return {
    run: (node: { kind: string; id: string }, ...args: unknown[]) =>
      interceptEffect("action.run", {
        target: `${node.kind}s.${node.id}`,
        input: args[0],
      }),

    sleep: (duration: Duration) =>
      interceptEffect("action.sleep", { duration }),

    waitUntil: (when: Date | number, _options?: { signal?: AbortSignal }) => {
      const ms = when instanceof Date ? when.getTime() : when;
      return interceptEffect("action.waitUntil", {
        until: ms,
      });
    },

    call: (listener: ListenerRef, data: unknown, options?: unknown) => {
      if (!localActions?.call) {
        throw new Error("Local call is not available in this runtime context.");
      }
      return localActions.call(listener, data, options);
    },

    dispatch: (listener: ListenerRef, data: unknown, options?: unknown) => {
      if (!localActions?.dispatch) {
        throw new Error(
          "Local dispatch is not available in this runtime context.",
        );
      }
      return localActions.dispatch(listener, data, options);
    },

    ask: (prompt: string, options?: AskOptions<unknown>) =>
      interceptEffect("action.ask", {
        prompt,
        schema: options?.schema,
        options: options
          ? { timeout: options.timeout, signal: options.signal, defaultValue: options.defaultValue, metadata: options.metadata }
          : undefined,
      }),

    requestApproval: async (
      reason: string,
      options?: { timeout?: Duration; signal?: AbortSignal },
    ) => {
      const result = await interceptEffect("action.approval", {
        reason,
        options,
      });
      return Boolean(
        result && typeof result === "object" && "approved" in result
          ? (result as { approved: boolean }).approved
          : result,
      );
    },

    callAgent: (contract: { name: string }, input: unknown) =>
      interceptEffect("action.call", { contract: contract.name, input }),

    fetch: (url: string | URL | Request, init?: RequestInit) =>
      interceptEffect("fetch", {
        url:
          typeof url === "string"
            ? url
            : url instanceof URL
              ? url.href
              : (url as Request).url,
        method: init?.method ?? "GET",
        body: init?.body,
      }) as unknown as Promise<Response>,

    loop: (_body: unknown) =>
      Promise.resolve(
        interceptSync("action.loop", { body: "fn" }, () => {}),
      ),

    schedule: (
      _node: unknown,
      when: Date | number | string,
      ..._args: unknown[]
    ) => {
      const at = when instanceof Date ? when.getTime() : when;
      return interceptEffect("action.schedule", {
        at,
        data: _args[0],
      }) as Promise<{ id: string }>;
    },
  };
}
