import { describe, it, expect } from "vitest";
import { generatePrimitiveId, sanitizeStableSegment } from "../../src/tracing/primitive-id";

describe("primitive-id", () => {
  describe("sanitizeStableSegment", () => {
    it("should lowercase segments", () => {
      expect(sanitizeStableSegment("MyName")).toBe("myname");
    });

    it("should replace colons and wildcards with dots", () => {
      expect(sanitizeStableSegment("mcp:search")).toBe("mcp.search");
    });

    it("should replace non-alphanumeric chars with dashes", () => {
      expect(sanitizeStableSegment("hello world!")).toBe("hello-world");
    });

    it("should collapse multiple dots", () => {
      expect(sanitizeStableSegment("a...b")).toBe("a.b");
    });

    it("should trim leading/trailing dashes and dots", () => {
      expect(sanitizeStableSegment("-hello-.")).toBe("hello");
    });

    it("should handle empty strings", () => {
      expect(sanitizeStableSegment("")).toBe("");
    });

    it("should handle paths with slashes", () => {
      expect(sanitizeStableSegment("api/v1/data")).toBe("api.v1.data");
    });
  });

  describe("generatePrimitiveId", () => {
    it("should generate ID with semantic name", () => {
      const id = generatePrimitiveId({
        handlerStableName: "tool.chat_tool",
        namespace: "ai",
        method: "generate",
        semanticName: "chatResponse",
        fallbackHash: "abc123",
      });
      expect(id).toBe("tool.chat_tool.ai.generate.chatresponse");
    });

    it("should use fallback hash when no semantic name", () => {
      const id = generatePrimitiveId({
        handlerStableName: "route.get.api_data",
        namespace: "storage",
        method: "get",
        semanticName: null,
        fallbackHash: "abc123",
      });
      expect(id).toBe("route.get.api_data.storage.get.abc123");
    });

    it("should ignore semantic name if it sanitizes to empty string", () => {
      const id = generatePrimitiveId({
        handlerStableName: "hook.tick.0",
        namespace: "log",
        method: "info",
        semanticName: "!!!",
        fallbackHash: "xyz789",
      });
      expect(id).toBe("hook.tick.0.log.info.xyz789");
    });

    it("should sanitize special chars in semantic name", () => {
      const id = generatePrimitiveId({
        handlerStableName: "tool.data_tool",
        namespace: "mcp",
        method: "search",
        semanticName: "MCP:GitHub-Search",
        fallbackHash: "abc123",
      });
      expect(id).toBe("tool.data_tool.mcp.search.mcp.github-search");
    });
  });
});