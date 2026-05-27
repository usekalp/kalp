import { describe, it, expect } from "vitest";
import { normalizeCallForHash, stableHashNormalized } from "../../src/tracing/ast-normalizer";

describe("ast-normalizer", () => {
  it("should normalize a call shape for hashing", () => {
    const normalized = normalizeCallForHash({
      callee: "ai.generate",
      args: [{ type: "StringLiteral", value: "prompt" }],
    });
    expect(normalized.type).toBe("call");
    expect(normalized.callee).toBe("ai.generate");
    expect(normalized.args.length).toBe(1);
    expect(normalized.args[0]!.type).toBe("StringLiteral");
    expect(normalized.args[0]!.value).toBe("prompt");
  });

  it("should truncate long arg values", () => {
    const longValue = "x".repeat(100);
    const normalized = normalizeCallForHash({
      callee: "cache.get",
      args: [{ type: "StringLiteral", value: longValue }],
    });
    expect(normalized.args[0]!.value).toBeUndefined();
  });

  it("should sort object keys for stable hashing", () => {
    const normalized = normalizeCallForHash({
      callee: "test",
      args: [{ type: "ObjectExpression", keys: ["z", "a", "m"] }],
    });
    expect(normalized.args[0]!.keys).toEqual(["a", "m", "z"]);
  });

  it("should produce deterministic hashes for same input", () => {
    const input = {
      callee: "ai.generate",
      args: [{ type: "StringLiteral", value: "test" }],
    };
    const hash1 = stableHashNormalized(normalizeCallForHash(input));
    const hash2 = stableHashNormalized(normalizeCallForHash(input));
    expect(hash1).toBe(hash2);
  });

  it("should produce different hashes for different inputs", () => {
    const hash1 = stableHashNormalized(normalizeCallForHash({
      callee: "ai.generate",
      args: [{ type: "StringLiteral", value: "test1" }],
    }));
    const hash2 = stableHashNormalized(normalizeCallForHash({
      callee: "ai.generate",
      args: [{ type: "StringLiteral", value: "test2" }],
    }));
    expect(hash1).not.toBe(hash2);
  });

  it("should handle empty args", () => {
    const normalized = normalizeCallForHash({
      callee: "log.info",
      args: [],
    });
    expect(normalized.args).toEqual([]);
    const hash = stableHashNormalized(normalized);
    expect(hash).toBeDefined();
    expect(hash.length).toBeGreaterThan(0);
  });
});