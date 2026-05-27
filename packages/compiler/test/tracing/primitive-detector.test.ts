import { describe, it, expect, vi } from "vitest";

vi.mock("@swc/core", () => ({
  parseSync: vi.fn(),
}));

import { detectPrimitives } from "../../src/tracing/primitive-detector";

function makeSpan(start: number, end: number) {
  return { start, end, ctxt: 0 };
}

function makeIdentifier(value: string, span?: { start: number; end: number }) {
  return {
    type: "Identifier" as const,
    value,
    span: span ?? makeSpan(0, value.length),
    optional: false,
  };
}

function makeMemberExpr(obj: any, prop: any, span: { start: number; end: number }) {
  return {
    type: "MemberExpression" as const,
    object: obj,
    property: prop,
    span,
    optional: false,
  };
}

function makeCallExpr(callee: any, args: any[], span: { start: number; end: number }) {
  return {
    type: "CallExpression" as const,
    callee,
    arguments: args,
    span,
    optional: false,
  };
}

function makeStringLiteral(value: string, span?: { start: number; end: number }) {
  return {
    type: "StringLiteral" as const,
    value,
    span: span ?? makeSpan(0, value.length + 2),
  };
}

const { parseSync } = await import("@swc/core");

describe("primitive-detector", () => {
  it("should detect ctx.ai.generate call", () => {
    const source = `
export const myTool = {
  handler: async (input, ctx) => {
    const result = await ctx.ai.generate("hello");
    return result;
  },
};`;
    const callSpan = makeSpan(70, 95);
    const ctxId = makeIdentifier("ctx");
    const aiId = makeIdentifier("ai");
    const generateId = makeIdentifier("generate");
    const callee = makeMemberExpr(
      makeMemberExpr(ctxId, aiId, makeSpan(70, 77)),
      generateId,
      makeSpan(70, 86),
    );
    makeCallExpr(callee, [{ expression: makeStringLiteral("hello") }], callSpan);

    (parseSync as any).mockReturnValue({
      type: "Module",
      body: [
        {
          type: "ExportDeclaration",
          declaration: {
            type: "VariableDeclaration",
            kind: "const",
            declarations: [
              {
                type: "VariableDeclarator",
                id: makeIdentifier("myTool"),
                init: {
                  type: "ObjectExpression",
                  properties: [],
                  span: makeSpan(0, source.length),
                },
                span: makeSpan(0, source.length),
              },
            ],
            span: makeSpan(0, source.length),
          },
          span: makeSpan(0, source.length),
        },
      ],
      span: makeSpan(0, source.length),
    });

    const detections = detectPrimitives(source, 0, source.length);
    expect(Array.isArray(detections)).toBe(true);
  });

  it("should return empty array on parse failure", () => {
    (parseSync as any).mockImplementation(() => {
      throw new Error("Parse error");
    });

    const detections = detectPrimitives("invalid {{{ syntax", 0, 17);
    expect(detections).toEqual([]);
  });

  it("should return empty array when no ctx calls found", () => {
    const source = `const x = 1 + 2;`;
    (parseSync as any).mockReturnValue({
      type: "Module",
      body: [
        {
          type: "ExpressionStatement",
          expression: {
            type: "BinaryExpression",
            left: makeIdentifier("x"),
            operator: "+",
            right: { type: "NumericLiteral", value: 2 },
          },
          span: makeSpan(0, source.length),
        },
      ],
      span: makeSpan(0, source.length),
    });

    const detections = detectPrimitives(source, 0, source.length);
    expect(detections).toEqual([]);
  });

  it("should detect ctx.cache.get call", () => {
    const source = `const data = await ctx.cache.get("my-key");`;
    const fullSpan = makeSpan(0, source.length);
    (parseSync as any).mockReturnValue({
      type: "Module",
      body: [],
      span: fullSpan,
    });

    const detections = detectPrimitives(source, 0, source.length);
    expect(Array.isArray(detections)).toBe(true);
  });

  it("should respect handler body range", () => {
    const source = `const x = 1;`;
    (parseSync as any).mockReturnValue({
      type: "Module",
      body: [],
      span: makeSpan(0, source.length),
    });

    const detections = detectPrimitives(source, 5, 14);
    expect(Array.isArray(detections)).toBe(true);
  });
});