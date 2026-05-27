import { describe, it, expect } from "vitest";
import { findExportPosition, findHandlerBodyOffset } from "../../src/tracing/source-locations";

describe("source-locations", () => {
  describe("findExportPosition", () => {
    it("should find const export", () => {
      const source = `export const myHandler = { handler: async (ctx) => {} }`;
      const pos = findExportPosition(source, "myHandler");
      expect(pos).not.toBeNull();
      expect(pos!.line).toBe(1);
      expect(pos!.column).toBeGreaterThanOrEqual(0);
    });

    it("should find function export", () => {
      const source = `export function myFunc() { return 1; }`;
      const pos = findExportPosition(source, "myFunc");
      expect(pos).not.toBeNull();
      expect(pos!.line).toBe(1);
    });

    it("should find async function export", () => {
      const source = `export async function myAsyncFunc() { return 2; }`;
      const pos = findExportPosition(source, "myAsyncFunc");
      expect(pos).not.toBeNull();
      expect(pos!.line).toBe(1);
    });

    it("should handle multiline source", () => {
      const source = [
        `import { z } from "zod";`,
        `export const handler = {`,
        `  handler: async (ctx) => {}`,
        `}`,
      ].join("\n");
      const pos = findExportPosition(source, "handler");
      expect(pos).not.toBeNull();
      expect(pos!.line).toBe(2);
    });

    it("should return null for missing export", () => {
      const source = `export const other = 1`;
      const pos = findExportPosition(source, "nonexistent");
      expect(pos).toBeNull();
    });
  });

  describe("findHandlerBodyOffset", () => {
    it("should find brace body for object handler", () => {
      const source = `export const myTool = {
  handler: async (input, ctx) => {
    ctx.log.info("hello");
    return { ok: true };
  },
};`;
      const range = findHandlerBodyOffset(source, "myTool");
      expect(range).not.toBeNull();
      expect(range!.start).toBeGreaterThan(0);
      expect(range!.end).toBeGreaterThan(range!.start);
    });

    it("should return null for missing export", () => {
      const source = `const x = 1`;
      const range = findHandlerBodyOffset(source, "nonexistent");
      expect(range).toBeNull();
    });
  });
});