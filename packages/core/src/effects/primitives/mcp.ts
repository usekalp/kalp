import type { KalpMcp } from "@kalphq/sdk";
import type { EffectInterceptor } from "./types";

export function createMcpContext(interceptEffect: EffectInterceptor): KalpMcp {
  // Return a dynamic proxy so `ctx.mcp.serverName.toolName(args)` works
  return new Proxy({}, {
    get(_target, serverName: string) {
      return new Proxy({}, {
        get(_serverTarget, toolName: string) {
          return (args?: unknown) =>
            interceptEffect("mcp.call", { server: serverName, tool: toolName, args });
        }
      });
    }
  }) as KalpMcp;
}
