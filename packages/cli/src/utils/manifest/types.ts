import type { IRGraph } from "@kalphq/sdk";

export interface AgentManifestV3 {
  format: "kalp-agent-manifest";
  schemaVersion: 3;
  ir: IRGraph & { bundles?: Record<string, { code: string }> };
  metadata?: {
    generatedAt?: string;
  };
}

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
