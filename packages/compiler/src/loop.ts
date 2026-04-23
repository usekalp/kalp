import type {
  IRNode,
  IREdge,
  IRNodeId,
  LoopIRNode,
  WaitIRNode,
} from "@kalphq/sdk";
import { createIdGenerator } from "@/ids";
import { recordEmissions, type RecordingBody } from "@/proxy";

export interface LoopCompileResult {
  loopNode: LoopIRNode;
  nodes: Record<IRNodeId, IRNode>;
  edges: IREdge[];
}

const inferSchedule = (nodes: IRNode[]): LoopIRNode["schedule"] => {
  const waitNode = nodes.find(
    (node): node is WaitIRNode => node.kind === "wait",
  );

  if (!waitNode) {
    return { type: "event-driven" };
  }

  return { type: "interval", value: waitNode.duration };
};

export const compileLoop = async (
  body: RecordingBody,
  options: { id?: IRNodeId } = {},
): Promise<LoopCompileResult> => {
  const trace = await recordEmissions(body);

  if (trace.nodes.length === 0) {
    throw new Error("Loop body produced no IR nodes.");
  }

  const nodes: Record<IRNodeId, IRNode> = {};
  for (const node of trace.nodes) {
    nodes[node.id] = node;
  }

  const edges: IREdge[] = trace.nodes.slice(0, -1).map((node, index) => ({
    from: node.id,
    to: trace.nodes[index + 1]!.id,
    type: "sequential",
  }));

  const createId = createIdGenerator();
  const loopNode: LoopIRNode = {
    kind: "loop",
    id: options.id ?? createId("loop"),
    entry: trace.nodes[0]!.id,
    detached: true,
    schedule: inferSchedule(trace.nodes),
    lifecycle: {},
    persistent: true,
  };

  nodes[loopNode.id] = loopNode;

  return {
    loopNode,
    nodes,
    edges,
  };
};
