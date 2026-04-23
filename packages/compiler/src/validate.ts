import { z } from "zod";
import type {
  IRGraph,
  IRNodeId,
  IRNode,
  IREdge,
  LoopIRNode,
} from "@kalphq/sdk";

// Primitive schemas

const IRNodeIdSchema = z.string().min(1);

// Node schemas

const EntryIRNodeSchema = z.object({
  kind: z.literal("entry"),
  id: IRNodeIdSchema,
  handler: z.string().min(1),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional(),
  path: z.string().optional(),
});

const RunIRNodeSchema = z.object({
  kind: z.literal("run"),
  id: IRNodeIdSchema,
  targetId: z.string().min(1),
  targetKind: z.enum(["step", "tool"]),
  input: z.unknown().optional(),
  inputSchema: z.record(z.unknown()).optional(),
  outputSchema: z.record(z.unknown()).optional(),
});

const WaitIRNodeSchema = z.object({
  kind: z.literal("wait"),
  id: IRNodeIdSchema,
  duration: z.union([z.string(), z.number()]),
});

const FetchIRNodeSchema = z.object({
  kind: z.literal("fetch"),
  id: IRNodeIdSchema,
  url: z.string().min(1),
  init: z.unknown().optional(),
});

const GenerateIRNodeSchema = z.object({
  kind: z.literal("llm.generate"),
  id: IRNodeIdSchema,
  model: z.string().optional(),
  input: z.unknown(),
  schema: z.unknown().optional(),
});

const StreamIRNodeSchema = z.object({
  kind: z.literal("llm.stream"),
  id: IRNodeIdSchema,
  model: z.string().optional(),
  input: z.unknown(),
  schema: z.unknown().optional(),
});

const ClassifyIRNodeSchema = z.object({
  kind: z.literal("llm.classify"),
  id: IRNodeIdSchema,
  model: z.string().optional(),
  input: z.object({
    text: z.string(),
    labels: z.array(z.string()),
  }),
  branches: z.array(
    z.object({
      label: z.string(),
      next: z.union([IRNodeIdSchema, z.null()]), // string = has target, null = terminal
    }),
  ),
  fallback: IRNodeIdSchema.optional(),
  confidenceThreshold: z.number().optional(),
});

const LoopIRNodeSchema = z.object({
  kind: z.literal("loop"),
  id: IRNodeIdSchema,
  entry: IRNodeIdSchema,
  detached: z.literal(true),
  key: z.string().optional(),
  schedule: z.object({
    type: z.enum(["interval", "cron", "event-driven"]),
    value: z.union([z.string(), z.number()]).optional(),
  }),
  lifecycle: z.object({
    onStart: IRNodeIdSchema.optional(),
    onIterationStart: IRNodeIdSchema.optional(),
    onIterationEnd: IRNodeIdSchema.optional(),
    onError: IRNodeIdSchema.optional(),
    onStop: IRNodeIdSchema.optional(),
  }),
  maxIterations: z.number().optional(),
  until: IRNodeIdSchema.optional(),
  persistent: z.literal(true),
});

export const IRNodeSchema = z.discriminatedUnion("kind", [
  EntryIRNodeSchema,
  RunIRNodeSchema,
  WaitIRNodeSchema,
  FetchIRNodeSchema,
  GenerateIRNodeSchema,
  StreamIRNodeSchema,
  ClassifyIRNodeSchema,
  LoopIRNodeSchema,
]);

// Graph schema

export const IREdgeSchema = z.object({
  from: IRNodeIdSchema,
  to: IRNodeIdSchema,
  type: z.enum(["sequential", "branch", "nested"]),
  condition: z.string().optional(),
});

export const IRGraphSchema = z.object({
  agentId: z.string().min(1),
  entries: z.record(IRNodeIdSchema),
  nodes: z.record(IRNodeSchema),
  edges: z.array(IREdgeSchema),
});

// Validation functions

