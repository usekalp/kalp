import type { RuntimeDeployment, DeploymentHistory } from "./types";

export class DeploymentHistoryManager {
  create(): DeploymentHistory {
    return {
      byHash: new Map(),
      activePins: new Map(),
      maxRetained: 5,
      ttlMs: 5 * 60 * 1000,
    };
  }

  register(history: DeploymentHistory, hash: string, deployment: RuntimeDeployment): void {
    history.byHash.set(hash, deployment);
    if (!history.activePins.has(hash)) history.activePins.set(hash, new Set());
  }

  trackPin(history: DeploymentHistory, hash: string, executionId: string): void {
    if (!history.activePins.has(hash)) history.activePins.set(hash, new Set());
    history.activePins.get(hash)!.add(executionId);
  }

  untrackPin(history: DeploymentHistory, hash: string, executionId: string): void {
    history.activePins.get(hash)?.delete(executionId);
  }

  prune(history: DeploymentHistory): void {
    const entries = Array.from(history.byHash.entries());
    if (entries.length <= history.maxRetained) return;

    const sorted = entries.sort((a, b) => a[1].generation - b[1].generation);
    const toRemove = sorted.length - history.maxRetained;

    let removed = 0;
    for (const [hash, deployment] of sorted) {
      if (removed >= toRemove) break;

      const activePins = history.activePins.get(hash);
      if (activePins && activePins.size > 0) continue;

      const age = Date.now() - deployment.loadedAt.getTime();
      if (age < history.ttlMs) continue;

      history.byHash.delete(hash);
      history.activePins.delete(hash);
      removed++;
    }
  }
}
