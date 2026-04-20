import type { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export interface AgentManifestV1 {
  format: "kalp-agent-manifest";
  schemaVersion: 1;
  generatedAt: string;
  codeHash: string;
  agent: {
    id?: string;
    name: string;
    description: string;
    systemPrompt:
      | { type: "static"; value: string }
      | { type: "dynamic" }
      | { type: "none" };
    lifecycle: {
      onInit: boolean;
      onMessage: boolean;
      onTick: boolean;
    };
    actions: {
      ai: boolean;
      wait: boolean;
      fetch: boolean;
      runStep: boolean;
      callTool: boolean;
      runFlow: boolean;
    };
    steps: Array<{
      id: string;
      order: number;
      description: string;
      inputSchema: Record<string, unknown> | null;
      outputSchema: Record<string, unknown> | null;
    }>;
    tools: Array<{
      id: string;
      order: number;
      description: string;
      inputSchema: Record<string, unknown> | null;
    }>;
    routes: Array<{
      id: string;
      order: number;
      method: string;
      path: string;
      inputSchema: Record<string, unknown> | null;
    }>;
    flows: Array<{
      id: string;
      order: number;
      description: string;
      steps: Array<{
        order: number;
        stepId: string;
        existsInAgentSteps: boolean;
      }>;
    }>;
    execution: {
      stepOrder: string[];
      toolOrder: string[];
      routeOrder: string[];
      flowOrder: string[];
    };
  };
}

export interface ManifestVersionRecord {
  version: number;
  versionId: string;
  hash: string;
  generatedAt: string;
  immutable: true;
  manifest: AgentManifestV1;
}

export interface ManifestRegistryEntry {
  latest: string;
  versions: string[];
}

export interface LoadedAgentModule {
  agent: unknown;
  tempDir: string;
}

export interface AgentItemWithInput {
  id?: unknown;
  description?: unknown;
  input?: unknown;
}

export interface AgentStepItem extends AgentItemWithInput {
  output?: unknown;
}

export interface AgentRouteItem extends AgentItemWithInput {
  method?: unknown;
  path?: unknown;
}

export interface AgentFlowItem {
  id?: unknown;
  description?: unknown;
  steps?: unknown;
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

export function toJsonSchema(
  schema: unknown,
  name: string,
): Record<string, unknown> | null {
  try {
    return zodToJsonSchema(schema as ZodTypeAny, name) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}
