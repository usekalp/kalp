import { createHash } from "crypto";
import type { z } from "zod";
import { buildSchemaIR, sortKeys } from "./ir-generator";
export { sortKeys };
import type { getRegistry } from "@kalphq/sdk";
import { CRON_EXPRESSION_PATTERN } from "./constants";

export function deriveLabelFromName(name: string): string {
  return name
    .split(/[_-]+/g)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

export function isSdkInternalPath(filePath?: string): boolean {
  if (!filePath) return false;
  const normalized = filePath.replace(/\\/g, "/");
  return (
    normalized.includes("/node_modules/@kalphq/sdk/") ||
    normalized.includes("/packages/sdk/")
  );
}

export function assertCronExpression(agentName: string, expression: string, index: number): void {
  if (!CRON_EXPRESSION_PATTERN.test(expression.trim())) {
    throw new Error(
      `Invalid cron expression for ${agentName}.cron[${index}]: "${expression}". Expected 5 space-separated fields.`,
    );
  }
}

export function serializeEmits(
  agentName: string,
  emits: Record<string, z.ZodTypeAny | string> | undefined,
) {
  if (!emits) return undefined;
  const serialized: Record<
    string,
    { type: "schema"; schema: unknown } | { type: "description"; description: string }
  > = {};

  for (const [eventName, schemaOrDescription] of Object.entries(emits)) {
    if (typeof schemaOrDescription === "string") {
      serialized[eventName] = {
        type: "description",
        description: schemaOrDescription,
      };
      continue;
    }

    try {
      const { schema, meta } = buildSchemaIR(schemaOrDescription);
      if (meta.hasRefinements) {
        throw new Error("Schema contains non-portable refinements");
      }
      serialized[eventName] = {
        type: "schema",
        schema,
      };
    } catch (error) {
      console.warn(
        `[kalp compiler] Could not serialize emits.${eventName} for agent "${agentName}". Falling back to description.`,
      );
      serialized[eventName] = {
        type: "description",
        description: "Non-serializable schema",
      };
    }
  }

  return serialized;
}

export function assertUniqueIds(registry: ReturnType<typeof getRegistry>) {
  const seen = new Set<string>();
  for (const [_key, entry] of registry.entries()) {
    if (seen.has(entry.id)) {
      throw new Error(`Duplicate node id: ${entry.id}`);
    }
    seen.add(entry.id);
  }
}

export function getSdkVersion(): string {
  try {
    // String-based require to avoid esbuild trying to resolve at build time
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const require = (0, eval)("require");
    const pkgPath = require.resolve("@kalphq/sdk/package.json");
    const pkg = require(pkgPath);
    return pkg.version;
  } catch {
    return "unknown";
  }
}

export function getCompilerVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const require = (0, eval)("require");
    const pkgPath = require.resolve("@kalphq/compiler/package.json");
    const pkg = require(pkgPath);
    return pkg.version;
  } catch {
    return "unknown";
  }
}

export function calculateIRHash(ir: any): string {
  const sortedIR = sortKeys(ir);
  return createHash("sha256").update(JSON.stringify(sortedIR)).digest("hex");
}

export function calculateAgentHash(
  ir: any,
  handlers: Record<string, { hash: string }>,
): string {
  const irWithoutMeta = { ...ir };
  delete irWithoutMeta.meta;
  delete irWithoutMeta.irHash;

  const sortedIR = sortKeys(irWithoutMeta);
  const irHash = createHash("sha256")
    .update(JSON.stringify(sortedIR))
    .digest("hex");

  const sortedHandlerHashes = Object.keys(handlers)
    .sort()
    .map((k) => handlers[k]!.hash)
    .join("|");

  return createHash("sha256")
    .update(irHash + "|" + sortedHandlerHashes)
    .digest("hex");
}
