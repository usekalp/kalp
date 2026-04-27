import { z } from "zod";
import type { IRGraph, IRNodeId, IREdge } from "@kalphq/sdk";

// ────────────────────────────────────────────────────────────────────────────
// Zod schemas for IR v2
// ────────────────────────────────────────────────────────────────────────────

/** Schema for branded IRNodeId strings. */
const IRNodeIdSchema = z.string().min(1);

/** Schema for an entry IR node (event-driven entrypoint). */
const EntryIRNodeSchema = z.object({
  kind: z.literal("entry"),
  id: IRNodeIdSchema,
  handler: z.string().min(1),
  method: z.string().optional(),
  path: z.string().optional(),
});

/** Schema for a handler IR node (opaque module reference). */
const HandlerIRNodeSchema = z.object({
  kind: z.literal("handler"),
  id: IRNodeIdSchema,
  moduleRef: z.string().min(1),
  handlerType: z.enum(["lifecycle", "step", "tool", "route"]),
  inputSchema: z.record(z.unknown()).optional(),
  outputSchema: z.record(z.unknown()).optional(),
});

/** Discriminated union of all valid IR node schemas. */
export const IRNodeSchema = z.discriminatedUnion("kind", [
  EntryIRNodeSchema,
  HandlerIRNodeSchema,
]);

/** Schema for an IR edge. */
export const IREdgeSchema = z.object({
  from: IRNodeIdSchema,
  to: IRNodeIdSchema,
  type: z.enum(["sequential", "event"]),
  label: z.string().optional(),
});

/** Schema for the complete IR graph (v2). */
export const IRGraphSchema = z.object({
  version: z.literal(2),
  agentId: z.string().min(1),
  entries: z.record(IRNodeIdSchema),
  nodes: z.record(IRNodeSchema),
  edges: z.array(IREdgeSchema),
});

// ────────────────────────────────────────────────────────────────────────────
// Validation types
// ────────────────────────────────────────────────────────────────────────────

/** Severity level for a validation issue. */
export type Severity = "error" | "warning" | "info";

/** A structured validation issue with context and actionable fix. */
export interface ValidationIssue {
  severity: Severity;
  message: string;
  context?: string;
  location?: string;
  fix: string;
  debug?: string;
}

/** Result of IR validation. */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
  issues?: ValidationIssue[];
}

// ────────────────────────────────────────────────────────────────────────────
// Schema validation
// ────────────────────────────────────────────────────────────────────────────

/**
 * Validates the structural schema of an IR graph using Zod.
 *
 * Checks that the IR conforms to the v2 schema (version, agentId, entries,
 * nodes with kind "entry" or "handler", edges with type "sequential" or "event").
 *
 * @param ir - The raw IR graph object to validate.
 * @returns A {@link ValidationResult} with errors if schema validation fails.
 */
export function validateIR(ir: unknown): ValidationResult {
  const result = IRGraphSchema.safeParse(ir);
  if (result.success) {
    return { valid: true, errors: [] };
  }

  const errors = result.error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });

  return { valid: false, errors };
}

// ────────────────────────────────────────────────────────────────────────────
// Binding validation
// ────────────────────────────────────────────────────────────────────────────

/**
 * Validates that every handler node in the IR has a corresponding bundled module,
 * and performs structural integrity checks (reachability, edge consistency, etc.).
 *
 * @param ir - A schema-valid {@link IRGraph}.
 * @param handlerNames - The list of available bundled handler names.
 * @returns A {@link ValidationResult} with errors and warnings.
 */
