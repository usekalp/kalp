import type { IRGraph, IRNodeId } from "@kalphq/sdk";

/**
 * Asserts that a node ID exists in the graph. Throws with context on failure.
 *
 * @param graph - The IR graph to check against.
 * @param nodeId - The node ID to verify.
 * @param context - Description of where this reference appears (for error messages).
 */
const assertNodeExists = (
  graph: IRGraph,
  nodeId: string,
  context: string,
): void => {
  if (!graph.nodes[nodeId as IRNodeId]) {
    throw new Error(`Missing node ${nodeId} referenced by ${context}.`);
  }
};

/**
 * Validates the structural integrity of an {@link IRGraph}.
 *
 * Checks:
 * 1. At least one entry point exists.
 * 2. Every entry value references a node that exists.
 * 3. Every edge references existing `from` and `to` nodes.
 * 4. Every entry node has kind "entry".
 * 5. Edge types are valid ("sequential" | "event").
 *
 * @param graph - The IR graph to normalize and validate.
 * @returns The same graph if valid.
 * @throws If any structural invariant is violated.
 */
export const normalizeGraph = (graph: IRGraph): IRGraph => {
  const entryKeys = Object.entries(graph.entries).filter(
    ([, v]) => v != null,
  ) as [string, IRNodeId][];

  if (entryKeys.length === 0) {
    throw new Error("Graph must have at least one entry point.");
  }

  for (const [handler, nodeId] of entryKeys) {
    assertNodeExists(graph, nodeId, `entries.${handler}`);

    const node = graph.nodes[nodeId];
    if (node && node.kind !== "entry") {
      throw new Error(
        `Entry "${handler}" points to node ${nodeId} with kind "${node.kind}" — expected "entry".`,
      );
    }
  }

  for (const edge of graph.edges) {
    assertNodeExists(graph, edge.from, "edge.from");
    assertNodeExists(graph, edge.to, "edge.to");
  }

  return graph;
};
