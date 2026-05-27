import { describe, it, expect } from "vitest";
import { renderMcpTypes } from "@/utils/mcp/type-renderer";
import type { CompiledServer } from "@/utils/mcp/schema-compiler";

describe("type-renderer", () => {
  function makeServer(serverName: string): CompiledServer {
    return {
      result: {
        serverName,
        transport: "sse",
        url: `https://${serverName}.example.com`,
        tools: [],
        warnings: [],
      },
      tools: [
        { name: "list", inputTypeName: "GitHubRepoListInput", outputTypeName: "GitHubRepoListOutput" },
        { name: "search", inputTypeName: "GitHubRepoSearchInput", outputTypeName: "GitHubRepoSearchOutput" },
      ],
    };
  }

  it("renders header and module declaration", () => {
    const result = renderMcpTypes([], []);
    expect(result).toContain("Kalp Generated MCP Types");
    expect(result).toContain('declare module "@kalphq/sdk"');
    expect(result).toContain("interface McpRegistry");
  });

  it("renders single server with tools", () => {
    const result = renderMcpTypes([], [makeServer("github")]);
    expect(result).toContain('"github"');
    expect(result).toContain('"list"');
    expect(result).toContain("GitHubRepoListInput");
    expect(result).toContain("GitHubRepoListOutput");
    expect(result).toContain('"search"');
    expect(result).toContain("GitHubRepoSearchInput");
    expect(result).toContain("GitHubRepoSearchOutput");
  });

  it("renders multiple servers", () => {
    const result = renderMcpTypes([], [makeServer("github"), makeServer("gitlab")]);
    expect(result).toContain('"github"');
    expect(result).toContain('"gitlab"');
  });

  it("renders type declarations before servers", () => {
    const declarations = ["export type Foo = string;", "export type Bar = number;"];
    const result = renderMcpTypes(declarations, [makeServer("test")]);
    const fooIndex = result.indexOf("export type Foo");
    const barIndex = result.indexOf("export type Bar");
    const moduleIndex = result.indexOf("declare module");
    expect(fooIndex).toBeGreaterThan(0);
    expect(barIndex).toBeGreaterThan(fooIndex);
    expect(moduleIndex).toBeGreaterThan(barIndex);
  });

  it("renders empty declarations gracefully", () => {
    const result = renderMcpTypes([], [makeServer("empty")]);
    expect(result).toContain('"empty"');
    expect(result).not.toContain("export type");
  });

  it("ends with newline", () => {
    const result = renderMcpTypes([], []);
    expect(result.endsWith("\n")).toBe(true);
  });

  it("handles server with no tools", () => {
    const server: CompiledServer = {
      result: {
        serverName: "notools",
        transport: "sse",
        url: "https://notools.example.com",
        tools: [],
        warnings: [],
      },
      tools: [],
    };
    const result = renderMcpTypes([], [server]);
    expect(result).toContain('"notools"');
  });

  it("sorts tools by name in output", () => {
    const server: CompiledServer = {
      result: {
        serverName: "sorted",
        transport: "sse",
        url: "https://sorted.example.com",
        tools: [],
        warnings: [],
      },
      tools: [
        { name: "aaa_first", inputTypeName: "AInput", outputTypeName: "AOutput" },
        { name: "zzz_last", inputTypeName: "ZInput", outputTypeName: "ZOutput" },
      ],
    };
    const result = renderMcpTypes([], [server]);
    expect(result).toContain('"sorted"');
    expect(result).toContain('"aaa_first"');
    expect(result).toContain('"zzz_last"');
  });
});
