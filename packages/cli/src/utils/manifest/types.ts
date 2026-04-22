import type { IRGraph } from "@kalphq/sdk";

export interface AgentManifestV2 {
  format: "kalp-agent-manifest";
  schemaVersion: 2;
  codeHash: string;
  ir: IRGraph;
  bundle: {
    entry: string;
    hash: string;
  };
  metadata?: {
    generatedAt?: string;
  };
}

export interface LoadedAgentModule {
  agent: unknown;
  entry: string;
  tempDir: string;
  codeHash: string;
}

// ─── Utility helpers ─────────────────────────────────────────────────────────

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
