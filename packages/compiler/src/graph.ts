/**
 * Graph utilities for IR v2.
 *
 * In v2 the IR is a minimal structural index (entries + handlers + edges).
 * These helpers provide compile-time graph analysis: reachability, adjacency,
 * handler resolution, and topological ordering.
 */

import type { IRGraph, IRNodeId, IRNode, HandlerIRNode } from "@kalphq/sdk";

// ────────────────────────────────────────────────────────────────────────────
// Adjacency
// ────────────────────────────────────────────────────────────────────────────

/**
 * Builds a forward adjacency list from the IR edges.
 *
 * @param ir - The IR graph.
 * @returns A map from each node ID to its list of successor node IDs.
 */
export function buildAdjacency(ir: IRGraph): Map<IRNodeId, IRNodeId[]> {
  const adj = new Map<IRNodeId, IRNodeId[]>();
  for (const edge of ir.edges) {
    const list = adj.get(edge.from) ?? [];
    list.push(edge.to);
    adj.set(edge.from, list);
  }
  return adj;
}

// ────────────────────────────────────────────────────────────────────────────
// Reachability
// ────────────────────────────────────────────────────────────────────────────

/**
 * Returns the set of all node IDs reachable from a given starting node via
 * directed edges (DFS).
 *
 * @param ir - The IR graph.
 * @param startId - The node to start traversal from.
 * @returns A set of reachable node IDs (including `startId` itself).
 */
export function getReachableNodes(
  ir: IRGraph,
  startId: IRNodeId,
): Set<IRNodeId> {
  const visited = new Set<IRNodeId>();
  const stack: IRNodeId[] = [startId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const edge of ir.edges) {
      if (edge.from === current) {
        stack.push(edge.to);
      }
    }
  }

  return visited;
}

// ────────────────────────────────────────────────────────────────────────────
// Handler lookup
// ────────────────────────────────────────────────────────────────────────────

/**
 * Returns all handler nodes in the IR, keyed by their `moduleRef`.
 *
 * @param ir - The IR graph.
 * @returns A map from moduleRef to the corresponding {@link HandlerIRNode}.
 */
export function getHandlersByModuleRef(
  ir: IRGraph,
): Map<string, HandlerIRNode> {
  const handlers = new Map<string, HandlerIRNode>();
  for (const node of Object.values(ir.nodes)) {
    if (node.kind === "handler") {
      handlers.set(node.moduleRef, node);
    }
  }
  return handlers;
}

/**
 * Resolves the handler node that a given entry leads to via its first
 * sequential edge, or `undefined` if no such handler exists.
 *
 * @param ir - The IR graph.
 * @param entryKey - The event name (e.g. "onMessage", "route:GET:/health").
 * @returns The target {@link HandlerIRNode}, or `undefined`.
 */
export function resolveEntryHandler(
  ir: IRGraph,
  entryKey: string,
): HandlerIRNode | undefined {
  const entryId = ir.entries[entryKey];
  if (!entryId) return undefined;

  const edge = ir.edges.find(
    (e) => e.from === entryId && e.type === "sequential",
  );
  if (!edge) return undefined;

  const target = ir.nodes[edge.to];
  return target?.kind === "handler" ? target : undefined;
}

// ────────────────────────────────────────────────────────────────────────────
// Path checking
// ────────────────────────────────────────────────────────────────────────────

/**
 * Returns `true` if there is a directed path from `from` to `to` in the graph.
 *
 * @param ir - The IR graph.
 * @param from - The source node ID.
 * @param to - The target node ID.
 * @returns Whether a path exists.
 */
export function hasPath(ir: IRGraph, from: IRNodeId, to: IRNodeId): boolean {
  return getReachableNodes(ir, from).has(to);
}
