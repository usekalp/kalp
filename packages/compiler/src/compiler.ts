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
import { toHandlerKey } from "@/handler-key";
import { recordHandler } from "@/record-handler";
import { traceToIR } from "@/trace-to-ir";

// Helpers for parsing raw agent config

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

// Schema registry: maps "steps.id" → { inputSchema, outputSchema }
type SchemaEntry = {
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
};

function buildSchemaRegistry(
  steps: unknown[],
  tools: unknown[],
  flows: unknown[],
): Map<string, SchemaEntry> {
  const registry = new Map<string, SchemaEntry>();

  for (const step of steps) {
    const rec = asRecord(step);
    if (!rec) continue;
    const id = asString(rec.id);
    if (!id) continue;
    registry.set(toHandlerKey("step", id), {
      inputSchema: tryJsonSchema(rec.inputSchema ?? rec.input),
      outputSchema: tryJsonSchema(rec.outputSchema ?? rec.output),
    });
  }

  for (const tool of tools) {
    const rec = asRecord(tool);
    if (!rec) continue;
    const id = asString(rec.id);
    if (!id) continue;
    registry.set(toHandlerKey("tool", id), {
      inputSchema: tryJsonSchema(rec.inputSchema ?? rec.input),
      outputSchema: tryJsonSchema(rec.outputSchema ?? rec.output),
    });
  }

  for (const flow of flows) {
    const rec = asRecord(flow);
    if (!rec) continue;
    for (const fs of asArray(rec.steps)) {
      const frec = asRecord(fs);
      if (!frec) continue;
      const id = asString(frec.id);
      if (!id) continue;
      registry.set(toHandlerKey("step", id), {
        inputSchema: tryJsonSchema(frec.inputSchema ?? frec.input),
        outputSchema: tryJsonSchema(frec.outputSchema ?? frec.output),
      });
    }
  }

  return registry;
}

// Enrich RunIRNodes with schemas from the registry
function enrichWithSchemas(
  nodes: IRGraph["nodes"],
  registry: Map<string, SchemaEntry>,
): void {
  for (const node of Object.values(nodes)) {
    if (node.kind === "run") {
      const run = node as RunIRNode;
      const schema = registry.get(run.targetId);
      if (schema) {
        if (!run.inputSchema && schema.inputSchema) {
          run.inputSchema = schema.inputSchema;
        }
        if (!run.outputSchema && schema.outputSchema) {
          run.outputSchema = schema.outputSchema;
        }
      }
    }
  }
}

// Compiler

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

  // Build schema registry for enrichment
  const schemaRegistry = buildSchemaRegistry(steps, tools, flows);

  // Detect if any lifecycle handler is a function (recording mode)
  const lifecycleHandlers = ["onMessage", "onInit", "onTick"] as const;
  const hasFunctionHandlers = lifecycleHandlers.some(
    (k) => typeof raw[k] === "function",
  );

  // Helper to register a route entry node
  const registerRouteEntry = (
    rec: Record<string, unknown>,
  ): { routeKey: string; routeId: IRNodeId } | null => {
    const path = (asString(rec.path) ?? "/unknown").replace(/\/+$/, "") || "/";
    const method = (
      asString(rec.method) ?? "GET"
    ).toUpperCase() as RouteEntryIRNode["method"];
    const routeId = createId("entry");
    const routeKey = `route:${method}:${path}`;
    const routeNode: RouteEntryIRNode = {
      kind: "entry",
      id: routeId,
      handler: routeKey,
      method,
      path,
    };
    nodes[routeId] = routeNode;
    entries[routeKey] = routeId;
    return { routeKey, routeId };
  };

  if (hasFunctionHandlers) {
    // ── Recording-based wiring ──
    // For each lifecycle handler that is a function, record and generate IR
    for (const handler of lifecycleHandlers) {
      const fn = raw[handler];
      if (typeof fn !== "function") {
        // If the handler exists but isn't a function (e.g. metadata), create entry only
        if (fn != null) {
          const lcId = createId("entry");
          const lcNode: EntryIRNode = { kind: "entry", id: lcId, handler };
          nodes[lcId] = lcNode;
          entries[handler] = lcId;
        }
        continue;
      }

      // Create entry node
      const entryId = createId("entry");
      const entryNode: EntryIRNode = { kind: "entry", id: entryId, handler };
      nodes[entryId] = entryNode;
      entries[handler] = entryId;

      // Record handler execution
      const trace = await recordHandler(
        fn as (ctx: unknown) => Promise<unknown>,
      );

      // Convert trace → IR fragment
      const fragment = await traceToIR(trace, entryId, createId);

      // Merge fragment into graph
      for (const [id, node] of Object.entries(fragment.nodes)) {
        nodes[id as IRNodeId] = node;
      }
      for (const edge of fragment.edges) {
        edges.push(edge);
      }
    }

    // ── Trace route handlers as lifecycle handlers ──
    for (const route of routes) {
      const rec = asRecord(route);
      if (!rec) continue;

      const routeEntry = registerRouteEntry(rec);
      if (!routeEntry) continue;
      const { routeId, routeKey } = routeEntry;

      // If route has a handler function, record and generate IR
      const handlerFn = rec.handler;
      if (typeof handlerFn === "function") {
        const trace = await recordHandler(
          handlerFn as (ctx: unknown) => Promise<unknown>,
        );
        const fragment = await traceToIR(trace, routeId, createId);

        // Merge fragment into graph
        for (const [id, node] of Object.entries(fragment.nodes)) {
          nodes[id as IRNodeId] = node;
        }
        for (const edge of fragment.edges) {
          edges.push(edge);
        }
      }
    }
  } else {
    // ── Static wiring fallback ──
    // Register routes as metadata only (no execution wiring)
    for (const route of routes) {
      const rec = asRecord(route);
      if (!rec) continue;
      registerRouteEntry(rec);
    }

    // ── Create static entry and run nodes ──

    // Create EntryIRNode for onMessage
    const entryId = createId("entry");
    const entryNode: EntryIRNode = {
      kind: "entry",
      id: entryId,
      handler: "onMessage",
    };
    nodes[entryId] = entryNode;
    entries["onMessage"] = entryId;

    // Register onInit / onTick if present
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

    // Register run nodes
    const registerRun = (
      item: Record<string, unknown>,
      targetKind: RunTargetKind,
    ): IRNodeId => {
      const id = createId("run");
      const targetId = toHandlerKey(targetKind, asString(item.id) ?? "unknown");
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

    // Flows: expand inline (no targetKind:"flow" in IR)
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

    // Wire entry → first run node
    edges.push({ from: entryId, to: runSequence[0]!, type: "sequential" });

    // Wire sequential run nodes
    for (let i = 0; i < runSequence.length - 1; i += 1) {
      edges.push({
        from: runSequence[i]!,
        to: runSequence[i + 1]!,
        type: "sequential",
      });
    }
  }

  // Enrich RunIRNodes with schemas from registry
  enrichWithSchemas(nodes, schemaRegistry);

  const graph: IRGraph = {
    agentId,
    entries,
    nodes,
    edges,
  };

  return normalizeGraph(graph);
};
