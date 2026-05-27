import { describe, it, expect } from "vitest";
import { inferSemanticName } from "../../src/tracing/semantic-inference";

describe("semantic-inference", () => {
  it("should infer name from variable declarator id", () => {
    const result = inferSemanticName(
      {} as any,
      { type: "VariableDeclarator" },
      "chatResponse",
      null,
    );
    expect(result.semanticName).toBe("chatResponse");
    expect(result.inferenceSource).toBe("variable");
  });

  it("should infer name from string literal first arg", () => {
    const result = inferSemanticName(
      {} as any,
      null,
      null,
      "user-prompt",
    );
    expect(result.semanticName).toBe("user_prompt");
    expect(result.inferenceSource).toBe("string-literal");
  });

  it("should prefer variable over string literal", () => {
    const result = inferSemanticName(
      {} as any,
      { type: "VariableDeclarator" },
      "myVar",
      "fallback",
    );
    expect(result.semanticName).toBe("myVar");
    expect(result.inferenceSource).toBe("variable");
  });

  it("should fall back to hash when neither variable nor string literal", () => {
    const result = inferSemanticName(
      {} as any,
      null,
      null,
      null,
    );
    expect(result.semanticName).toBeNull();
    expect(result.inferenceSource).toBe("hash");
  });

  it("should sanitize string literal names", () => {
    const result = inferSemanticName(
      {} as any,
      null,
      null,
      "My Special-Name",
    );
    expect(result.semanticName).toBe("My_Special_Name");
    expect(result.inferenceSource).toBe("string-literal");
  });

  it("should truncate long string literals and still produce a name", () => {
    const longString = "a".repeat(50);
    const result = inferSemanticName(
      {} as any,
      null,
      null,
      longString,
    );
    expect(result.semanticName).not.toBeNull();
    expect(result.semanticName!.length).toBeLessThanOrEqual(48);
    expect(result.inferenceSource).toBe("string-literal");
  });

  it("should fall back to hash for strings over 64 chars", () => {
    const tooLong = "a".repeat(65);
    const result = inferSemanticName(
      {} as any,
      null,
      null,
      tooLong,
    );
    expect(result.semanticName).toBeNull();
    expect(result.inferenceSource).toBe("hash");
  });

  it("should return null for empty string literal", () => {
    const result = inferSemanticName(
      {} as any,
      null,
      null,
      "",
    );
    expect(result.semanticName).toBeNull();
    expect(result.inferenceSource).toBe("hash");
  });
});