import { NextResponse } from "next/server";
import {
  validateIR,
  validateIRBindings,
  analyzeHandler,
  calculateAgentHash,
} from "@kalphq/compiler";
import { logPush, type NamedAnalysis } from "@/lib/logger";
import { getAgentHash, storeAgentVersion } from "@/lib/agent-store";
import fs from "node:fs";

export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;

  const agentName = body.agentName as string | undefined;
  const ir = body.ir as
    | {
        bundles?: Record<string, { code: string; type?: string }>;
      }
    | undefined;
  const hash = body.hash as string | undefined;

  // IR V3: handlers are in ir.bundles, not a separate bundle object
  const bundles = ir?.bundles || {};
  const bundleHashes = Object.keys(bundles);

  if (!agentName || !ir || !hash || bundleHashes.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        phase: "parse",
        errors: ["Missing required fields: Agent Name, IR, Hash, Handlers"],
      },
      { status: 400 },
    );
  }

  const irValidation = validateIR(ir);
  if (!irValidation.valid) {
    return NextResponse.json(
      { ok: false, phase: "ir", errors: irValidation.errors },
      { status: 400 },
    );
  }

  const irGraph = ir as Parameters<typeof validateIRBindings>[0];

  // Validate that all bundle hashes are properly registered in entries
  const bindingValidation = validateIRBindings(irGraph, bundleHashes);
  if (!bindingValidation.valid) {
    return NextResponse.json(
      { ok: false, phase: "bindings", errors: bindingValidation.errors },
      { status: 400 },
    );
  }

  // Build handlers map from ir.bundles for hash calculation
  const handlers = bundleHashes.reduce(
    (acc, hash) => ({
      ...acc,
      [hash]: { hash },
    }),
    {} as Record<string, { hash: string }>,
  );

  // Re-calculate hash from IR + handlers for security validation
  const calculatedHash = calculateAgentHash(ir, handlers);

  // Security check: verify client-provided hash matches calculated hash
  if (hash !== calculatedHash) {
    return NextResponse.json(
      {
        ok: false,
        phase: "hash",
        errors: [
          `Hash mismatch: client provided ${hash}, but calculated ${calculatedHash}`,
        ],
      },
      { status: 400 },
    );
  }

  // Check idempotency: compare with stored hash
  const storedHash = getAgentHash(agentName);
  if (storedHash === hash) {
    // Idempotent: no change, return success without creating new version
    return NextResponse.json({
      ok: true,
      hash,
      unchanged: true,
      analysis: [],
      warnings: [],
    });
  }

  // Hash differs, analyze handlers and create new version
  const analysis: NamedAnalysis[] = Object.entries(bundles).map(
    ([name, bundle]) => ({
      name,
      ...analyzeHandler(bundle.code),
    }),
  );

  const allWarnings = analysis.flatMap((a) => [
    ...a.warnings.map((w) => `${w} in ${a.name}`),
    ...a.blockers.map((b) => `[Analysis Blocker] ${b} in ${a.name}`),
  ]);

  logPush({
    agentName,
    hash,
    validation: {
      ir: irValidation,
      bindings: bindingValidation,
    },
    analysis,
    timestamp: new Date().toISOString(),
  });

  // Store the new version in agent-store
  storeAgentVersion(agentName, hash);

  // Export the full agent pack (IR with bundles) to a single JSON for debugging/archival
  try {
    fs.writeFileSync("agent-pack.json", JSON.stringify(ir, null, 2));
  } catch (e) {
    console.error("Failed to export agent-pack.json", e);
  }

  return NextResponse.json({
    ok: true,
    hash,
    unchanged: false,
    isNewVersion: true,
    analysis,
    warnings: allWarnings,
  });
}
