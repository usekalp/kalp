import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type {
  ArtifactManifest,
  BundleManifest,
  IRGraph,
  SchemaRegistry,
} from "@kalphq/sdk";
import type { AgentManifestV3 } from "@/utils/manifest/types";
import { buildAgent, type SourceMetadataManifest } from "@kalphq/compiler";

export type { AgentManifestV3 } from "@/utils/manifest/types";
export { computePushHash } from "@/utils/ir/hashIR";

async function compileAgent(params: {
  agentPath: string;
  tempOutDir: string;
  cwd: string;
}): Promise<void> {
  await buildAgent(params.agentPath, params.tempOutDir, params.cwd, {
    includeDebug: false,
  });
}

async function loadJson<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content) as T;
}

export async function readAgentManifest(params: {
  cwd: string;
  agentName: string;
}): Promise<AgentManifestV3> {
  const { cwd, agentName } = params;
  const agentPath = join(cwd, "agents", agentName, "index.ts");
  await access(agentPath);

  const tempOutDir = await mkdtemp(join(tmpdir(), "kalp-build-"));

  try {
    await compileAgent({ agentPath, tempOutDir, cwd });

    const artifactsDir = join(tempOutDir, ".kalp", "artifacts");
    const artifactManifest = await loadJson<ArtifactManifest>(
      join(artifactsDir, "artifact-manifest.json"),
    );
    const semanticIr = await loadJson<IRGraph>(
      join(artifactsDir, "semantic-ir.json"),
    );
    const schemas = await loadJson<SchemaRegistry>(
      join(artifactsDir, "schemas.json"),
    );
    const bundleManifest = await loadJson<BundleManifest>(
      join(artifactsDir, "bundle-manifest.json"),
    );

    let sourceMetadata: SourceMetadataManifest | undefined;
    try {
      sourceMetadata = await loadJson<SourceMetadataManifest>(
        join(artifactsDir, "source-metadata.json"),
      );
    } catch {
      // source-metadata.json is optional — only present when source analysis ran
    }

    const bundles: AgentManifestV3["bundles"] = {};
    const targetBundles = bundleManifest.targets.default?.nodes ?? {};

    for (const binding of Object.values(targetBundles)) {
      if (bundles[binding.bundle]) {
        continue;
      }

      const filePath = join(
        artifactsDir,
        binding.file.replace(/^\.\//, "").replace(/\//g, "\\"),
      );
      bundles[binding.bundle] = {
        file: binding.file,
        code: await readFile(filePath, "utf-8"),
        size: binding.size,
        sha256: binding.sha256,
      };
    }

    return {
      format: "kalp-agent-manifest",
      schemaVersion: 3,
      artifactManifest,
      semanticIr,
      schemas,
      bundleManifest,
      bundles,
      sourceMetadata,
      metadata: {
        generatedAt: new Date().toISOString(),
      },
    };
  } finally {
    await rm(tempOutDir, { recursive: true, force: true });
  }
}
