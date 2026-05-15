import { deriveLabelFromName } from "./utils";

export function createAgentManifest(agentConfig: any): any {
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
  };
}
