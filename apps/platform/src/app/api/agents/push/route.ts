import { NextResponse } from "next/server";
import {
  validateIR,
  validateIRBindings,
  analyzeHandler,
} from "@kalphq/compiler";
import { logPush, type NamedAnalysis } from "@/lib/logger";
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
    analysis,
    warnings: allWarnings,
  });
}
