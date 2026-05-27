import { compile } from "json-schema-to-typescript";
import type { McpServerTypesResult } from "./tool-fetcher";

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

export interface CompiledMcpTool {
  name: string;
  inputTypeName: string;
  outputTypeName: string;
}

export interface CompiledServer {
  result: McpServerTypesResult;
  tools: CompiledMcpTool[];
}

export function isSchemaObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export async function compileSchemaType(
  schema: unknown,
  typeName: string,
): Promise<{ declaration: string; warning?: string } | null> {
  if (!isSchemaObject(schema)) return null;

  try {
    const declaration = await compile(
      schema as Record<string, unknown> as object,
      typeName, {
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

export async function compileServerToolTypes(
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

      const inputDeclaration = await compileSchemaType(tool.inputSchema, inputTypeName);
      if (inputDeclaration?.declaration) {
        declarationMap.set(inputTypeName, inputDeclaration.declaration);
      } else {
        declarationMap.set(inputTypeName, `export type ${inputTypeName} = unknown;`);
      }
      if (inputDeclaration?.warning) {
        warnings.push(inputDeclaration.warning);
      }

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
