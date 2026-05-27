import { describe, it, expect, vi } from "vitest";

vi.mock("@swc/core", () => ({
  parseSync: vi.fn(),
}));

import { analyzeHandlerSource } from "../../src/tracing/handler-analysis";

const { parseSync } = await import("@swc/core");

function makeSpan(start: number, end: number) {
  return { start, end, ctxt: 0 };
}

describe("handler-analysis", () => {
  it("should return null for file read failure", () => {
    const result = analyzeHandlerSource(
      "non-existent source content",
      "/non/existent/file.ts",
      "./non-existent.ts",
      "nonExistent",
      "tool.non_existent",
      "node_missing",
    );

    expect(result).not.toBeNull();
  });

  it("should analyze a handler with no primitives", () => {
    const source = `
export const simpleHandler = defineTool({
  id: "simple",
  inputSchema: z.object({}),
  async handler(input, ctx) {
    return { ok: true };
  },
});
`;

    (parseSync as any).mockReturnValue({
      type: "Module",
      body: [],
      span: makeSpan(0, source.length),
    });

    const result = analyzeHandlerSource(
      source,
      "/src/simple.ts",
      "./simple.ts",
      "simpleHandler",
      "tool.simple",
      "node_simple",
    );

    expect(result).not.toBeNull();
    expect(result!.exportName).toBe("simpleHandler");
    expect(result!.stableName).toBe("tool.simple");
    expect(result!.primitives.length).toBe(0);
  });

  it("should populate handler line/column from export position", () => {
    const source = `export const handler = defineTool({
  id: "test",
  async handler(input, ctx) {
    return { ok: true };
  },
});`;

    (parseSync as any).mockReturnValue({
      type: "Module",
      body: [],
      span: makeSpan(0, source.length),
    });

    const result = analyzeHandlerSource(
      source,
      "/src/test.ts",
      "./test.ts",
      "handler",
      "tool.test",
      "node_test",
    );

    expect(result).not.toBeNull();
    expect(result!.handlerLine).toBe(1);
    expect(result!.handlerColumn).toBeGreaterThanOrEqual(0);
  });

  it("should handle analysis when parseSync throws", () => {
    const source = `export const handler = { handler: async (ctx) => {} };`;
    (parseSync as any).mockImplementation(() => {
      throw new Error("Parse error");
    });

    const result = analyzeHandlerSource(
      source,
      "/src/test.ts",
      "./test.ts",
      "handler",
      "tool.test",
      "node_test",
    );

    expect(result).not.toBeNull();
    expect(result!.primitives.length).toBe(0);
  });
});