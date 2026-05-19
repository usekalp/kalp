import type { SchemaRegistry } from "@kalphq/sdk";

export { applyStateDefaults } from "./schema-defaults";
export { validateStateSchema } from "./schema-validator";

/**
 * Resolves a schema from the registry by its identifier.
 *
 * @param schemaId - The schema identifier to look up (optional).
 * @param schemas - The schema registry to search in.
 * @returns The resolved schema object, or undefined if not found.
 */
export function resolveSchema(
  schemaId: string | undefined,
  schemas: SchemaRegistry,
): Record<string, unknown> | undefined {
  if (!schemaId) {
    return undefined;
  }

  return schemas[schemaId]?.schema;
}
