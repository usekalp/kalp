import type { JsonSchema } from "@/effects/primitives";

/**
 * Validates a value against a JSON schema definition, collecting all validation errors.
 * Supports enum, object (required properties, nested validation), array, string,
 * number/integer, boolean, and null types.
 *
 * @param schema - An optional JSON schema to validate against.
 * @param value - The value to validate.
 * @param path - The dot-notation path prefix for error messages (e.g. "state").
 * @returns An array of validation error messages; empty if the value is valid.
 */
export function validateStateSchema(
  schema: Record<string, unknown> | undefined,
  value: unknown,
  path: string,
): string[] {
  if (!schema) return [];
  const node = schema as JsonSchema;
  const errors: string[] = [];

  if (node.enum) {
    if (!Array.isArray(node.enum) || !node.enum.includes(value)) {
      errors.push(`${path} must be one of ${JSON.stringify(node.enum)}`);
    }
    return errors;
  }

  switch (node.type) {
    case "object": {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        errors.push(`${path} must be an object`);
        return errors;
      }
      const record = value as Record<string, unknown>;
      const required = Array.isArray(node.required) ? node.required : [];
      const properties = node.properties ?? {};
      for (const key of required) {
        if (!(key in record)) {
          errors.push(`${path}.${key} is required`);
        }
      }
      for (const [key, childSchema] of Object.entries(properties)) {
        if (record[key] === undefined) continue;
        errors.push(...validateStateSchema(childSchema as Record<string, unknown>, record[key], `${path}.${key}`));
      }
      return errors;
    }
    case "array": {
      if (!Array.isArray(value)) {
        errors.push(`${path} must be an array`);
        return errors;
      }
      if (node.items) {
        value.forEach((item: unknown, index: number) => {
          errors.push(
            ...validateStateSchema(node.items as Record<string, unknown>, item, `${path}[${index}]`),
          );
        });
      }
      return errors;
    }
    case "string":
      if (typeof value !== "string") errors.push(`${path} must be a string`);
      return errors;
    case "number":
    case "integer":
      if (typeof value !== "number") errors.push(`${path} must be a number`);
      return errors;
    case "boolean":
      if (typeof value !== "boolean") errors.push(`${path} must be a boolean`);
      return errors;
    case "null":
      if (value !== null) errors.push(`${path} must be null`);
      return errors;
    default:
      return errors;
  }
}
