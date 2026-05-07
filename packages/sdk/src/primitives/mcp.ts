/**
 * MCP (Model Context Protocol) primitive interface.
 *
 * This interface provides type-safe access to MCP servers configured
 * in kalp.config.ts. The CLI uses Declaration Merging to replace
 * the `unknown` types with actual Zod/JSON Schema types from the
 * server definitions.
 *
 * Note: McpServerConfig is defined in @/project/types as it is part
 * of the project-level configuration in kalp.config.ts.
 *
 * @module
 */

/**
 * MCP proxy interface for calling external tools.
 * Access tools via `ctx.mcp.{serverName}.{toolName}(input)`.
 *
 * The CLI performs Declaration Merging to inject actual types
 * from the MCP server schemas defined in kalp.config.ts.
 *
 * @example
 * ```typescript
 * // With types from CLI:
 * const result = await ctx.mcp.github.createIssue({
 *   title: "Bug report",
 *   body: "Description..."
 * });
 * ```
 */
export interface KalpMcp {
  /**
   * Dynamic access to MCP servers and their tools.
   * Each server exposes its tools as methods.
   */
  [serverName: string]: {
    /**
     * Dynamic access to tools within an MCP server.
     * CLI replaces `unknown` with actual types from server schemas.
     */
    [toolName: string]: (input: unknown) => Promise<unknown>;
  };
}
