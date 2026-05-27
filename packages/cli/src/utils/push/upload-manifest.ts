import type { AgentManifestV3 } from "@/utils/manifest";
import { resolveProvider } from "@/utils/providers";

export interface PushResult {
  pushed: number;
  skipped: number;
  failed: number;
}

export async function pushRemoteManifest(params: {
  cwd: string;
  wranglerConfigPath: string;
  agentName: string;
  hash: string;
  manifest: AgentManifestV3;
}): Promise<void> {
  const { cwd, wranglerConfigPath, agentName, hash, manifest } = params;
  const provider = resolveProvider();

  const values: Array<{ key: string; value: string }> = [
    {
      key: `${agentName}:${hash}:artifact-manifest`,
      value: JSON.stringify(manifest.artifactManifest),
    },
    {
      key: `${agentName}:${hash}:semantic-ir`,
      value: JSON.stringify(manifest.semanticIr),
    },
    {
      key: `${agentName}:${hash}:schemas`,
      value: JSON.stringify(manifest.schemas),
    },
    {
      key: `${agentName}:${hash}:bundle-manifest`,
      value: JSON.stringify(manifest.bundleManifest),
    },
  ];

  for (const [bundleHash, bundle] of Object.entries(manifest.bundles)) {
    values.push({
      key: `${agentName}:${hash}:bundle:${bundleHash}`,
      value: bundle.code,
    });
  }

  if (manifest.sourceMetadata) {
    values.push({
      key: `${agentName}:${hash}:source-metadata`,
      value: JSON.stringify(manifest.sourceMetadata),
    });
  }

  values.push({
    key: `${agentName}:latest`,
    value: hash,
  });

  if (provider.putBulkValues) {
    await provider.putBulkValues({
      cwd,
      configPath: wranglerConfigPath,
      values,
    });
    return;
  }

  for (const item of values) {
    await provider.putValue({
      cwd,
      configPath: wranglerConfigPath,
      key: item.key,
      value: item.value,
    });
  }
}
