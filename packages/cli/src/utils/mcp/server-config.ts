import { normalizeMcpServer } from "@kalphq/sdk";

export type McpTransport = "sse" | "stdio";

export interface McpServerConfigInput {
  transport: McpTransport;
  url: string;
  headers: Record<string, string>;
}

export function getServerConfigs(raw: Record<string, unknown>): Record<string, McpServerConfigInput> {
  const mcpInput = (raw.mcp || {}) as Record<string, any>;
  const servers: Record<string, McpServerConfigInput> = {};

  for (const [serverName, serverInput] of Object.entries(mcpInput)) {
    const normalized = normalizeMcpServer(serverInput);
    const { url, transport, auth } = normalized;

    if (!url || !url.trim()) continue;

    const headers: Record<string, string> = {};
    let skipAuth = false;

    if (auth) {
      if (auth.type === "bearer") {
        if (auth.tokenEnv && !process.env[auth.tokenEnv]) {
          console.warn(`[MCP] ⚠️ Warning: Missing local environment variable "${auth.tokenEnv}" for server "${serverName}". Skipping authenticated introspection.`);
          skipAuth = true;
        } else if (auth.token) {
          headers["authorization"] = `Bearer ${auth.token}`;
        }
      } else if (auth.type === "headers") {
        for (const [k, v] of Object.entries(auth.headers)) {
          headers[k.toLowerCase()] = v;
        }
        for (const [k, envName] of Object.entries(auth.headersEnv)) {
          if (!process.env[envName]) {
            console.warn(`[MCP] ⚠️ Warning: Missing local environment variable "${envName}" for header "${k}" in server "${serverName}". Skipping authenticated introspection.`);
            skipAuth = true;
          }
        }
      }
    }

    if (skipAuth) {
      for (const k in headers) delete headers[k];
    }

    servers[serverName] = {
      transport,
      url: url.trim(),
      headers,
    };
  }

  return servers;
}
