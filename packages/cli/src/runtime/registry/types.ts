import type { LoadedModule } from "../loader/types";
import type { CompiledDeployment } from "../deployment/types";

export interface NodeIndexEntry {
  agentName: string;
  deploymentHash: string;
  module: LoadedModule;
}

export interface RuntimeDeployment {
  compiled: CompiledDeployment;
  moduleLoaders: Map<string, () => Promise<LoadedModule>>;
  moduleCache: Map<string, LoadedModule>;
  generation: number;
  loadedAt: Date;
}

export interface DeploymentHistory {
  byHash: Map<string, RuntimeDeployment>;
  activePins: Map<string, Set<string>>;
  maxRetained: number;
  ttlMs: number;
}

export interface RuntimeAgent {
  name: string;
  runtime: RuntimeDeployment | null;
  history: DeploymentHistory;
  executionPins: Map<string, string>;
}
