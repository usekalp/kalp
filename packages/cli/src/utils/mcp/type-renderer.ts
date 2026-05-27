import type { CompiledServer } from "./schema-compiler";

export function renderMcpTypes(
  declarations: string[],
  servers: CompiledServer[],
): string {
  const lines: string[] = [
    "// 🦋 Kalp Generated MCP Types",
    "// This file is auto-generated. Do not edit manually.",
    "",
    'import "@kalphq/sdk";',
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
