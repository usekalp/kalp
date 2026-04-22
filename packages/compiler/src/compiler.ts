import type {
  EntryIRNode,
  IRGraph,
  IREdge,
  IRNodeId,
  RunIRNode,
  RunTargetKind,
} from "@kalphq/sdk";
import { zodToJsonSchema } from "zod-to-json-schema";
import { createIdGenerator } from "@/ids";
import { normalizeGraph } from "@/normalize";

// ─── Helpers for parsing raw agent config ────────────────────────────────────

const asRecord = (v: unknown): Record<string, unknown> | undefined =>
  v != null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;

const asString = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const isZodSchema = (v: unknown): boolean =>
  v != null && typeof v === "object" && typeof (v as any)._def === "object";

const tryJsonSchema = (v: unknown): Record<string, unknown> | undefined => {
  if (!isZodSchema(v)) return undefined;
  try {
    return zodToJsonSchema(v as any) as Record<string, unknown>;
  } catch {
    return undefined;
  }
};

// ─── Compiler ────────────────────────────────────────────────────────────────

export const compileAgent = async (agent: unknown): Promise<IRGraph> => {
  const raw = asRecord(agent);
  if (!raw) {
    throw new Error("compileAgent: agent must be an object.");
  }

  const agentId = asString(raw.id) ?? asString(raw.name) ?? "unknown";
  const steps = asArray(raw.steps);
  const tools = asArray(raw.tools);
  const flows = asArray(raw.flows);

  const createId = createIdGenerator();
  const nodes: IRGraph["nodes"] = {};
  const edges: IREdge[] = [];

  // ── Create EntryIRNode for onMessage ────────────────────────────────────
  const entryId = createId("entry");
  const entryNode: EntryIRNode = {
    kind: "entry",
    id: entryId,
    handler: "onMessage",
  };
  nodes[entryId] = entryNode;

  // ── Register run nodes ──────────────────────────────────────────────────
  const registerRun = (
    item: Record<string, unknown>,
    targetKind: RunTargetKind,
  ): IRNodeId => {
    const id = createId("run");
    const targetId = asString(item.id) ?? "unknown";
    const node: RunIRNode = {
      kind: "run",
      id,
      targetId,
      targetKind,
      inputSchema: tryJsonSchema(item.inputSchema ?? item.input),
      outputSchema: tryJsonSchema(item.outputSchema ?? item.output),
    };
    nodes[id] = node;
    return id;
  };

  const runSequence: IRNodeId[] = [];

  for (const step of steps) {
    const rec = asRecord(step);
    if (rec) runSequence.push(registerRun(rec, "step"));
  }
  for (const tool of tools) {
    const rec = asRecord(tool);
    if (rec) runSequence.push(registerRun(rec, "tool"));
  }
  for (const flow of flows) {
    const rec = asRecord(flow);
    if (rec) runSequence.push(registerRun(rec, "flow"));
  }

  if (runSequence.length === 0) {
    runSequence.push(registerRun({ id: agentId }, "step"));
  }

  // ── Wire entry → first run node ────────────────────────────────────────
  edges.push({ from: entryId, to: runSequence[0]! });

  // ── Wire sequential run nodes ──────────────────────────────────────────
  for (let i = 0; i < runSequence.length - 1; i += 1) {
    edges.push({ from: runSequence[i]!, to: runSequence[i + 1]! });
  }

  const graph: IRGraph = {
    agentId,
    entries: { onMessage: entryId },
    nodes,
    edges,
  };

  return normalizeGraph(graph);
};
