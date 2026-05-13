/**
 * Registry interface for module augmentation by generated project types.
 *
 * `kalp mcp generate` writes `.kalp/mcp.types.d.ts` and augments this
 * interface with concrete server/tool signatures.
 *
 * @example
 * ```ts
 * declare module "@kalphq/sdk" {
 *   interface McpRegistry {
 *     google: {
 *       search: (input: { query: string }) => Promise<unknown>;
 *     };
 *   }
 * }
 * ```
 */
export interface McpRegistry {}

type UnknownMcpTool = (input: unknown) => Promise<unknown>;
type UnknownMcpServer = Record<string, UnknownMcpTool>;
type KnownServerKeys = Extract<keyof McpRegistry, string>;

/**
 * MCP proxy interface for calling external tools.
 * Access tools via `ctx.mcp.{serverName}.{toolName}(input)`.
 */
export type KalpMcp = {
  [K in KnownServerKeys]: McpRegistry[K];
} & {
  [serverName: string]: UnknownMcpServer;
};
