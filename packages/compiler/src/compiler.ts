import type {
  EntryIRNode,
  HandlerIRNode,
  HandlerType,
  IRGraph,
  IREdge,
  IRNodeId,
} from "@kalphq/sdk";
import { zodToJsonSchema } from "zod-to-json-schema";
import { createIdGenerator } from "@/ids";
import { normalizeGraph } from "@/normalize";

// ────────────────────────────────────────────────────────────────────────────
// Helpers for parsing raw agent config objects
// ────────────────────────────────────────────────────────────────────────────

/** Safely cast unknown to a record, or return undefined. */
const asRecord = (v: unknown): Record<string, unknown> | undefined =>
  v != null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;

/** Safely cast unknown to a string, or return undefined. */
const asString = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

/** Safely cast unknown to an array, defaulting to empty. */
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Detect Zod schema objects by checking for `_def`. */
const isZodSchema = (v: unknown): boolean =>
  v != null && typeof v === "object" && typeof (v as any)._def === "object";

/** Try to convert a Zod schema to JSON Schema, returning undefined on failure. */
const tryJsonSchema = (v: unknown): Record<string, unknown> | undefined => {
  if (!isZodSchema(v)) return undefined;
  try {
    return zodToJsonSchema(v as any) as Record<string, unknown>;
  } catch {
    return undefined;
  }
};

// ────────────────────────────────────────────────────────────────────────────
// Compiler v2 — Pure declarative index builder
// ────────────────────────────────────────────────────────────────────────────

/**
 * Compiles an agent configuration into an {@link IRGraph}.
 *
 * This is a **pure, synchronous** function that produces a minimal structural
 * index of the agent. It does NOT:
 * - Execute any handler functions
 * - Record execution traces
 * - Infer branches, loops, or runtime control flow
 * - Touch any IO or side-effects
 *
 * The resulting IR only records which entrypoints and handlers exist, and how
 * they are structurally connected. All runtime behavior (branches, loops,
 * effects) is resolved by the Orchestration Reactor at execution time.
 *
 * @param agent - The raw agent configuration object (from `defineAgent()`).
 * @returns A normalized {@link IRGraph} ready for deployment.
 * @throws If `agent` is not an object or has no valid entries.
 */
export const compileAgent = (agent: unknown): IRGraph => {
  const raw = asRecord(agent);
  if (!raw) {
    throw new Error("compileAgent: agent must be an object.");
  }

  const agentId = asString(raw.id) ?? asString(raw.name);
  if (!agentId) {
    throw new Error("compileAgent: agent.id is required.");
  }
  const steps = asArray(raw.steps);
  const tools = asArray(raw.tools);
  const routes = asArray(raw.routes);

  const createId = createIdGenerator("root");
  const nodes: IRGraph["nodes"] = {};
  const edges: IREdge[] = [];
  const entries: IRGraph["entries"] = {};
  const handlerIndex: IRGraph["handlerIndex"] = {};

  // ── Lifecycle handlers → entry + handler + sequential edge ──

  const lifecycleHandlers = ["onMessage", "onInit", "onTick"] as const;

  for (const lifecycle of lifecycleHandlers) {
    if (raw[lifecycle] == null) continue;

    const entryId = createId("entry", lifecycle);
    const handlerId = createId("handler", lifecycle);

    const entryNode: EntryIRNode = {
      kind: "entry",
      id: entryId,
      handler: lifecycle,
    };

    const handlerNode: HandlerIRNode = {
      kind: "handler",
      id: handlerId,
      moduleRef: lifecycle,
      handlerType: "lifecycle",
    };

    nodes[entryId] = entryNode;
    nodes[handlerId] = handlerNode;
    edges.push({ from: entryId, to: handlerId, type: "sequential" });
    entries[lifecycle] = entryId;
    handlerIndex[lifecycle] = handlerId;
  }

  // ── Steps → handler nodes (no entry — invoked via actions.run at runtime) ──

  for (const step of steps) {
    const rec = asRecord(step);
    if (!rec) continue;
    const id = asString(rec.id);
    if (!id) continue;

    const handlerId = createId("handler", `steps.${id}`);
    const handlerNode: HandlerIRNode = {
      kind: "handler",
      id: handlerId,
      moduleRef: `steps.${id}`,
      handlerType: "step",
      inputSchema: tryJsonSchema(rec.inputSchema ?? rec.input),
      outputSchema: tryJsonSchema(rec.outputSchema ?? rec.output),
    };
    nodes[handlerId] = handlerNode;
    handlerIndex[`steps.${id}`] = handlerId;
  }

  // ── Tools → handler nodes (no entry — invoked via runtime tool calls) ──

  for (const tool of tools) {
    const rec = asRecord(tool);
    if (!rec) continue;
    const id = asString(rec.id);
    if (!id) continue;

    const handlerId = createId("handler", `tools.${id}`);
    const handlerNode: HandlerIRNode = {
      kind: "handler",
      id: handlerId,
      moduleRef: `tools.${id}`,
      handlerType: "tool",
      inputSchema: tryJsonSchema(rec.inputSchema ?? rec.input),
    };
    nodes[handlerId] = handlerNode;
    handlerIndex[`tools.${id}`] = handlerId;
  }

  // ── Routes → entry + handler nodes ──

  for (const route of routes) {
    const rec = asRecord(route);
    if (!rec) continue;
    const id = asString(rec.id);
    if (!id) continue;

    const path = (asString(rec.path) ?? "/unknown").replace(/\/+$/, "") || "/";
    const method = (asString(rec.method) ?? "GET").toUpperCase();
    const routeKey = `route:${method}:${path}`;

    const entryId = createId("entry", routeKey);
    const handlerId = createId("handler", `routes.${id}`);

    const entryNode: EntryIRNode = {
      kind: "entry",
      id: entryId,
      handler: routeKey,
      method,
      path,
    };

    const handlerNode: HandlerIRNode = {
      kind: "handler",
      id: handlerId,
      moduleRef: `routes.${id}`,
      handlerType: "route",
    };

    nodes[entryId] = entryNode;
    nodes[handlerId] = handlerNode;
    edges.push({ from: entryId, to: handlerId, type: "sequential" });
    entries[routeKey] = entryId;
    handlerIndex[`routes.${id}`] = handlerId;
  }

  return normalizeGraph({
    version: 2,
    agentId,
    entries,
    nodes,
    edges,
    handlerIndex,
  });
};