export type Severity = "error" | "warning" | "info";

export interface ValidationIssue {
  severity: Severity;
  message: string;
  context?: string; // e.g., "onMessage → classify()"
  location?: string; // e.g., "branch 'research'"
  fix: string;
  debug?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
  issues?: ValidationIssue[]; // Structured issues (v2)
}

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

// Build path from entry to a specific node using BFS for determinism
const pathCache = new Map<IRNodeId, string>();

function buildPathToNode(
  targetNodeId: IRNodeId,
  entries: Record<string, IRNodeId>,
  nodes: Record<IRNodeId, IRNode>,
  edges: IREdge[],
): string {
  // Check cache first
  if (pathCache.has(targetNodeId)) {
    return pathCache.get(targetNodeId)!;
  }

  // BFS from all entries simultaneously for deterministic shortest path
  const queue: Array<{ nodeId: IRNodeId; path: string[] }> = [];
  const visited = new Set<IRNodeId>();

  // Initialize with all entries (sorted for determinism)
  const sortedEntries = Object.entries(entries).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  for (const [entryName, entryId] of sortedEntries) {
    queue.push({ nodeId: entryId, path: [entryName] });
  }

  while (queue.length > 0) {
    const { nodeId, path } = queue.shift()!;

    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    // Found target
    if (nodeId === targetNodeId) {
      const result = path.join(" → ");
      pathCache.set(targetNodeId, result);
      return result;
    }

    // Get outgoing edges sorted for determinism
    const outgoing = edges
      .filter((e) => e.from === nodeId)
      .sort((a, b) => {
        // Sort by: type, then condition, then target
        const typeOrder = {
          sequential: 0,
          branch: 1,
          nested: 2,
          data: 3,
          cross_scope: 4,
        };
        const typeDiff = (typeOrder[a.type] ?? 0) - (typeOrder[b.type] ?? 0);
        if (typeDiff !== 0) return typeDiff;
        const condDiff = (a.condition ?? "").localeCompare(b.condition ?? "");
        if (condDiff !== 0) return condDiff;
        return a.to.localeCompare(b.to);
      });

    for (const edge of outgoing) {
      const newPath = [...path];

      // Add context based on edge type
      if (edge.type === "branch") {
        newPath.push(`classify()`);
        newPath.push(`branch "${edge.condition}"`);
      } else if (edge.type === "nested") {
        const node = nodes[nodeId];
        if (node?.kind === "loop") {
          newPath.push(`loop()`);
        }
      }

      queue.push({ nodeId: edge.to, path: newPath });
    }
  }

  pathCache.set(targetNodeId, "unknown location");
  return "unknown location";
}

// Check if classify always leads to terminal (smell - might be intentional but suspicious)
function isAlwaysTerminal(classifyNode: any): boolean {
  return classifyNode.branches.every((b: any) => b.next === null);
}

// Check if loop has no real effect (only waits or is empty)
function isLoopWithoutEffect(loopNode: LoopIRNode, ir: IRGraph): boolean {
  if (loopNode.entry === null) return true;

  // Find loop body nodes by following nested edge
  const nestedEdge = ir.edges.find(
    (e) => e.from === loopNode.id && e.type === "nested",
  );
  if (!nestedEdge) return true;

  // Check if body only contains waits (no real actions)
  let current = nestedEdge.to;
  const visited = new Set<IRNodeId>();

  while (current && !visited.has(current)) {
    visited.add(current);
    const node = ir.nodes[current];

    if (!node) break;

    // If there's a real action (not wait), loop has effect
    if (node.kind !== "wait") {
      return false;
    }

    // Follow sequential edge
    const nextEdge = ir.edges.find(
      (e) => e.from === current && e.type === "sequential",
    );
    if (!nextEdge) break;
    current = nextEdge.to;
  }

  return true; // Only waits or empty
}

