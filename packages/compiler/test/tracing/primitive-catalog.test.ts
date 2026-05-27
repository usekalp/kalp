import { describe, it, expect } from "vitest";
import { PRIMITIVE_CATALOG, isKnownPrimitive, getAllPrimitiveTypes } from "../../src/tracing/primitive-catalog";

describe("primitive-catalog", () => {
  it("should list all primitive namespaces", () => {
    const namespaces = Object.keys(PRIMITIVE_CATALOG);
    expect(namespaces).toContain("ai");
    expect(namespaces).toContain("cache");
    expect(namespaces).toContain("memory");
    expect(namespaces).toContain("log");
    expect(namespaces).toContain("vault");
    expect(namespaces).toContain("time");
    expect(namespaces).toContain("math");
    expect(namespaces).toContain("actions");
    expect(namespaces).toContain("schedules");
    expect(namespaces).toContain("history");
    expect(namespaces).toContain("mcp");
    expect(namespaces).toContain("auth");
  });

  it("should recognize known primitives", () => {
    expect(isKnownPrimitive("ai", "generate")).toBe(true);
    expect(isKnownPrimitive("cache", "get")).toBe(true);
    expect(isKnownPrimitive("memory", "list")).toBe(true);
    expect(isKnownPrimitive("log", "info")).toBe(true);
    expect(isKnownPrimitive("auth", "getToken")).toBe(true);
    expect(isKnownPrimitive("cache", "set")).toBe(true);
  });

  it("should reject unknown primitives", () => {
    expect(isKnownPrimitive("unknown", "method")).toBe(false);
    expect(isKnownPrimitive("ai", "unknownMethod")).toBe(false);
  });

  it("should handle MCP wildcard", () => {
    expect(isKnownPrimitive("mcp", "anything")).toBe(true);
    expect(isKnownPrimitive("mcp", "search")).toBe(true);
  });

  it("should generate all primitive types", () => {
    const types = getAllPrimitiveTypes();
    expect(types).toContain("ai.generate");
    expect(types).toContain("cache.get");
    expect(types).toContain("mcp");
    expect(types.length).toBeGreaterThan(0);
  });
});