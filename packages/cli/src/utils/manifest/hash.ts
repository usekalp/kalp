import type { AgentManifestV2 } from "@/utils/manifest/types";

export function getManifestHash(manifest: AgentManifestV2): string {
  return manifest.codeHash;
}
