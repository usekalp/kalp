import type {
  ClassifyIRNode,
  IRGraph,
  IRNodeId,
  LoopIRNode,
} from "@kalphq/sdk";

const assertNodeExists = (graph: IRGraph, nodeId: string, context: string) => {
  if (!graph.nodes[nodeId as keyof typeof graph.nodes]) {
    throw new Error(`Missing node ${nodeId} referenced by ${context}.`);
  }
};

export const normalizeGraph = (graph: IRGraph): IRGraph => {
  const entryKeys = Object.entries(graph.entries).filter(
    ([, v]) => v != null,
  ) as [string, IRNodeId][];

  if (entryKeys.length === 0) {
    throw new Error("Graph must have at least one entry point.");
  }

  for (const [handler, nodeId] of entryKeys) {
    assertNodeExists(graph, nodeId, `entries.${handler}`);
  }

  for (const edge of graph.edges) {
    assertNodeExists(graph, edge.from, "edge.from");
    assertNodeExists(graph, edge.to, "edge.to");
  }

  const nodes = Object.values(
    graph.nodes,
  ) as IRGraph["nodes"][keyof IRGraph["nodes"]][];

  for (const node of nodes) {
    if (node.kind === "llm.classify") {
      const classify = node as ClassifyIRNode;
      for (const branch of classify.branches) {
        if (branch.next) {
          assertNodeExists(graph, branch.next, "classify.branch");
        }
      }
      if (classify.fallback) {
        assertNodeExists(graph, classify.fallback, "classify.fallback");
      }
    }

    if (node.kind === "loop") {
      const loop = node as LoopIRNode;
      assertNodeExists(graph, loop.entry, "loop.entry");
      if (loop.until) {
        assertNodeExists(graph, loop.until, "loop.until");
      }
      if (loop.lifecycle.onStart) {
        assertNodeExists(
          graph,
          loop.lifecycle.onStart,
          "loop.lifecycle.onStart",
        );
      }
      if (loop.lifecycle.onIterationStart) {
        assertNodeExists(
          graph,
          loop.lifecycle.onIterationStart,
          "loop.lifecycle.onIterationStart",
        );
      }
      if (loop.lifecycle.onIterationEnd) {
        assertNodeExists(
          graph,
          loop.lifecycle.onIterationEnd,
          "loop.lifecycle.onIterationEnd",
        );
      }
      if (loop.lifecycle.onError) {
        assertNodeExists(
          graph,
          loop.lifecycle.onError,
          "loop.lifecycle.onError",
        );
      }
      if (loop.lifecycle.onStop) {
        assertNodeExists(graph, loop.lifecycle.onStop, "loop.lifecycle.onStop");
      }
    }
  }

  return graph;
};
