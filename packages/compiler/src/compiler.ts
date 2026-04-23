import type {
  EntryIRNode,
  RouteEntryIRNode,
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
  const routes = asArray(raw.routes);

  const createId = createIdGenerator();
  const nodes: IRGraph["nodes"] = {};
  const edges: IREdge[] = [];
  const entries: IRGraph["entries"] = {};

  // ── Create EntryIRNode for onMessage ────────────────────────────────────
  const entryId = createId("entry");
  const entryNode: EntryIRNode = {
    kind: "entry",
    id: entryId,
    handler: "onMessage",
  };
  nodes[entryId] = entryNode;
  entries["onMessage"] = entryId;

  // ── Register onInit / onTick if present ─────────────────────────────────
  for (const lifecycle of ["onInit", "onTick"] as const) {
    if (raw[lifecycle] != null) {
      const lcId = createId("entry");
      const lcNode: EntryIRNode = {
        kind: "entry",
        id: lcId,
        handler: lifecycle,
      };
      nodes[lcId] = lcNode;
      entries[lifecycle] = lcId;
    }
  }

  // ── Register routes as entry nodes (metadata only, no execution wiring) ─
  for (const route of routes) {
    const rec = asRecord(route);
    if (!rec) continue;
    const path = asString(rec.path) ?? "/unknown";
    const method = (
      asString(rec.method) ?? "GET"
    ).toUpperCase() as RouteEntryIRNode["method"];
    const routeId = createId("entry");
    const routeNode: RouteEntryIRNode = {
      kind: "entry",
      id: routeId,
      handler: `route:${method}:${path}`,
      method,
      path,
    };
    nodes[routeId] = routeNode;
    entries[`route:${method}:${path}`] = routeId;
  }

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

  // ── Flows: expand inline (no targetKind:"flow" in IR) ───────────────────
  for (const flow of flows) {
    const rec = asRecord(flow);
    if (!rec) continue;
    const flowSteps = asArray(rec.steps);
    if (flowSteps.length === 0) continue;
    for (const fs of flowSteps) {
      const frec = asRecord(fs);
      if (frec) runSequence.push(registerRun(frec, "step"));
    }
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
    entries,
    nodes,
    edges,
  };

  return normalizeGraph(graph);
};
