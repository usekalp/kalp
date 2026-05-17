import fs from "node:fs";
import path from "node:path";
import type {
  ArtifactManifest,
  BundleManifest,
  IRGraph,
  SchemaRegistry,
} from "@kalphq/sdk";

export async function executeBundleFromCode(code: string) {
  const dataUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`;
  const mod = (await import(dataUrl)) as { default: (...args: any[]) => Promise<unknown> | unknown };
  return mod.default;
}

export function readCompiledArtifacts(outDir: string): {
  artifactManifest: ArtifactManifest;
  semanticIr: IRGraph;
  schemas: SchemaRegistry;
  bundleManifest: BundleManifest;
  bundles: Record<string, string>;
} {
  const artifactsDir = path.join(outDir, ".kalp", "artifacts");
  const artifactManifest = JSON.parse(
    fs.readFileSync(path.join(artifactsDir, "artifact-manifest.json"), "utf-8"),
  ) as ArtifactManifest;
  const semanticIr = JSON.parse(
    fs.readFileSync(path.join(artifactsDir, "semantic-ir.json"), "utf-8"),
  ) as IRGraph;
  const schemas = JSON.parse(
    fs.readFileSync(path.join(artifactsDir, "schemas.json"), "utf-8"),
  ) as SchemaRegistry;
  const bundleManifest = JSON.parse(
    fs.readFileSync(path.join(artifactsDir, "bundle-manifest.json"), "utf-8"),
  ) as BundleManifest;

  const bundles: Record<string, string> = {};
  for (const binding of Object.values(bundleManifest.targets.default?.nodes ?? {}) as Array<{
    bundle: string;
    file: string;
  }>) {
    if (bundles[binding.bundle]) continue;
    bundles[binding.bundle] = fs.readFileSync(
      path.join(artifactsDir, binding.file.replace(/^\.\//, "").replace(/\//g, path.sep)),
      "utf-8",
    );
  }

  return {
    artifactManifest,
    semanticIr,
    schemas,
    bundleManifest,
    bundles,
  };
}
