export {
  readRemoteAgentsIndex,
  writeRemoteAgentsIndex,
  pruneStaleRemoteAgents,
  type RemoteAgentIndexEntry,
  type PruneResult,
} from "./remote-index";

export {
  createInitialState,
  ensureAgentState,
  hydrateLocalAgentVersionsFromRemoteIndex,
} from "./agent-state";

export {
  pushRemoteManifest,
  type PushResult,
} from "./upload-manifest";
