import {
  analyzeHandler,
  calculateAgentHash,
  validateIR,
  validateIRBindings,
} from "@kalphq/compiler";
import type { IRGraph } from "@kalphq/sdk";

export interface NamedAnalysis {
  name: string;
  capabilities: string[];
  imports: { external: string[]; internal: string[] };
  blockers: string[];
  warnings: string[];
}

type IRWithBundles = IRGraph & {
  bundles?: Record<string, { code: string }>;
};

export function validateCompiledIR(input: {
  agentName: string;
  ir: IRWithBundles;
  hash: string;
}): {
  ok: boolean;
  phase?: "ir" | "bindings" | "hash" | "analysis";
  errors?: string[];
  blockers?: string[];
  analysis?: NamedAnalysis[];
} {
  const { ir, hash } = input;
  const bundles = ir.bundles || {};
  const bundleHashes = Object.keys(bundles);

  const irValidation = validateIR(ir);
  if (!irValidation.valid) {
    return { ok: false, phase: "ir", errors: irValidation.errors };
  }

  const bindingsValidation = validateIRBindings(ir, bundleHashes);
  if (!bindingsValidation.valid) {
    return { ok: false, phase: "bindings", errors: bindingsValidation.errors };
  }

  const handlers = bundleHashes.reduce(
    (acc, key) => ({ ...acc, [key]: { hash: key } }),
    {} as Record<string, { hash: string }>,
  );
  const expectedHash = calculateAgentHash(ir, handlers);

  if (expectedHash !== hash) {
    return {
      ok: false,
      phase: "hash",
      errors: [
        `Hash mismatch: client provided ${hash}, calculated ${expectedHash}`,
      ],
    };
  }

  const analysis: NamedAnalysis[] = Object.entries(bundles).map(
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
      errors: blockers.map((b) => `[Analysis Blocker] ${b}`),
      analysis,
    };
  }

  return { ok: true, analysis };
}
