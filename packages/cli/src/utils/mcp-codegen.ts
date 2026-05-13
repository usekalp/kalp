import { writeMcpTypes } from "@/utils/codegen";
import { loadProjectConfig } from "@/utils/project-config";
import { compile } from "json-schema-to-typescript";

const MCP_CLIENT_NAME = "kalp-cli";
const MCP_PROTOCOL_VERSION = "2025-06-18";

type McpTransport = "sse" | "stdio";

interface McpServerConfigInput {
  transport: McpTransport;
  url: string;
}

interface McpToolDefinition {
  name: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
}

interface McpServerTypesResult {
  serverName: string;
  transport: McpTransport;
  url: string;
  tools: McpToolDefinition[];
  warnings: string[];
}

export interface McpGenerateResult {
  outputPath: string;
  servers: McpServerTypesResult[];
  warnings: string[];
}

interface JsonRpcSuccess<T> {
  jsonrpc: "2.0";
  id?: string | number;
  result: T;
}

interface JsonRpcFailure {
  jsonrpc: "2.0";
  id?: string | number;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

type JsonRpcResponse<T> = JsonRpcSuccess<T> | JsonRpcFailure;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function isMcpTransport(value: unknown): value is McpTransport {
  return value === "sse" || value === "stdio";
}

function toPascalCase(value: string): string {
  const normalized = value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

  if (!normalized) return "Generated";
  return /^[0-9]/.test(normalized) ? `N${normalized}` : normalized;
}

function getServerConfigs(raw: Record<string, unknown>): Record<string, McpServerConfigInput> {
  const mcp = asRecord(raw.mcp);
  if (!mcp) return {};

  const servers: Record<string, McpServerConfigInput> = {};
  for (const [serverName, serverConfigRaw] of Object.entries(mcp)) {
    const serverConfig = asRecord(serverConfigRaw);
    if (!serverConfig) continue;

    const transport = serverConfig.transport;
    const url = serverConfig.url;
    if (!isMcpTransport(transport) || typeof url !== "string" || !url.trim()) {
      continue;
    }

    servers[serverName] = {
      transport,
      url: url.trim(),
    };
  }

  return servers;
}

function createRpcPayload(
  id: number | string,
  method: string,
  params?: Record<string, unknown>,
): Record<string, unknown> {
  if (params) {
    return {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };
  }

  return {
    jsonrpc: "2.0",
    id,
    method,
  };
}

async function postJsonRpc<T>(
  url: string,
  body: Record<string, unknown>,
  protocolVersion: string,
): Promise<JsonRpcResponse<T>> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "MCP-Protocol-Version": protocolVersion,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Request failed with HTTP ${response.status}: ${text.slice(0, 300)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON-RPC response payload: ${text.slice(0, 300)}`);
  }

  const record = asRecord(parsed);
  if (!record) {
    throw new Error("Invalid JSON-RPC response shape.");
  }

  return record as JsonRpcResponse<T>;
}

async function initializeServer(url: string): Promise<string> {
  const initResponse = await postJsonRpc<{ protocolVersion?: string }>(
    url,
    createRpcPayload(1, "initialize", {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: MCP_CLIENT_NAME, version: "0.1.0" },
    }),
    MCP_PROTOCOL_VERSION,
  );

  if ("error" in initResponse) {
    throw new Error(
      `initialize failed (${initResponse.error.code}): ${initResponse.error.message}`,
    );
  }

  const negotiatedVersion =
    typeof initResponse.result?.protocolVersion === "string"
      ? initResponse.result.protocolVersion
      : MCP_PROTOCOL_VERSION;

  await postJsonRpc(
    url,
    {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    },
    negotiatedVersion,
  ).catch(() => {
    // Notification failures should not block type generation.
  });

  return negotiatedVersion;
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

async function fetchServerTools(
  serverName: string,
  config: McpServerConfigInput,
): Promise<McpServerTypesResult> {
  const warnings: string[] = [];

  if (config.transport !== "sse") {
    warnings.push(
      `Server "${serverName}" uses "${config.transport}" transport and was skipped. Only "sse" transport is supported by kalp mcp generate.`,
    );
    return {
      serverName,
      transport: config.transport,
      url: config.url,
      tools: [],
      warnings,
    };
  }

  const protocolVersion = await initializeServer(config.url);
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

function isSchemaObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

async function compileSchemaType(
  schema: unknown,
  typeName: string,
): Promise<{ declaration: string; warning?: string } | null> {
  if (!isSchemaObject(schema)) return null;

  try {
    const declaration = await compile(schema as any, typeName, {
      bannerComment: "",
      unreachableDefinitions: true,
      style: {
        semi: true,
      },
      unknownAny: true,
    });
    return { declaration: declaration.trim() };
  } catch (error) {
    return {
      declaration: `export type ${typeName} = unknown;`,
      warning: `Could not compile schema for ${typeName}. Falling back to unknown.`,
    };
  }
}

interface CompiledMcpTool {
  name: string;
  inputTypeName: string;
  outputTypeName: string;
}

interface CompiledServer {
  result: McpServerTypesResult;
  tools: CompiledMcpTool[];
}

async function compileServerToolTypes(
  serverResults: McpServerTypesResult[],
  warnings: string[],
): Promise<{
  declarations: string[];
  servers: CompiledServer[];
}> {
  const declarationMap = new Map<string, string>();
  const usedTypeNames = new Set<string>();
  const servers: CompiledServer[] = [];

  const reserveTypeName = (baseName: string): string => {
    if (!usedTypeNames.has(baseName)) {
      usedTypeNames.add(baseName);
      return baseName;
    }
    let suffix = 2;
    while (usedTypeNames.has(`${baseName}${suffix}`)) {
      suffix += 1;
    }
    const nextName = `${baseName}${suffix}`;
    usedTypeNames.add(nextName);
    return nextName;
  };

  for (const server of serverResults) {
    const tools: CompiledMcpTool[] = [];
    for (const tool of server.tools) {
      const baseName = `${toPascalCase(server.serverName)}${toPascalCase(tool.name)}`;
      const inputTypeName = reserveTypeName(`${baseName}Input`);
      const outputTypeName = reserveTypeName(`${baseName}Output`);

      // eslint-disable-next-line no-await-in-loop
      const inputDeclaration = await compileSchemaType(tool.inputSchema, inputTypeName);
      if (inputDeclaration?.declaration) {
        declarationMap.set(inputTypeName, inputDeclaration.declaration);
      } else {
        declarationMap.set(inputTypeName, `export type ${inputTypeName} = unknown;`);
      }
      if (inputDeclaration?.warning) {
        warnings.push(inputDeclaration.warning);
      }

      // eslint-disable-next-line no-await-in-loop
      const outputDeclaration = await compileSchemaType(tool.outputSchema, outputTypeName);
      if (outputDeclaration?.declaration) {
        declarationMap.set(outputTypeName, outputDeclaration.declaration);
      } else {
        declarationMap.set(outputTypeName, `export type ${outputTypeName} = unknown;`);
      }
      if (outputDeclaration?.warning) {
        warnings.push(outputDeclaration.warning);
      }

      tools.push({
        name: tool.name,
        inputTypeName,
        outputTypeName,
      });
    }
    servers.push({ result: server, tools });
  }

  return {
    declarations: Array.from(declarationMap.values()),
    servers,
  };
}

function renderMcpTypes(
  declarations: string[],
  servers: CompiledServer[],
): string {
  const lines: string[] = [
    "// 🦋 Kalp Generated MCP Types",
    "// This file is auto-generated by `kalp mcp generate`.",
    "// Do not edit manually.",
    "",
    "import \"@kalphq/sdk\";",
    "",
  ];

  if (declarations.length > 0) {
    for (const declaration of declarations) {
      lines.push(declaration.trim());
      lines.push("");
    }
  }

  lines.push('declare module "@kalphq/sdk" {');
  lines.push("  interface McpRegistry {");
  for (const server of servers) {
    lines.push(`    ${JSON.stringify(server.result.serverName)}: {`);
    for (const tool of server.tools) {
      lines.push(
        `      ${JSON.stringify(tool.name)}: (input: ${tool.inputTypeName}) => Promise<${tool.outputTypeName}>;`,
      );
    }
    lines.push("    };");
  }
  lines.push("  }");
  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

export async function generateMcpTypes(
  cwd: string,
  options: { strict?: boolean } = {},
): Promise<McpGenerateResult> {
  const { raw } = await loadProjectConfig(cwd);
  const servers = getServerConfigs(raw);
  const warnings: string[] = [];

  const serverResults: McpServerTypesResult[] = [];
  for (const [serverName, config] of Object.entries(servers).sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await fetchServerTools(serverName, config);
      serverResults.push(result);
      warnings.push(...result.warnings);
    } catch (error) {
      const message = `Failed to introspect "${serverName}" (${config.url}): ${
        error instanceof Error ? error.message : String(error)
      }`;
      if (options.strict) {
        throw new Error(message);
      }
      warnings.push(message);
      serverResults.push({
        serverName,
        transport: config.transport,
        url: config.url,
        tools: [],
        warnings: [message],
      });
    }
  }

  const compiled = await compileServerToolTypes(serverResults, warnings);
  const content = renderMcpTypes(compiled.declarations, compiled.servers);
  const outputPath = await writeMcpTypes(cwd, content);

  return {
    outputPath,
    servers: serverResults,
    warnings,
  };
}
