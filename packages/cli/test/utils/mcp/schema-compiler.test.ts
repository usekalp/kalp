import { describe, it, expect } from "vitest";
import { compileSchemaType, compileServerToolTypes } from "@/utils/mcp/schema-compiler";
import type { McpServerTypesResult } from "@/utils/mcp/tool-fetcher";

describe("schema-compiler", () => {
  describe("compileSchemaType", () => {
    it("returns null for non-object schemas", async () => {
      expect(await compileSchemaType(null, "Test")).toBeNull();
      expect(await compileSchemaType("string", "Test")).toBeNull();
      expect(await compileSchemaType(42, "Test")).toBeNull();
    });

    it("compiles simple object schema with properties", async () => {
      const result = await compileSchemaType(
        { type: "object", properties: { name: { type: "string" } } },
        "Simple",
      );
      expect(result).not.toBeNull();
      expect(result!.declaration).toContain("Simple");
      expect(result!.declaration).toContain("name");
    });

    it("returns unknown fallback for uncompileable schemas", async () => {
      const result = await compileSchemaType(
        { type: "invalid_type_as_test" },
        "FallbackType",
      );
      expect(result).not.toBeNull();
      expect(result!.declaration).toBeDefined();
    });

    it("compiles enum schemas to string union types", async () => {
      const result = await compileSchemaType(
        { type: "string", enum: ["a", "b", "c"] },
        "EnumType",
      );
      expect(result!.declaration).toContain("EnumType");
    });
  });

  describe("compileServerToolTypes", () => {
    function makeServer(serverName: string, toolName: string): McpServerTypesResult {
      return {
        serverName,
        transport: "sse" as const,
        url: `https://${serverName}.example.com`,
        tools: [
          {
            name: toolName,
            inputSchema: { type: "object", properties: { query: { type: "string" } } },
            outputSchema: { type: "object", properties: { result: { type: "string" } } },
          },
        ],
        warnings: [],
      };
    }

    it("compiles types for a single server with one tool", async () => {
      const servers = [makeServer("github", "search")];
      const warnings: string[] = [];
      const result = await compileServerToolTypes(servers, warnings);
      expect(result.servers).toHaveLength(1);
      expect(result.servers[0]!.tools).toHaveLength(1);
      expect(result.declarations.length).toBeGreaterThan(0);
    });

    it("generates unique type names per server", async () => {
      const servers = [makeServer("github", "search"), makeServer("gitlab", "search")];
      const warnings: string[] = [];
      const result = await compileServerToolTypes(servers, warnings);
      expect(result.servers).toHaveLength(2);
    });

    it("deduplicates type names across servers", async () => {
      const servers = [makeServer("github", "search"), makeServer("github", "search")];
      const warnings: string[] = [];
      const result = await compileServerToolTypes(servers, warnings);
      expect(result.servers).toHaveLength(2);
      const typeNames = result.servers.flatMap((s) => s.tools.map((t) => t.inputTypeName));
      const unique = new Set(typeNames);
      expect(unique.size).toBe(typeNames.length);
    });

    it("handles empty server list", async () => {
      const warnings: string[] = [];
      const result = await compileServerToolTypes([], warnings);
      expect(result.servers).toHaveLength(0);
      expect(result.declarations).toHaveLength(0);
    });

    it("handles tools without schemas", async () => {
      const server: McpServerTypesResult = {
        serverName: "noschema",
        transport: "sse",
        url: "https://noschema.example.com",
        tools: [{ name: "noinput", inputSchema: undefined, outputSchema: undefined }],
        warnings: [],
      };
      const warnings: string[] = [];
      const result = await compileServerToolTypes([server], warnings);
      expect(result.servers[0]!.tools).toHaveLength(1);
    });
  });
});
