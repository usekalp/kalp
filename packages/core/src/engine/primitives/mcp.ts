/**
 * MCP (Model Context Protocol) primitive for the Proxy-Listener Runtime.
 *
 * Provides access to MCP servers configured in the project.
 *
 * @module
 */

import type { KalpMcp } from "@kalphq/sdk";
import type { EventStore } from "@/adapters/interfaces";
import type { ExecutionContext } from "@/engine/types";

/**
 * Creates an MCP primitive that emits events to EventStore.
 *
 * @param eventStore - The event store for event emission.
 * @param execCtx - Optional execution context for event identity.
 * @returns A {@link KalpMcp} instance.
 */
export function createMcpPrimitive(
  eventStore: EventStore,
  execCtx?: ExecutionContext,
): KalpMcp {
  const ids = {
    executionId: execCtx?.executionId ?? "",
    traceId: execCtx?.traceId ?? "",
    threadId: execCtx?.threadId ?? "",
  };

  return new Proxy({} as KalpMcp, {
    /**
     * Proxy getter for accessing MCP servers.
     *
     * @param _target - The target object (unused).
     * @param serverName - The name of the MCP server.
     * @returns A proxy for the server's tools.
     */
    get(_target, serverName: string) {
      return new Proxy(
        {},
        {
          /**
           * Proxy getter for accessing MCP tools within a server.
           *
           * @param _target - The target object (unused).
           * @param toolName - The name of the MCP tool.
           * @returns The tool function that executes the MCP call.
           */
          get(_target, toolName: string) {
            return async (input: unknown): Promise<unknown> => {
              /**
               * Executes an MCP tool call.
               *
               * Emits an event to the EventStore and throws an error indicating
               * that MCP integration requires platform-specific implementation.
               *
               * @param input - The input parameters for the tool.
               * @returns A promise that resolves with the tool result.
               * @throws Error indicating MCP server not configured.
               */
              const timestamp = Date.now();
              void eventStore.append({
                type: "primitive.invoked",
                name: "mcp." + serverName + "." + toolName,
                params: input,
                result: undefined,
                executionId: ids.executionId,
                traceId: ids.traceId,
                threadId: ids.threadId,
                timestamp,
              });

              throw new Error(
                `MCP server '${serverName}' tool '${toolName}' not configured. MCP integration requires platform-specific implementation.`,
              );
            };
          },
        },
      );
    },
  });
}
