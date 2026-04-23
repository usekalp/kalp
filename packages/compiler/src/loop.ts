import type {
  IRNode,
  IREdge,
  IRNodeId,
  RunIRNode,
  WaitIRNode,
} from "@kalphq/sdk";
import { createIdGenerator } from "@/ids";
import { recordEmissions, type RecordingBody } from "@/proxy";

/**
 * Resultado de compilar un loop como cyclic subgraph
 * FIX v7: Loop ya no es container, es un subgraph con back-edge explícito
 */
export interface LoopCompileResult {
  entryId: IRNodeId; // Nodo de entrada al loop
  bodyIds: IRNodeId[]; // IDs de nodos del body en orden
  exitId: IRNodeId; // Nodo de salida (check condition)
  nodes: Record<IRNodeId, IRNode>;
  edges: IREdge[];
}

/**
 * Inferir tipo de schedule basado en waits en el body
 */
const inferSchedule = (
  nodes: IRNode[],
): { type: "interval" | "event-driven"; value?: string | number } => {
  const waitNode = nodes.find(
    (node): node is WaitIRNode => node.kind === "wait",
  );

  if (!waitNode) {
    return { type: "event-driven" };
  }

  return { type: "interval", value: waitNode.duration };
};

/**
 * FIX v7: Compilar loop como cyclic subgraph explícito
 *
 * Estructura resultante:
 *   entry → body[0] → body[1] → ... → body[n] → exit
 *                              ↑_______________↓ (back-edge para repetir)
 *
 * El loop es un subgraph aislado con:
 * - Secuencia lineal de nodos body
 * - Back-edge del último body al primero
 * - Exit edge condicional (implícito en estructura)
 */
export const compileLoop = async (
  body: RecordingBody,
  options: { id?: IRNodeId } = {},
): Promise<LoopCompileResult> => {
  const trace = await recordEmissions(body);

  if (trace.nodes.length === 0) {
    throw new Error("Loop body produced no IR nodes.");
  }

  const createId = createIdGenerator("loop_body");

  // Crear nodo de entrada al loop (Run node que marca el inicio)
  const entryId = options.id ?? createId("loop_entry");
  const entryNode: RunIRNode = {
    kind: "run",
    id: entryId,
    targetId: "loop:entry",
    targetKind: "step",
  };

  // Crear nodo de salida/condición del loop
  const exitId = createId("loop_exit");
  const exitNode: RunIRNode = {
    kind: "run",
    id: exitId,
    targetId: "loop:check",
    targetKind: "step",
  };

  // Indexar nodos del body
  const nodes: Record<IRNodeId, IRNode> = {
    [entryId]: entryNode,
    [exitId]: exitNode,
  };
  for (const node of trace.nodes) {
    nodes[node.id] = node;
  }

  // Body IDs en orden de ejecución
  const bodyIds = trace.nodes.map((n) => n.id);
  const firstBodyId = bodyIds[0]!;
  const lastBodyId = bodyIds[bodyIds.length - 1]!;

  // Edges:
  // 1. Entry → first body node
  // 2. Sequential edges entre body nodes
  // 3. Last body → exit
  // 4. Exit → first body (back-edge para loop)
  const edges: IREdge[] = [
    // Entry point
    { from: entryId, to: firstBodyId, type: "sequential" },

    // Body sequence
    ...trace.nodes.slice(0, -1).map((node, index) => ({
      from: node.id,
      to: trace.nodes[index + 1]!.id,
      type: "sequential" as const,
    })),

    // To exit
    { from: lastBodyId, to: exitId, type: "sequential" },

    // Back-edge: exit → first body (el loop)
    {
      from: exitId,
      to: firstBodyId,
      type: "sequential",
      // Nota: En runtime, este edge se evalúa condicionalmente
      // La condición de salida se maneja en el nodo exit
    },
  ];

  return {
    entryId,
    bodyIds,
    exitId,
    nodes,
    edges,
  };
};
