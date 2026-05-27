import { createRpcPayload, initializeServer, postJsonRpc } from "./rpc-client";
import type { McpServerConfigInput } from "./server-config";

export interface McpToolDefinition {
  name: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
}

export interface McpServerTypesResult {
  serverName: string;
  transport: "sse" | "stdio";
  url: string;
  tools: McpToolDefinition[];
  warnings: string[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function parseToolsFromResponse(value: unknown): {
  tools: McpToolDefinition[];
  nextCursor?: string;
} {
  const record = asRecord(value);
  if (!record) return { tools: [] };

  const nextCursor =
    typeof record.nextCursor === "string" ? record.nextCursor : undefined;
  const rawTools = Array.isArray(record.tools) ? record.tools : [];

  const tools: McpToolDefinition[] = [];
  for (const item of rawTools) {
    const tool = asRecord(item);
    if (!tool) continue;
    const name = typeof tool.name === "string" ? tool.name.trim() : "";
    if (!name) continue;

    tools.push({
      name,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
    });
  }

  return { tools, nextCursor };
}

export async function fetchServerTools(
  serverName: string,
  config: McpServerConfigInput,
): Promise<McpServerTypesResult> {
  const warnings: string[] = [];

  if (config.transport !== "sse") {
    warnings.push(
      `Server "${serverName}" uses "${config.transport}" transport and was skipped. Only "sse" transport is supported.`,
    );
    return {
      serverName,
      transport: config.transport,
      url: config.url,
      tools: [],
      warnings,
    };
  }

  const protocolVersion = await initializeServer(config.url, config.headers);
  const tools: McpToolDefinition[] = [];

  let cursor: string | undefined;
  let page = 0;
  const seen = new Set<string>();

  while (page < 200) {
    const params = cursor ? { cursor } : {};
    const response = await postJsonRpc<{ tools?: unknown[]; nextCursor?: string }>(
      config.url,
      createRpcPayload(`tools-list-${page + 1}`, "tools/list", params),
      protocolVersion,
      config.headers,
    );

    if ("error" in response) {
      throw new Error(
        `tools/list failed (${response.error.code}): ${response.error.message}`,
      );
    }

    const parsed = parseToolsFromResponse(response.result);
    for (const tool of parsed.tools) {
      if (seen.has(tool.name)) continue;
      seen.add(tool.name);
      tools.push(tool);
    }

    page += 1;
    if (!parsed.nextCursor || parsed.nextCursor === cursor) {
      break;
    }
    cursor = parsed.nextCursor;
  }

  if (page >= 200) {
    warnings.push(
      `Server "${serverName}" reached the pagination safety limit while listing tools.`,
    );
  }

  return {
    serverName,
    transport: config.transport,
    url: config.url,
    tools: tools.sort((a, b) => a.name.localeCompare(b.name)),
    warnings,
  };
}
