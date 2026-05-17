import type { AgentManifestV3 } from "@/utils/manifest/types";

export function getSemanticHash(manifest: Pick<AgentManifestV3, "artifactManifest">): string {
  return manifest.artifactManifest.semanticHash;
}

export function computePushHash(
  manifest: Pick<AgentManifestV3, "artifactManifest">,
  target = "default",
): string {
  const deploymentHash = manifest.artifactManifest.targets[target]?.deploymentHash;
  if (!deploymentHash) {
    throw new Error(`Missing deployment hash for target "${target}"`);
  }

  return deploymentHash;
}

