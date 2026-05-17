import {
  analyzeHandler,
  calculateArtifactHash,
  calculateDeploymentHash,
  calculateSemanticHash,
  validateIR,
  validateIRBindings,
} from "@kalphq/compiler";
import type { AgentManifestV3 } from "@/utils/manifest/types";

export interface NamedAnalysis {
  name: string;
  capabilities: string[];
  imports: { external: string[]; internal: string[] };
  blockers: string[];
  warnings: string[];
}

export function validateCompiledIR(input: {
  agentName: string;
  manifest: AgentManifestV3;
  hash: string;
  target?: string;
}): {
  ok: boolean;
  phase?: "ir" | "bindings" | "hash" | "analysis";
  errors?: string[];
  blockers?: string[];
  analysis?: NamedAnalysis[];
} {
  const { manifest, hash, target = "default" } = input;
  const targetManifest = manifest.bundleManifest.targets[target];

  const irValidation = validateIR(manifest.semanticIr);
  if (!irValidation.valid) {
    return { ok: false, phase: "ir", errors: irValidation.errors };
  }

  if (!targetManifest) {
    return {
      ok: false,
      phase: "bindings",
      errors: [`Missing bundle target manifest for "${target}"`],
    };
  }

  const bindingsValidation = validateIRBindings(
    manifest.semanticIr,
    manifest.bundleManifest,
    manifest.schemas,
  );
  if (!bindingsValidation.valid) {
    return { ok: false, phase: "bindings", errors: bindingsValidation.errors };
  }

  const semanticHash = calculateSemanticHash(manifest.semanticIr, manifest.schemas);
  const artifactHash = calculateArtifactHash(targetManifest);
  const deploymentHash = calculateDeploymentHash(
    semanticHash,
    artifactHash,
    manifest.artifactManifest.targets[target]?.abiVersion ?? targetManifest.abiVersion,
  );

  if (deploymentHash !== hash) {
    return {
      ok: false,
      phase: "hash",
      errors: [`Hash mismatch: client provided ${hash}, calculated ${deploymentHash}`],
    };
  }

  const analysis: NamedAnalysis[] = Object.entries(manifest.bundles).map(
    ([name, bundle]) => ({
      name,
      ...analyzeHandler(bundle.code),
    }),
  );

  const blockers = analysis.flatMap((entry) =>
    entry.blockers.map((blocker) => `${blocker} in ${entry.name}`),
  );

  if (blockers.length > 0) {
    return {
      ok: false,
      phase: "analysis",
      blockers,
      errors: blockers.map((blocker) => `[Analysis Blocker] ${blocker}`),
      analysis,
    };
  }

  return { ok: true, analysis };
}

