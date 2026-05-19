import type { KalpMcp } from "@kalphq/sdk";
import type { EffectInterceptor } from "./types";

interface McpServerProxy {
  [toolName: string]: (input: unknown) => Promise<unknown>;
}

/**
 * Create the MCP primitive for calling tools on external MCP servers.
 * Returns a proxy object where each server name resolves to a proxy of tool names,
 * enabling a natural `mcp.serverName.toolName(args)` calling convention.
 *
 * @param interceptEffect - Effect interceptor for routing MCP tool calls through the effect pipeline.
 */
export function createMcpContext(interceptEffect: EffectInterceptor): KalpMcp {
  return new Proxy({} as Record<string, McpServerProxy>, {
    get(_target, serverName: string) {
      return new Proxy({} as McpServerProxy, {
        get(_serverTarget, toolName: string) {
          return (input: unknown) =>
            interceptEffect("mcp.call", { server: serverName, tool: toolName, args: input });
        },
      });
    },
  }) as KalpMcp;
}