export function validateIRBindings(
  ir: IRGraph,
  handlerNames: string[],
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const handlerSet = new Set(handlerNames);

  // 1. Handler nodes: moduleRef must match a bundled handler
  for (const node of Object.values(ir.nodes)) {
    if (node.kind === "handler") {
      if (!handlerSet.has(node.moduleRef)) {
        errors.push(
          `Handler "${node.moduleRef}" is referenced in the IR but not found in bundles.\n\n` +
            `Fix:\n` +
            `- Make sure the handler is properly exported\n` +
            `- Check for typos in the handler name\n\n` +
            `(debug: handler node "${node.id}" references missing module "${node.moduleRef}")`,
        );
      }
    }
  }

  // 2. Entry nodes: must point to existing nodes
  for (const [entryKey, entryNodeId] of Object.entries(ir.entries)) {
    if (!ir.nodes[entryNodeId as IRNodeId]) {
      errors.push(
        `Entry "${entryKey}" points to missing node "${entryNodeId}".\n\n` +
          `Fix:\n` +
          `- Ensure the agent configuration exports this handler\n\n` +
          `(debug: entry "${entryKey}" references non-existent node)`,
      );
    }
  }

  // 3. Sequential edge uniqueness (no multiple sequential from same node)
  const seqEdgesByFrom = new Map<IRNodeId, IREdge[]>();
  for (const edge of ir.edges) {
    if (edge.type === "sequential") {
      const list = seqEdgesByFrom.get(edge.from) ?? [];
      list.push(edge);
      seqEdgesByFrom.set(edge.from, list);
    }
  }
  for (const [fromId, edges] of seqEdgesByFrom) {
    if (edges.length > 1) {
      errors.push(
        `Node "${fromId}" has ${edges.length} sequential edges. Expected at most 1.\n\n` +
          `Fix:\n` +
          `- Each node should have at most one sequential successor\n\n` +
          `(debug: node "${fromId}" has ${edges.length} sequential edges)`,
      );
    }
  }

  // 4. Entry outgoing edges (entries should lead somewhere)
  for (const [entryKey, entryNodeId] of Object.entries(ir.entries)) {
    const hasOutgoing = ir.edges.some((e) => e.from === entryNodeId);
    if (!hasOutgoing) {
      if (entryKey === "onMessage") {
        errors.push(
          `"onMessage" handler has no execution path.\n\n` +
            `Fix:\n` +
            `- Add actions inside onMessage to respond\n\n` +
            `(debug: entry "${entryKey}" has no outgoing edges)`,
        );
      } else {
        warnings.push(
          `Entry "${entryKey}" has no outgoing edges — it won't do anything.\n\n` +
            `(debug: entry "${entryKey}" has no execution path)`,
        );
      }
    }
  }

  // 5. Unreachable nodes detection
  const reachable = new Set<IRNodeId>();
  function dfs(nodeId: IRNodeId) {
    if (reachable.has(nodeId)) return;
    reachable.add(nodeId);
    for (const e of ir.edges) {
      if (e.from === nodeId) {
        dfs(e.to);
      }
    }
  }
  for (const entryId of Object.values(ir.entries)) {
    dfs(entryId);
  }

  // Steps/tools are handler nodes without entries — they're invoked via
  // actions.run at runtime. They are NOT expected to be reachable from entries.
  for (const nodeId of Object.keys(ir.nodes) as IRNodeId[]) {
    const node = ir.nodes[nodeId];
    if (!reachable.has(nodeId) && node?.kind !== "handler") {
      warnings.push(
        `Node "${nodeId}" is unreachable from any entry.\n\n` +
          `(debug: node "${nodeId}" is not reachable)`,
      );
    }
  }

  // 6. Dangling edges (to/from non-existent nodes)
  for (const edge of ir.edges) {
    if (!ir.nodes[edge.from]) {
      errors.push(
        `Edge references non-existent source node "${edge.from}".\n\n` +
          `(debug: edge from non-existent node "${edge.from}")`,
      );
    }
    if (!ir.nodes[edge.to]) {
      errors.push(
        `Edge references non-existent target node "${edge.to}".\n\n` +
          `(debug: edge to non-existent node "${edge.to}")`,
      );
    }
  }

  // 7. Orphan handler detection (bundled but not in IR)
  const irModuleRefs = new Set<string>();
  for (const node of Object.values(ir.nodes)) {
    if (node.kind === "handler") {
      irModuleRefs.add(node.moduleRef);
    }
  }
  for (const name of handlerNames) {
    if (!irModuleRefs.has(name)) {
      warnings.push(
        `Handler "${name}" is bundled but not referenced in the IR.\n\n` +
          `(debug: handler "${name}" not in IR nodes)`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