export function validateIRBindings(
  ir: IRGraph,
  handlerNames: string[],
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const issues: ValidationIssue[] = [];
  const handlerSet = new Set(handlerNames);

  // Run nodes: targetId must match a handler key directly
  for (const node of Object.values(ir.nodes)) {
    if (node.kind === "run") {
      if (!handlerSet.has(node.targetId)) {
        errors.push(
          `Your flow uses a step that isn't available.\n\n` +
            `The step "${node.targetId}" was not found in your code.\n\n` +
            `Fix:\n` +
            `- Make sure the step is properly exported\n` +
            `- Check for typos in the step name\n\n` +
            `(debug: run node references missing handler "${node.targetId}")`,
        );
      }
    }
  }

  // Entry handlers: routes skipped (no handler in v1), all others must be bundled
  for (const [entryKey, entryNodeId] of Object.entries(ir.entries)) {
    if (entryKey.startsWith("route:")) continue;
    if (!handlerSet.has(entryKey)) {
      errors.push(
        `Your entry point isn't properly connected.\n\n` +
          `The "${entryKey}" handler is referenced but not available.\n\n` +
          `Fix:\n` +
          `- Make sure the handler is properly exported\n` +
          `- Check for typos in the handler name\n\n` +
          `(debug: entry "${entryKey}" not bundled)`,
      );
    }
    if (!ir.nodes[entryNodeId as IRNodeId]) {
      errors.push(
        `Your entry point leads nowhere.\n\n` +
          `The "${entryKey}" entry doesn't connect to any actions.\n\n` +
          `Fix:\n` +
          `- Make sure the handler has at least one action\n\n` +
          `(debug: entry "${entryKey}" points to missing node "${entryNodeId}")`,
      );
    }
  }

  // Orphan detection (warning only — handlers may be reusable but unused in current IR)
  const referencedHandlers = new Set<string>();
  for (const node of Object.values(ir.nodes)) {
    if (node.kind === "run") {
      referencedHandlers.add(node.targetId);
    }
  }
  for (const k of Object.keys(ir.entries)) {
    if (!k.startsWith("route:")) {
      referencedHandlers.add(k);
    }
  }

  for (const name of handlerNames) {
    if (!referencedHandlers.has(name)) {
      warnings.push(
        `A handler is defined but never used.\n\n` +
          `"${name}" is available but not connected to your flow.\n\n` +
          `(debug: handler "${name}" not referenced in IR)`,
      );
    }
  }

  // ── IR Invariants ──

  // 1. Branch validations
  for (const node of Object.values(ir.nodes)) {
    if (node.kind === "llm.classify") {
      const classifyNode = node as any;
      const seenLabels = new Set<string>();

      for (const branch of classifyNode.branches) {
        // next === undefined → error (incomplete)
        // next === null → valid (explicit terminal)
        if (branch.next === undefined) {
          errors.push(
            `A branch in your classify() has no actions.\n\n` +
              `The "${branch.label}" branch doesn't lead anywhere.\n\n` +
              `Fix:\n` +
              `- Add at least one action inside this branch, or\n` +
              `- Explicitly return to end the flow.\n\n` +
              `(debug: branch "${branch.label}" has undefined target)`,
          );
        }

        // Duplicate labels
        if (seenLabels.has(branch.label)) {
          errors.push(
            `Your classify() has duplicate branch names.\n\n` +
              `The label "${branch.label}" appears more than once.\n\n` +
              `Fix:\n` +
              `- Each branch in classify() needs a unique name.\n\n` +
              `(debug: duplicate label "${branch.label}")`,
          );
        }
        seenLabels.add(branch.label);

        // Next points to missing node
        if (branch.next !== undefined && branch.next !== null) {
          if (!ir.nodes[branch.next]) {
            const path = buildPathToNode(
              node.id,
              ir.entries,
              ir.nodes,
              ir.edges,
            );
            errors.push(
              `Part of your flow points to something that doesn't exist.\n\n` +
                `Found in: ${path} → branch "${branch.label}"\n\n` +
                `The branch leads to a missing step.\n\n` +
                `Fix:\n` +
                `- Check your actions and returns\n` +
                `- Make sure every step is properly defined\n\n` +
                `(debug: branch "${branch.label}" points to missing node "${branch.next}")`,
            );
          }
        }

        // Exactly one edge per branch label (if next != null)
        // AND edge.to must match branch.next
        if (branch.next !== undefined && branch.next !== null) {
          const branchEdges = ir.edges.filter(
            (e) =>
              e.from === node.id &&
              e.type === "branch" &&
              e.condition === branch.label,
          );
          if (branchEdges.length !== 1) {
            errors.push(
              `A branch in your classify() is inconsistent.\n\n` +
                `The "${branch.label}" branch has ${branchEdges.length} paths instead of 1.\n\n` +
                `Fix:\n` +
                `- Make sure each branch returns a single clear path\n` +
                `- Avoid mixing conditional logic after classify()\n\n` +
                `(debug: branch "${branch.label}" has ${branchEdges.length} edges)`,
            );
          } else {
            // Edge must point to the same node as branch.next
            const edge = branchEdges[0]!;
            if (edge.to !== branch.next) {
              errors.push(
                `A branch in your classify() is inconsistent.\n\n` +
                  `The "${branch.label}" branch points one way but goes another.\n\n` +
                  `Fix:\n` +
                  `- Make sure each branch returns a single clear path\n` +
                  `- Avoid mixing conditional logic after classify()\n\n` +
                  `(debug: branch "${branch.label}" next="${branch.next}" but edge goes to "${edge.to}")`,
              );
            }
          }
        }
      }

      // Classify node should not have sequential edges
      const hasSequential = ir.edges.some(
        (e) => e.from === node.id && e.type === "sequential",
      );
      if (hasSequential) {
        errors.push(
          `Your classify() has actions after it that shouldn't be there.\n\n` +
            `classify() should be the last step in its sequence.\n\n` +
            `Fix:\n` +
            `- Move all actions inside the branches\n` +
            `- Or put them before the classify()\n\n` +
            `(debug: classify "${node.id}" has sequential edges)`,
        );
      }

      // Classify must have at least one branch
      if (classifyNode.branches.length === 0) {
        errors.push(
          `Your classify() has no branches.\n\n` +
            `classify() needs at least one possible outcome.\n\n` +
            `Fix:\n` +
            `- Add labels to classify()\n` +
            `- Or remove classify() if it's not needed\n\n` +
            `(debug: classify "${node.id}" has no branches)`,
        );
      }

      // Pattern: Always terminal classify (smell)
      if (isAlwaysTerminal(classifyNode)) {
        warnings.push(
          `Your classify() doesn't lead to any actions.\n\n` +
            `All branches end immediately without doing anything.\n\n` +
            `Fix:\n` +
            `- Add actions inside at least one branch\n` +
            `- Or remove classify() if you don't need branching\n\n` +
            `(debug: classify "${node.id}" has all terminal branches)`,
        );
      }
    }
  }

  // 2. Sequential edge uniqueness (no multiple sequential from same node)
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
        `Your flow has a step that leads to multiple places at once.\n\n` +
          `A step can only have one next step.\n\n` +
          `Fix:\n` +
          `- Make sure each action flows to exactly one next action\n` +
          `- Use classify() if you need branching\n\n` +
          `(debug: node "${fromId}" has ${edges.length} sequential edges)`,
      );
    }
  }

  // 3. Sequential + branch mutual exclusion
  for (const node of Object.values(ir.nodes)) {
    const hasSeq = ir.edges.some(
      (e) => e.from === node.id && e.type === "sequential",
    );
    const hasBranch = ir.edges.some(
      (e) => e.from === node.id && e.type === "branch",
    );
    if (hasSeq && hasBranch) {
      errors.push(
        `Your flow mixes branching and sequential steps incorrectly.\n\n` +
          `A step should either branch (with classify) OR continue sequentially, not both.\n\n` +
          `Fix:\n` +
          `- Use classify() for branching decisions\n` +
          `- Keep sequential flow separate from branches\n\n` +
          `(debug: node "${node.id}" has both sequential and branch edges)`,
      );
    }
  }

  // 4. Loop validation (nested edge consistency)
  for (const node of Object.values(ir.nodes)) {
    if (node.kind === "loop") {
      const loopNode = node as LoopIRNode;
      const nested = ir.edges.filter(
        (e) => e.from === node.id && e.type === "nested",
      );

      // At most 1 nested edge
      if (nested.length > 1) {
        errors.push(
          `Your loop contains multiple entry paths.\n\n` +
            `A loop must have a single, clear starting point.\n\n` +
            `Fix:\n` +
            `- Ensure the loop body runs a single sequence of actions\n` +
            `- Avoid branching at the top level of a loop\n\n` +
            `(debug: loop "${node.id}" has ${nested.length} nested edges)`,
        );
      }

      // bodyEntry/nested consistency
      if (loopNode.entry === null && nested.length > 0) {
        errors.push(
          `Your loop is empty but has an entry point.\n\n` +
            `Something went wrong building the loop.\n\n` +
            `Fix:\n` +
            `- Check that your loop body has at least one action\n\n` +
            `(debug: loop "${node.id}" has null entry but nested edge exists)`,
        );
      }
      if (loopNode.entry !== null && nested.length === 0) {
        errors.push(
          `Your loop has no entry point.\n\n` +
            `Something went wrong building the loop.\n\n` +
            `Fix:\n` +
            `- Check that your loop is properly defined\n\n` +
            `(debug: loop "${node.id}" has entry but no nested edge)`,
        );
      }

      // Pattern: Loop without effect (only waits or empty)
      if (isLoopWithoutEffect(loopNode, ir)) {
        warnings.push(
          `Your loop doesn't perform any actions.\n\n` +
            `The loop body only contains waits or is empty.\n\n` +
            `Fix:\n` +
            `- Add meaningful actions inside the loop\n` +
            `- Or remove the loop if you don't need it\n\n` +
            `(debug: loop "${node.id}" has no effect)`,
        );
      }
    }
  }

  // 5. Entry outgoing edges (warning if none)
  for (const [entryKey, entryNodeId] of Object.entries(ir.entries)) {
    const hasOutgoing = ir.edges.some((e) => e.from === entryNodeId);

    if (entryKey.startsWith("route:")) {
      // Routes: informational only
      if (!hasOutgoing) {
        warnings.push(
          `Route "${entryKey}" doesn't track any actions.\n\n` +
            `This route won't show up in execution logs.\n\n` +
            `(debug: route "${entryKey}" produces no IR nodes)`,
        );
      }
    } else if (entryKey === "onMessage") {
      // onMessage without edges = error (almost always a bug)
      if (!hasOutgoing) {
        errors.push(
          `Your onMessage handler does nothing.\n\n` +
            `onMessage should handle incoming messages.\n\n` +
            `Fix:\n` +
            `- Add actions inside onMessage to respond\n` +
            `- Or remove onMessage if you don't need it\n\n` +
            `(debug: entry "${entryKey}" has no execution path)`,
        );
      }
    } else {
      // Other entries = warning
      if (!hasOutgoing) {
        warnings.push(
          `Entry "${entryKey}" has no actions.\n\n` +
            `This entry point won't do anything when triggered.\n\n` +
            `(debug: entry "${entryKey}" has no execution path)`,
        );
      }
    }
  }

  // 6. Unreachable nodes detection
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
  for (const nodeId of Object.keys(ir.nodes) as IRNodeId[]) {
    if (!reachable.has(nodeId)) {
      warnings.push(
        `Some code in your flow will never run.\n\n` +
          `This part of your logic is disconnected.\n\n` +
          `Fix:\n` +
          `- Ensure all branches and loops lead somewhere\n` +
          `- Remove unused actions\n\n` +
          `(debug: node "${nodeId}" is unreachable)`,
      );
    }
  }

  // 7. Dangling edges (to/from non-existent nodes)
  for (const edge of ir.edges) {
    const fromExists =
      ir.nodes[edge.from] || Object.values(ir.entries).includes(edge.from);
    const toExists = ir.nodes[edge.to];
    if (!fromExists) {
      errors.push(
        `Your flow references a step that doesn't exist.\n\n` +
          `A step was removed or never created.\n\n` +
          `Fix:\n` +
          `- Check your actions and returns\n` +
          `- Make sure every step is properly defined\n\n` +
          `(debug: edge from non-existent node "${edge.from}")`,
      );
    }
    if (!toExists) {
      errors.push(
        `Your flow references a step that doesn't exist.\n\n` +
          `A step was removed or never created.\n\n` +
          `Fix:\n` +
          `- Check your actions and returns\n` +
          `- Make sure every step is properly defined\n\n` +
          `(debug: edge to non-existent node "${edge.to}")`,
      );
    }
  }

  // 8. Cross-scope execution rules (FIX 1: CRÍTICO)
  // Verificar que edges cross-scope tengan marca explícita
  for (const edge of ir.edges) {
    if (edge.type === "cross_scope") {
      // Validar que tenga scopeDependency definido
      if (!edge.scopeDependency) {
        errors.push(
          `Cross-scope dependency missing required metadata.\n\n` +
            `Edge from "${edge.from}" to "${edge.to}" is marked as cross-scope but lacks scopeDependency.\n\n` +
            `Fix:\n` +
            `- Add scopeDependency: { fromScope, toScope } to the edge\n\n` +
            `(debug: cross_scope edge without scopeDependency)`,
        );
      }
    }
  }

  // Verificar execution semantics: within-scope ordering
  const scopeGroups = new Map<string, IRNodeId[]>();
  for (const [nodeId, node] of Object.entries(ir.nodes)) {
    const scopeId = (node as any).meta?.handler ?? "unknown";
    if (!scopeGroups.has(scopeId)) {
      scopeGroups.set(scopeId, []);
    }
    scopeGroups.get(scopeId)!.push(nodeId as IRNodeId);
  }

  // Validar que no hay edges "data" sin mapping definido
  for (const edge of ir.edges) {
    if (edge.type === "data" && !edge.mapping) {
      warnings.push(
        `Data edge missing field mapping.\n\n` +
          `Edge from "${edge.from}" to "${edge.to}" should specify which fields are being passed.\n\n` +
          `Fix:\n` +
          `- Add mapping: { sourceField, targetField } to the edge\n\n` +
          `(debug: data edge without mapping)`,
      );
    }
  }

  // Sort issues for consistent output (by severity, then context, then message)
  issues.sort((a, b) => {
    const severityOrder = { error: 0, warning: 1, info: 2 };
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    const contextDiff = (a.context ?? "").localeCompare(b.context ?? "");
    if (contextDiff !== 0) return contextDiff;
    return a.message.localeCompare(b.message);
  });

  // Generate errors and warnings from issues (single source of truth)
  const finalErrors = issues
    .filter((i) => i.severity === "error")
    .map((i) => i.message);
  const finalWarnings = issues
    .filter((i) => i.severity === "warning" || i.severity === "info")
    .map((i) => i.message);

  // Merge with legacy errors/warnings (during transition)
  const allErrors = [...new Set([...errors, ...finalErrors])];
  const allWarnings = [...new Set([...warnings, ...finalWarnings])];

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings.length > 0 ? allWarnings : undefined,
    issues: issues.length > 0 ? issues : undefined,
  };
}
