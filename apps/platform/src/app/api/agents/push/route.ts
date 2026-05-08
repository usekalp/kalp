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
  const ir = body.ir;
  const hash = body.hash as string | undefined;
  const bundle = body.bundle as
    | {
        handlers?: Record<string, { code: string; hash: string; size: number }>;
      }
    | undefined;

  if (!agentName || !ir || !hash || !bundle?.handlers) {
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

  const handlerNames = Object.keys(bundle.handlers);
  const bindingValidation = validateIRBindings(irGraph, handlerNames);
  if (!bindingValidation.valid) {
    return NextResponse.json(
      { ok: false, phase: "bindings", errors: bindingValidation.errors },
      { status: 400 },
    );
  }

  // Re-calculate hash from IR + handlers for security validation
  const calculatedHash = calculateAgentHash(ir, bundle.handlers);

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
  const analysis: NamedAnalysis[] = Object.entries(bundle.handlers).map(
    ([name, handler]) => ({
      name,
      ...analyzeHandler(handler.code),
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

  // Export the full agent pack (IR + Bundled Handlers) to a single JSON for debugging/archival
  try {
    const agentPack = {
      ...ir,
      bundle,
    };
    fs.writeFileSync("agent-pack.json", JSON.stringify(agentPack, null, 2));
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
