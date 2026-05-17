import { readLocalAgentNames } from "@/utils/runtime";

export async function resolveAffectedAgents(_changedPath: string, cwd: string): Promise<string[]> {
  // For now, recompile all agents on any change.
  // Future: incremental compilation based on which files changed.
  return readLocalAgentNames(cwd);
}
