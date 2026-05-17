import type { RestartReason } from "../types";
import type { CompiledDeployment } from "../deployment/types";

export interface ReloadPlan {
  compiledAgents: Map<string, CompiledDeployment>;
  restartRequired: boolean;
  restartReason: RestartReason | null;
  rematerialize: boolean;
}
