import type { CompiledDeployment } from "../deployment/types";

export type ChangeType = "metadata" | "code";

export function detectChangeType(oldDeployment: CompiledDeployment, newDeployment: CompiledDeployment): ChangeType {
  const runtimeChanged = oldDeployment.runtimeHash !== newDeployment.runtimeHash;
  const bundlesChanged = oldDeployment.bundleHash !== newDeployment.bundleHash;

  if (runtimeChanged || bundlesChanged) {
    return "code";
  }
  return "metadata";
}
