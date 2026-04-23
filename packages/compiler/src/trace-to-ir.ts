import type {
  IRNode,
  IREdge,
  IRNodeId,
  LoopIRNode,
  WaitIRNode,
  ClassifyIRNode,
} from "@kalphq/sdk";
import { createIdGenerator } from "@/ids";
import {
  recordHandler,
  type ExecutionTrace,
  type LoopCapture,
} from "@/record-handler";

// ── Types ──

export interface IRFragment {
  nodes: Record<IRNodeId, IRNode>;
  edges: IREdge[];
}

// ── Schedule inference (reused from loop.ts pattern) ──

const inferSchedule = (nodes: IRNode[]): LoopIRNode["schedule"] => {
  const waitNode = nodes.find((n): n is WaitIRNode => n.kind === "wait");
  if (!waitNode) return { type: "event-driven" };
  return { type: "interval", value: waitNode.duration };
};

// ── Main conversion ──

export async function traceToIR(
  trace: ExecutionTrace,
  entryId: IRNodeId,
  createId: ReturnType<typeof createIdGenerator>,
): Promise<IRFragment> {
  const nodes: Record<IRNodeId, IRNode> = {};
  const edges: IREdge[] = [];

  if (trace.kind === "linear") {
    const chain = await resolveNodes(
      trace.nodes,
      trace.loopCaptures,
      nodes,
      edges,
      createId,
    );

    wireSequential(entryId, chain, edges);
  } else {
    // Branching trace
    const preChain = await resolveNodes(
      trace.preNodes,
      [], // loops before classify are in preNodes
      nodes,
      edges,
      createId,
    );

    // Wire entry → pre-classify nodes
    wireSequential(entryId, preChain, edges);

    // Build ClassifyIRNode
    const classifyId = createId("llm_classify");
    const classifyNode: ClassifyIRNode = {
      kind: "llm.classify",
      id: classifyId,
      model: trace.classify.model,
      input: trace.classify.input,
      branches: [],
      confidenceThreshold: trace.classify.confidenceThreshold,
    };

    // Wire last pre-node → classify
    const lastPre =
      preChain.length > 0 ? preChain[preChain.length - 1]! : entryId;
    edges.push({ from: lastPre, to: classifyId, type: "sequential" });

    // Build each branch
    for (const [label, branchNodes] of trace.branches) {
      // Get per-branch loop captures (loops called within this branch)
      const branchLoops = trace.branchLoopCaptures.get(label) ?? [];

      const branchChain = await resolveNodes(
        branchNodes,
        branchLoops,
        nodes,
        edges,
        createId,
      );

      // Always add branch to classify node - if no chain, it's a terminal branch
      if (branchChain.length > 0) {
        classifyNode.branches.push({
          label,
          next: branchChain[0],
        });

        // Wire classify → first branch node
        edges.push({
          from: classifyId,
          to: branchChain[0]!,
          type: "branch",
          condition: label,
        });

        // Wire sequential within branch
        for (let i = 0; i < branchChain.length - 1; i++) {
          edges.push({
            from: branchChain[i]!,
            to: branchChain[i + 1]!,
            type: "sequential",
          });
        }
      } else {
        // Terminal branch (no nodes after classify for this label)
        classifyNode.branches.push({ label });
      }
    }

    nodes[classifyId] = classifyNode;
  }

  return { nodes, edges };
}

// ── Helpers ──

function wireSequential(
  entryId: IRNodeId,
  chain: IRNodeId[],
  edges: IREdge[],
): void {
  if (chain.length === 0) return;

  edges.push({ from: entryId, to: chain[0]!, type: "sequential" });

  for (let i = 0; i < chain.length - 1; i++) {
    edges.push({
      from: chain[i]!,
      to: chain[i + 1]!,
      type: "sequential",
    });
  }
}

async function resolveNodes(
  traceNodes: IRNode[],
  loopCaptures: LoopCapture[],
  outNodes: Record<IRNodeId, IRNode>,
  outEdges: IREdge[],
  createId: ReturnType<typeof createIdGenerator>,
): Promise<IRNodeId[]> {
  const chain: IRNodeId[] = [];

  for (const node of traceNodes) {
    outNodes[node.id] = node;
    chain.push(node.id);
  }

  // Process loop captures: record each loop body, build LoopIRNode
  for (const capture of loopCaptures) {
    const loopTrace = await recordHandler(
      capture.body as (ctx: unknown) => Promise<unknown>,
    );
    const loopCreateId = createIdGenerator();
    const loopFragment = await traceToIR(
      loopTrace,
      "" as IRNodeId,
      loopCreateId,
    );

    // Get the first loop node for entry pointer
    const loopNodeIds = Object.keys(loopFragment.nodes) as IRNodeId[];
    if (loopNodeIds.length === 0) continue;

    // Merge loop fragment nodes
    for (const [id, n] of Object.entries(loopFragment.nodes)) {
      outNodes[id as IRNodeId] = n;
    }

    // Merge loop fragment edges (skip the edge from empty entryId)
    for (const edge of loopFragment.edges) {
      if (edge.from !== ("" as IRNodeId)) {
        outEdges.push(edge);
      }
    }

    // Find first real node (the one that the empty entry wired to)
    const firstLoopEdge = loopFragment.edges.find(
      (e) => e.from === ("" as IRNodeId),
    );
    const firstLoopNodeId = firstLoopEdge?.to ?? loopNodeIds[0]!;

    // Build LoopIRNode
    const loopId = createId("loop");
    const loopNode: LoopIRNode = {
      kind: "loop",
      id: loopId,
      entry: firstLoopNodeId,
      detached: true,
      schedule: inferSchedule(Object.values(loopFragment.nodes)),
      lifecycle: {},
      persistent: true,
    };
    outNodes[loopId] = loopNode;

    // Wire: last chain node → loop (nested edge)
    if (chain.length > 0) {
      outEdges.push({
        from: chain[chain.length - 1]!,
        to: loopId,
        type: "nested",
      });
    }

    chain.push(loopId);
  }

  return chain;
}
