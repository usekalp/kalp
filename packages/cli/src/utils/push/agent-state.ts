import { join } from "node:path";
import type {
  ProjectAgentState,
  ProjectState,
} from "@/utils/project-state";

export function createInitialState(): ProjectState {
  return {
    workerUrl: null,
    deployedAt: null,
    accountId: null,
    studioCredentialsFingerprint: null,
    serviceKeyFingerprint: null,
    agents: {},
  };
}

export function ensureAgentState(
  state: ProjectState,
  agentName: string,
  localPath: string,
): ProjectAgentState {
  const existing = state.agents[agentName];
  if (existing) {
    existing.localPath = localPath;
    return existing;
  }

  const created: ProjectAgentState = {
    currentHash: null,
    currentVersion: 0,
    lastLocalHash: null,
    lastRemoteHash: null,
    lastPushedAt: null,
    localPath,
    workerUrl: state.workerUrl
      ? `${state.workerUrl.replace(/\/$/, "")}/a/${agentName}`
      : null,
  };
  state.agents[agentName] = created;
  return created;
}

export function hydrateLocalAgentVersionsFromRemoteIndex(params: {
  state: ProjectState;
  remoteEntries: Array<{
    name: string;
    hash: string;
    versionNumber: number | null;
    updatedAt: string;
    workerUrl: string | null;
  }>;
  cwd: string;
}): void {
  const byName = new Map(params.remoteEntries.map((entry) => [entry.name, entry]));

  for (const [agentName, agentState] of Object.entries(params.state.agents)) {
    const remote = byName.get(agentName);
    if (!remote) continue;

    if (agentState.currentVersion <= 0 && remote.versionNumber) {
      agentState.currentVersion = remote.versionNumber;
    }
    if (!agentState.lastRemoteHash && remote.hash) {
      agentState.lastRemoteHash = remote.hash;
    }
    if (!agentState.currentHash && remote.hash) {
      agentState.currentHash = remote.hash;
    }
    if (!agentState.lastPushedAt && remote.updatedAt) {
      agentState.lastPushedAt = remote.updatedAt;
    }
    if (!agentState.workerUrl && remote.workerUrl) {
      agentState.workerUrl = remote.workerUrl;
    }
    if (!agentState.localPath) {
      agentState.localPath = join(params.cwd, "agents", agentName, "index.ts");
    }
  }
}
