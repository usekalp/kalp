import { describe, it, expect } from "vitest";
import { applyStateDefaults, validateStateSchema, resolveSchema } from "../../src/engine/schema-utils";

describe("resolveSchema", () => {
  it("should return schema by id", () => {
    const schemas = { s1: { type: "json-schema" as const, source: "zod", hash: "h", schema: { type: "object" } } };
    expect(resolveSchema("s1", schemas)).toEqual({ type: "object" });
  });

  it("should return undefined for missing id", () => {
    expect(resolveSchema(undefined, {})).toBeUndefined();
  });
});

describe("applyStateDefaults", () => {
  it("should return value when no schema", () => {
    expect(applyStateDefaults(undefined, { a: 1 })).toEqual({ a: 1 });
  });

  it("should apply default values for missing properties", () => {
    const schema = { type: "object", properties: { count: { type: "number", default: 0 }, name: { type: "string" } } };
    const result = applyStateDefaults(schema, {});
    expect(result).toEqual({ count: 0 });
  });

  it("should preserve provided values over defaults", () => {
    const schema = { type: "object", properties: { count: { type: "number", default: 0 } } };
    const result = applyStateDefaults(schema, { count: 42 });
    expect(result).toEqual({ count: 42 });
  });

  it("should handle nested objects", () => {
    const schema = {
      type: "object",
      properties: {
        meta: {
          type: "object",
          properties: { tags: { type: "array", items: { type: "string" }, default: [] } },
        },
      },
    };
    const result = applyStateDefaults(schema, { meta: {} });
    expect(result).toEqual({ meta: { tags: [] } });
  });

  it("should return original value if hydrated is not an object", () => {
    const schema = { type: "object", properties: { x: { type: "string" } } };
    const result = applyStateDefaults(schema, { x: "hi" });
    expect(result).toEqual({ x: "hi" });
  });
});

describe("validateStateSchema", () => {
  it("should return empty when no schema", () => {
    expect(validateStateSchema(undefined, {}, "")).toEqual([]);
  });

  it("should pass valid object", () => {
    const schema = { type: "object", required: ["name"], properties: { name: { type: "string" } } };
    expect(validateStateSchema(schema, { name: "test" }, "state")).toEqual([]);
  });

  it("should fail on missing required field", () => {
    const schema = { type: "object", required: ["name"], properties: { name: { type: "string" } } };
    const errors = validateStateSchema(schema, {}, "state");
    expect(errors).toContain("state.name is required");
  });

  it("should fail on type mismatch", () => {
    const schema = { type: "object", properties: { age: { type: "number" } } };
    const errors = validateStateSchema(schema, { age: "not-a-number" }, "state");
    expect(errors).toContain("state.age must be a number");
  });

  it("should validate enum values", () => {
    const schema = { enum: ["a", "b"] };
    expect(validateStateSchema(schema, "a", "state")).toEqual([]);
    expect(validateStateSchema(schema, "c", "state")[0]).toContain("state must be one of");
  });

  it("should validate arrays", () => {
    const schema = { type: "array", items: { type: "number" } };
    expect(validateStateSchema(schema, [1, 2], "state")).toEqual([]);
    expect(validateStateSchema(schema, "not-array", "state")).toContain("state must be an array");
  });

  it("should validate primitives", () => {
    expect(validateStateSchema({ type: "string" }, 1, "s")).toContain("s must be a string");
    expect(validateStateSchema({ type: "number" }, "x", "s")).toContain("s must be a number");
    expect(validateStateSchema({ type: "boolean" }, 1, "s")).toContain("s must be a boolean");
    expect(validateStateSchema({ type: "null" }, undefined, "s")).toContain("s must be null");
  });
});
