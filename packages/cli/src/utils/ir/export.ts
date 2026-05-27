import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentManifestV3 } from "@/utils/manifest/types";

export async function exportCompiledIrForDebug(params: {
  cwd: string;
  agentName: string;
  manifest: AgentManifestV3;
}): Promise<string> {
  const { cwd, agentName, manifest } = params;
  const outDir = join(cwd, ".kalp", "exports", agentName, "artifacts");
  const bundlesDir = join(outDir, "targets", "default", "bundles");

  await mkdir(bundlesDir, { recursive: true });

  await writeFile(
    join(outDir, "artifact-manifest.json"),
    `${JSON.stringify(manifest.artifactManifest, null, 2)}\n`,
    "utf-8",
  );
  await writeFile(
    join(outDir, "semantic-ir.json"),
    `${JSON.stringify(manifest.semanticIr, null, 2)}\n`,
    "utf-8",
  );
  await writeFile(
    join(outDir, "schemas.json"),
    `${JSON.stringify(manifest.schemas, null, 2)}\n`,
    "utf-8",
  );
  await writeFile(
    join(outDir, "bundle-manifest.json"),
    `${JSON.stringify(manifest.bundleManifest, null, 2)}\n`,
    "utf-8",
  );

  if (manifest.sourceMetadata) {
    await writeFile(
      join(outDir, "source-metadata.json"),
      `${JSON.stringify(manifest.sourceMetadata, null, 2)}\n`,
      "utf-8",
    );
  }

  for (const [bundleHash, bundle] of Object.entries(manifest.bundles)) {
    const fileName = bundle.file.split("/").pop() ?? `${bundleHash}.js`;
    await writeFile(join(bundlesDir, fileName), bundle.code, "utf-8");
  }

  return outDir;
}
