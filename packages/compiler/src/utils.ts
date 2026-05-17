import { createHash } from "node:crypto";
import path from "node:path";
import { CRON_EXPRESSION_PATTERN } from "./constants";
import { sortKeys } from "./ir-generator";
import type { BundleTargetManifest, IRGraph, SchemaRegistry } from "@kalphq/sdk";
import type { getRegistry } from "@kalphq/sdk";

export { sortKeys } from "./ir-generator";

const ROUTE_STABLE_NAME_MAX_LENGTH = 96;

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

export function assertCronExpression(
  agentName: string,
  expression: string,
  index: number,
): void {
  if (!CRON_EXPRESSION_PATTERN.test(expression.trim())) {
    throw new Error(
      `Invalid cron expression for ${agentName}.cron[${index}]: "${expression}". Expected 5 space-separated fields.`,
    );
  }
}

export function assertUniqueRegistryIds(
  registry: ReturnType<typeof getRegistry>,
): void {
  const seen = new Set<string>();
  for (const [, entry] of registry.entries()) {
    if (seen.has(entry.id)) {
      throw new Error(`Duplicate node id: ${entry.id}`);
    }
    seen.add(entry.id);
  }
}

export function normalizeRelativeModulePath(
  filePath: string,
  projectRoot: string,
): string {
  const relative = filePath ? path.relative(projectRoot, filePath).replace(/\\/g, "/") : "";

  if (!relative) {
    return "./";
  }

  return relative.startsWith("./") ? relative : `./${relative}`;
}

export function hashString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashJson(value: unknown): string {
  return hashString(JSON.stringify(sortKeys(value)));
}

export function createSchemaId(schemaHash: string): string {
  return `schema_${schemaHash.slice(0, 12)}`;
}

export function createNodeId(
  kind: string,
  relativeModulePath: string,
  exportName: string,
): string {
  return `node_${hashString(`${kind}|${relativeModulePath}|${exportName}`).slice(0, 12)}`;
}

function sanitizeStableNameSegment(segment: string): string {
  return segment
    .toLowerCase()
    .trim()
    .replace(/[:*]+/g, ".")
    .replace(/[^a-z0-9/._-]+/g, "-")
    .replace(/[\\/]+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^-+|-+$/g, "")
    .replace(/^\.+|\.+$/g, "");
}

export function createBaseStableRouteName(method: string, routePath: string): string {
  const cleanPath = routePath.trim().replace(/^\/+|\/+$/g, "");
  const pathPart = cleanPath ? sanitizeStableNameSegment(cleanPath) : "root";
  return `route.${method.toLowerCase()}.${pathPart || "root"}`;
}

export function normalizeStableRouteName(
  method: string,
  routePath: string,
  existingStableNames: Set<string>,
): string {
  const base = createBaseStableRouteName(method, routePath);
  const routeHash = hashString(`${method}|${routePath}`).slice(0, 8);

  if (base.length <= ROUTE_STABLE_NAME_MAX_LENGTH && !existingStableNames.has(base)) {
    return base;
  }

  const truncatedBase =
    base.length > ROUTE_STABLE_NAME_MAX_LENGTH
      ? base.slice(0, ROUTE_STABLE_NAME_MAX_LENGTH - routeHash.length - 1).replace(/\.+$/g, "")
      : base;

  return `${truncatedBase}.${routeHash}`;
}

export function calculateSemanticHash(ir: IRGraph, schemas: SchemaRegistry): string {
  return hashJson({
    semanticIr: ir,
    schemas,
  });
}

export function calculateArtifactHash(targetManifest: BundleTargetManifest): string {
  return hashJson(targetManifest);
}

export function calculateDeploymentHash(
  semanticHash: string,
  artifactHash: string,
  abiVersion: number,
): string {
  return hashString(`${semanticHash}|${artifactHash}|${abiVersion}`);
}
