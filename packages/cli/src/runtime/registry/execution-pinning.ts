import type { RuntimeAgent, RuntimeDeployment } from "./types";

const DEFAULT_TTL_MS = 30 * 60 * 1000;

export class ExecutionPinning {
  pin(agentName: string, executionId: string, agents: Map<string, RuntimeAgent>): string {
    const agent = agents.get(agentName);
    if (!agent?.runtime) throw new Error(`No deployment for agent "${agentName}"`);

    agent.executionPins.set(executionId, agent.runtime.compiled.hash);
    return agent.runtime.compiled.hash;
  }

  unpin(agentName: string, executionId: string, agents: Map<string, RuntimeAgent>): void {
    const agent = agents.get(agentName);
    if (!agent) return;
    agent.executionPins.delete(executionId);
  }

  getDeploymentForExecution(
    agentName: string,
    executionId: string,
    agents: Map<string, RuntimeAgent>,
  ): RuntimeDeployment | null {
    const agent = agents.get(agentName);
    if (!agent) return null;

    const pinnedHash = agent.executionPins.get(executionId);
    if (!pinnedHash) return agent.runtime;

    const pinnedDeployment = agent.history.byHash.get(pinnedHash);
    return pinnedDeployment ?? agent.runtime;
  }

  cleanupExpired(agents: Map<string, RuntimeAgent>, now = Date.now()): void {
    for (const agent of agents.values()) {
      for (const [execId, hash] of agent.executionPins) {
        const deployment = agent.history.byHash.get(hash);
        if (!deployment) {
          agent.executionPins.delete(execId);
          continue;
        }
        if (now - deployment.loadedAt.getTime() > DEFAULT_TTL_MS) {
          agent.executionPins.delete(execId);
        }
      }
    }
  }
}
