import { compileLoop } from "@/loop";
import { createIdGenerator } from "@/ids";
import type {
  IRNode,
  IRNodeId,
  IREdge,
  ClassifyIRNode,
  WaitIRNode,
} from "@kalphq/sdk";
import type { ExecutionTrace, LoopCapture } from "@/record-handler";

// ── Types ──

export interface IRFragment {
  nodes: Record<IRNodeId, IRNode>;
  edges: IREdge[];
}

// ── Schedule inference (reused from loop.ts pattern) ──

const inferSchedule = (
  nodes: IRNode[],
): { type: "interval" | "event-driven"; value?: string | number } => {
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

    // FIX 2: Agregar data edges del trace
    if (trace.edges) {
      edges.push(...trace.edges);
    }
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
      // Source of truth: only events (no branchLoopCaptures)
      // Loops are already in branchNodes as first-class events
      const branchChain = await resolveNodes(
        branchNodes,
        [], // Loops are in branchNodes, not separate
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
        // Note: condition is inferred from classifyNode.branches, not duplicated here
        edges.push({
          from: classifyId,
          to: branchChain[0]!,
          type: "branch",
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
        classifyNode.branches.push({ label, next: null });
      }
    }

    nodes[classifyId] = classifyNode;

    // FIX 2: Agregar data edges del trace
    if (trace.edges) {
      edges.push(...trace.edges);
    }
  }

  return {
    nodes,
    edges: dedupeEdges(edges),
  };
}

// ── Helpers ──

function dedupeEdges(edges: IREdge[]): IREdge[] {
  const seen = new Set<string>();
  return edges.filter((e) => {
    const key = `${e.from}-${e.to}-${e.type}-${(e as any).condition ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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

  // FIX v7: Process loop captures como cyclic subgraphs
  for (let i = 0; i < loopCaptures.length; i++) {
    const capture = loopCaptures[i]!;

    // Compile loop como cyclic subgraph (no LoopIRNode container)
    const loopResult = await compileLoop(
      capture.body as (ctx: unknown) => Promise<void>,
    );

    // Merge loop nodes into output
    for (const [id, n] of Object.entries(loopResult.nodes)) {
      outNodes[id as IRNodeId] = n;
    }

    // Merge loop edges into output
    for (const edge of loopResult.edges) {
      outEdges.push(edge);
    }

    // Wire: last chain node → loop entry (sequential edge)
    if (chain.length > 0) {
      outEdges.push({
        from: chain[chain.length - 1]!,
        to: loopResult.entryId,
        type: "sequential",
      });
    }

    // Add loop entry to chain (representa el loop en la secuencia)
    chain.push(loopResult.entryId);
  }

  return chain;
}
