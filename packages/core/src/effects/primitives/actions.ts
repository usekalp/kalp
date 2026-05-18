import type { EffectInterceptor, SyncInterceptor } from "./types";

export function createActionsContext(
  interceptEffect: EffectInterceptor,
  interceptSync: SyncInterceptor,
  localActions?: {
    call: (
      listener: any,
      payload: unknown,
      options?: unknown,
    ) => Promise<unknown>;
    dispatch: (
      listener: any,
      payload: unknown,
      options?: unknown,
    ) => Promise<{ eventId: string }>;
  },
): any {
  return {
    run: (node: any, ...args: any[]) =>
      interceptEffect("action.run", {
        target: `${node.kind}s.${node.id}`,
        input: args[0],
      }),
    sleep: (duration: {
      milliseconds?: number;
      seconds?: number;
      minutes?: number;
      hours?: number;
      days?: number;
    }) => interceptEffect("action.sleep", { duration }),
    waitUntil: (ts: number, wakeReason?: string) =>
      interceptEffect("action.waitUntil", { until: ts, wakeReason }) as any,
    call: (listener: any, data: unknown, options?: any) => {
      if (!localActions?.call) {
        throw new Error("Local call is not available in this runtime context.");
      }
      return localActions.call(listener, data, options);
    },
    dispatch: (listener: any, data: unknown, options?: any) => {
      if (!localActions?.dispatch) {
        throw new Error(
          "Local dispatch is not available in this runtime context.",
        );
      }
      return localActions.dispatch(listener, data, options);
    },
    ask: (prompt: string, schema?: any, options?: any) =>
      interceptEffect("action.ask", { prompt, schema, options }),
    requestApproval: async (reason: string, options?: any) => {
      const result = await interceptEffect("action.approval", {
        reason,
        options,
      });
      return Boolean((result as any)?.approved ?? result);
    },
    callAgent: (contract: any, input: unknown) =>
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
      }) as any,
    loop: (_body: any) =>
      void interceptSync("action.loop", { body: "fn" }, () => {}),
    schedule: (_node: any, date: Date | number | string, ...args: any[]) =>
      interceptEffect("action.schedule", { at: date as any, data: args[0] }),
  };
}
