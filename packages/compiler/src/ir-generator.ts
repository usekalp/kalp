import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodTypeAny } from "zod";

export interface IRNodeMeta {
  hasRefinements: boolean;
}

function hasZodRefinements(schema: any): boolean {
  if (!schema) return false;
  if (schema._def?.typeName === "ZodEffects") return true;
  if (schema._def?.innerType) return hasZodRefinements(schema._def.innerType);
  return false;
}

export function buildSchemaIR(schema?: ZodTypeAny): { schema: any; meta: IRNodeMeta } {
  if (!schema) {
    return {
      schema: { type: "object", properties: {} },
      meta: { hasRefinements: false },
    };
  }

  const jsonSchema = zodToJsonSchema(schema, { target: "jsonSchema7" });
  
  // zodToJsonSchema returns a root object with definitions if complex, or direct schema.
  // We'll extract the schema directly.
  let cleanSchema = jsonSchema;
  if ("$schema" in cleanSchema) {
    delete (cleanSchema as any).$schema;
  }

  return {
    schema: cleanSchema,
    meta: {
      hasRefinements: hasZodRefinements(schema),
    },
  };
}

export function sortKeys(obj: any): any {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return obj;
  }
  return Object.keys(obj)
    .sort()
    .reduce((result: any, key: string) => {
      result[key] = sortKeys(obj[key]);
      return result;
    }, {});
}
