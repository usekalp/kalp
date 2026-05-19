import { describe, it, expect } from "vitest";
import {
  cloneDefaultValue,
  applySchemaDefaults,
  applyStateDefaults,
} from "../../src/engine/schema-defaults";

describe("cloneDefaultValue", () => {
  it("should return undefined when value is undefined", () => {
    expect(cloneDefaultValue(undefined)).toBeUndefined();
  });

  it("should deep-clone a value via JSON round-trip", () => {
    const obj = { a: 1, b: [2, 3] };
    const cloned = cloneDefaultValue(obj);
    expect(cloned).toEqual(obj);
    expect(cloned).not.toBe(obj);
  });
});

describe("applySchemaDefaults", () => {
  it("should return value when schema is undefined", () => {
    expect(applySchemaDefaults(undefined, 42)).toBe(42);
  });

  it("should return default when value is undefined", () => {
    const schema = { type: "string", default: "hello" };
    expect(applySchemaDefaults(schema, undefined)).toBe("hello");
  });

  it("should return value when type is array but value is not an array", () => {
    const value = { a: 1 };
    expect(applySchemaDefaults({ type: "array" }, value)).toBe(value);
  });

  it("should return value when type is array and items is missing", () => {
    const value = [1, 2, 3];
    expect(applySchemaDefaults({ type: "array" }, value)).toBe(value);
  });

  it("should apply defaults to array items", () => {
    const schema = { type: "array", items: { type: "string", default: "x" } };
    const result = applySchemaDefaults(schema, [undefined]);
    expect(result).toEqual(["x"]);
  });

  it("should populate missing object properties from defaults", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string", default: "unnamed" },
        count: { type: "number", default: 0 },
      },
    };
    const result = applySchemaDefaults(schema, {});
    expect(result).toEqual({ name: "unnamed", count: 0 });
  });
});

describe("applyStateDefaults", () => {
  it("should return value when schema is undefined", () => {
    const value = { a: 1 };
    expect(applyStateDefaults(undefined, value)).toBe(value);
  });

  it("should return original value when hydrated result is non-object", () => {
    const value = ["test"];
    const result = applyStateDefaults(
      { type: "array", items: { type: "string" } },
      value as unknown as Record<string, unknown>,
    );
    expect(result).toBe(value);
  });

  it("should apply defaults and return hydrated object", () => {
    const schema = {
      type: "object",
      properties: { x: { type: "number", default: 42 } },
    };
    const result = applyStateDefaults(schema, {});
    expect(result).toEqual({ x: 42 });
  });
});