import { McpTransport } from "@kalphq/core";
import type { McpServerRuntimeConfig } from "@kalphq/sdk";

export type McpProviders = {
  mcp?: Record<string, McpServerRuntimeConfig>;
};

export class McpRegistry {
  private transports = new Map<string, McpTransport>();

  constructor(private providers: McpProviders) {}

  async resolve(payload: Record<string, unknown>): Promise<unknown> {
    const serverName = payload.server as string;
    const toolName = payload.tool as string;

    const config = this.providers.mcp?.[serverName];
    if (!config) {
      throw new Error(
        `MCP server "${serverName}" is not configured. Add it to the mcp section of your project config and run \`kalp sync\`.`,
      );
    }

    const transport = this.getOrInit(serverName, config);
    const result = await transport.callTool(toolName, payload.args);

    const textContent = result.content?.find((c) => c.type === "text");
    if (textContent?.text) {
      try {
        return JSON.parse(textContent.text);
      } catch {
        return textContent.text;
      }
    }

    return result.content;
  }

  private getOrInit(serverName: string, config: McpServerRuntimeConfig): McpTransport {
    const existing = this.transports.get(serverName);
    if (existing) return existing;
    const transport = new McpTransport(config);
    this.transports.set(serverName, transport);
    return transport;
  }

  async disconnectAll(): Promise<void> {
    const transports = Array.from(this.transports.values());
    this.transports.clear();
    await Promise.allSettled(transports.map((t) => t.disconnect()));
  }
}