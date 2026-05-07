/**
 * Model Context Protocol (MCP) primitive.
 *
 * Provides access to MCP servers configured in the project.
 *
 * @module
 */

import type { ExecutionLog } from "@/engine/execution-log";
import type { KalpMcp } from "@kalphq/sdk";
import type { ExecutionContext } from "@/engine/types";

/**
 * Creates an MCP primitive that emits events to the execution log.
 *
 * @param log - The execution log for event emission.
 * @param execCtx - Optional execution context for event identity.
 * @returns A {@link KalpMcp} instance.
 */
export function createMcpPrimitive(
  log: ExecutionLog,
  execCtx?: ExecutionContext,
): KalpMcp {
  const ids = {
    executionId: execCtx?.executionId ?? "",
    traceId: execCtx?.traceId ?? "",
    threadId: execCtx?.threadId ?? "",
  };

  // Return a Proxy that dynamically handles MCP server calls
  return new Proxy({} as KalpMcp, {
    get(_target, serverName: string) {
      // Return a Proxy for the server's tools
      return new Proxy(
        {},
        {
          get(_target, toolName: string) {
            // Return the tool function
            return async (input: unknown): Promise<unknown> => {
              const timestamp = Date.now();
              void log.emit({
                type: "primitive.invoked",
                name: "mcp." + serverName + "." + toolName,
                params: input,
                result: undefined,
                ...ids,
                timestamp,
              });

              // TODO: Implement actual MCP server connection
              // For now, return a stub response
              return { error: "MCP not implemented in core yet" };
            };
          },
        },
      );
    },
  });
}
