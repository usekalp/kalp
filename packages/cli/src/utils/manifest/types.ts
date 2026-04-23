import type { IRGraph } from "@kalphq/sdk";
import type { HandlerMap } from "@/utils/manifest/handlers";

export interface AgentManifestV2 {
  format: "kalp-agent-manifest";
  schemaVersion: 2;
  codeHash: string;
  ir: IRGraph;
  handlers: HandlerMap;
  metadata?: {
    generatedAt?: string;
  };
}

export interface LoadedAgentModule {
  agent: unknown;
  tempDir: string;
  codeHash: string;
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
