import type { IRGraph, SchemaRegistry } from "@kalphq/sdk";
import { deriveLabelFromName } from "./utils";

export function createAgentManifest(
  agentConfig: any,
  stateSchemaId?: string,
): IRGraph["agent"] {
  return {
    name: agentConfig.name,
    label: agentConfig.label ?? deriveLabelFromName(agentConfig.name),
    description: agentConfig.description,
    tags: Array.isArray(agentConfig.tags) ? [...agentConfig.tags] : undefined,
    skipAuth: typeof agentConfig.skipAuth === "boolean" ? agentConfig.skipAuth : undefined,
    systemPrompt: agentConfig.systemPrompt
      ? typeof agentConfig.systemPrompt === "function"
        ? { dynamic: true }
        : agentConfig.systemPrompt
      : undefined,
    ...(stateSchemaId ? { stateSchema: stateSchemaId } : {}),
  };
}

export function createSemanticIr(input: {
  agent: IRGraph["agent"];
  nodes: IRGraph["nodes"];
}): IRGraph {
  return {
    schemaVersion: 3,
    agent: input.agent,
    nodes: input.nodes,
  };
}

export function createEmptySchemas(): SchemaRegistry {
  return {};
}
