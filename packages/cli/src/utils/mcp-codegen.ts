import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadProjectConfig } from "@/utils/project-config";
import type { McpServerRuntimeConfig } from "@kalphq/sdk";
import type { ProjectGenerator, GeneratorResult } from "../utils/sync";
import { getServerConfigs } from "./mcp/server-config";
import { fetchServerTools } from "./mcp/tool-fetcher";
import type { McpServerTypesResult } from "./mcp/tool-fetcher";
import { compileServerToolTypes } from "./mcp/schema-compiler";
import { renderMcpTypes } from "./mcp/type-renderer";

export interface McpGenerateResult {
  outputPath: string;
  servers: McpServerTypesResult[];
  warnings: string[];
}

export class McpTypesGenerator implements ProjectGenerator {
  id = "mcp";
  name = "MCP Types";

  async generate(cwd: string): Promise<GeneratorResult> {
    const generatedDir = join(cwd, ".kalp", "generated");
    const mcpPath = join(generatedDir, "mcp.d.ts");
    const mcpConfigPath = join(generatedDir, "mcp-config.json");

    await mkdir(generatedDir, { recursive: true });

    const { raw } = await loadProjectConfig(cwd);
    const servers = getServerConfigs(raw);
    const warnings: string[] = [];

    const serverResults: McpServerTypesResult[] = [];
    for (const [serverName, config] of Object.entries(servers).sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      try {
        const result = await fetchServerTools(serverName, config);
        serverResults.push(result);
        warnings.push(...result.warnings);
      } catch (error) {
        const message = `Failed to introspect "${serverName}" (${config.url}): ${
          error instanceof Error ? error.message : String(error)
        }`;
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

    const runtimeConfig: Record<string, McpServerRuntimeConfig> = {};
    for (const [name, config] of Object.entries(servers)) {
      runtimeConfig[name] = { url: config.url, headers: config.headers };
    }
    const configJson = JSON.stringify(runtimeConfig, null, 2);

    const existing = await readFile(mcpPath, "utf-8").catch(() => null);
    const existingConfig = await readFile(mcpConfigPath, "utf-8").catch(() => null);
    if (existing === content && existingConfig === configJson) {
      return { updated: false, warnings };
    }

    await writeFile(mcpPath, content, "utf-8");
    await writeFile(mcpConfigPath, configJson, "utf-8");
    return { updated: true, warnings };
  }
}

export async function generateMcpTypes(
  cwd: string,
  _options: { strict?: boolean } = {},
): Promise<McpGenerateResult> {
  const gen = new McpTypesGenerator();
  const res = await gen.generate(cwd);

  return {
    outputPath: join(cwd, ".kalp", "generated", "mcp.d.ts"),
    servers: [],
    warnings: res.warnings || [],
  };
}
