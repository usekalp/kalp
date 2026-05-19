import type { JsonSchema } from "@/effects/primitives";

/**
 * Deep-clones a value via JSON round-trip for safe mutation of default values.
 *
 * @param value - The value to clone.
 * @returns A deep copy of the value, or undefined if the input is undefined.
 */
export function cloneDefaultValue<T>(value: T): T {
  if (value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Recursively applies schema-defined default values to a nested object or array structure.
 * Missing properties on objects are populated from their schema default when defined.
 *
 * @param schema - An optional JSON schema definition.
 * @param value - The value to apply defaults to.
 * @returns The value with defaults applied.
 */
export function applySchemaDefaults(
  schema: Record<string, unknown> | undefined,
  value: unknown,
): unknown {
  if (!schema) {
    return value;
  }

  const node = schema as JsonSchema;

  if (value === undefined && node.default !== undefined) {
    return cloneDefaultValue(node.default);
  }

  if (node.type === "object") {
    const base =
      value && typeof value === "object" && !Array.isArray(value)
        ? { ...(value as Record<string, unknown>) }
        : {};

    const properties = node.properties ?? {};
    for (const [key, childSchema] of Object.entries(properties)) {
      base[key] = applySchemaDefaults(
        childSchema as Record<string, unknown>,
        base[key],
      );
    }

    return base;
  }

  if (node.type === "array" && Array.isArray(value) && node.items) {
    return value.map((item) =>
      applySchemaDefaults(node.items as Record<string, unknown>, item),
    );
  }

  return value;
}

/**
 * Applies schema defaults to a top-level state object, ensuring the result
 * remains a flat record with all nested defaults resolved.
 *
 * @param schema - An optional JSON schema for the state shape.
 * @param value - The current state values.
 * @returns The state with defaults applied.
 */
export function applyStateDefaults(
  schema: Record<string, unknown> | undefined,
  value: Record<string, unknown>,
): Record<string, unknown> {
  if (!schema) {
    return value;
  }

  const hydrated = applySchemaDefaults(schema, value);
  if (!hydrated || typeof hydrated !== "object" || Array.isArray(hydrated)) {
    return value;
  }

  return hydrated as Record<string, unknown>;
}
