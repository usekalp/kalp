import type { EffectInterceptor, SyncInterceptor } from "./types";

export function createActionsContext(
  interceptEffect: EffectInterceptor,
  interceptSync: SyncInterceptor,
): any {
  return {
    run: (node: any, ...args: any[]) =>
      interceptEffect("action.run", {
        target: `${node.kind}s.${node.id}`,
        input: args[0],
      }),
    wait: (duration: string | number) =>
      interceptEffect("action.wait", { duration }),
    waitUntil: (ts: number, wakeReason?: string) =>
      interceptEffect("action.waitUntil", { until: ts, wakeReason }) as any,
    emit: (event: string, data: unknown, options?: any) =>
      interceptEffect("action.emit", { event, data, options }),
    ask: (prompt: string, schema?: any, options?: any) =>
      interceptEffect("action.ask", { prompt, schema, options }),
    requestApproval: (reason: string, options?: any) =>
      interceptEffect("action.approval", { reason, options }),
    callAgent: (contract: any, input: unknown) =>
      interceptEffect("action.call", { contract: contract.agentId, input }),
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
    waitForEvent: (_name: string, timeout?: string | number) =>
      interceptEffect("action.wait", { duration: timeout ?? 0 }) as any,
  };
}
