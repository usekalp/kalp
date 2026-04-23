/**
 * Graph-derived computation utilities for v7 execution semantics
 * 
 * Scope y Sequence NO son campos en nodos — se derivan del grafo
 */

import type { IRGraph, IRNodeId, IREdge, IRNode } from "@kalphq/sdk";

/**
 * Control edge types que definen orden de ejecución
 * Data edges NO definen orden, solo dependencia de datos
 */
const CONTROL_EDGE_TYPES = ["sequential", "branch", "nested"];

/**
 * Computa scopeId para cada nodo basado en:
 * - Entry node como raíz del scope
 * - Reachability SIN cruzar edges type: "cross_scope"
 * 
 * Scope es un concepto DERIVADO, no almacenado
 */
export function computeScopes(ir: IRGraph): Map<IRNodeId, IRNodeId> {
  const scopes = new Map<IRNodeId, IRNodeId>();
  
  // Para cada entry, computar su scope
  for (const [entryKey, entryNodeId] of Object.entries(ir.entries)) {
    const scopeNodes = getScopeNodes(ir, entryNodeId);
    
    // Asignar scope a todos los nodos alcanzables desde este entry
    for (const nodeId of scopeNodes) {
      // Si un nodo ya tiene scope asignado, verificar que sea el mismo
      // (si no, hay un error de estructura — cross_scope edge debería existir)
      const existingScope = scopes.get(nodeId);
      if (existingScope && existingScope !== entryNodeId) {
        // Este caso indica que el nodo es alcanzable desde múltiples entries
        // sin cruzar cross_scope edges — es ambigüedad estructural
        // El validador debe detectar esto
      }
      scopes.set(nodeId, entryNodeId);
    }
  }
  
  return scopes;
}

/**
 * Obtiene todos los nodos en el scope de un entry node
 * Reachability DFS sin cruzar cross_scope edges
 */
function getScopeNodes(ir: IRGraph, entryNodeId: IRNodeId): Set<IRNodeId> {
  const visited = new Set<IRNodeId>();
  const stack: IRNodeId[] = [entryNodeId];
  
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    
    // Encontrar edges que parten de este nodo
    for (const edge of ir.edges) {
      if (edge.from !== current) continue;
      
      // cross_scope edges definen el límite del scope
      // el target está en OTRO scope, no en este
      if (edge.type === "cross_scope") continue;
      
      // Otros edges mantienen el scope
      stack.push(edge.to);
    }
  }
  
  return visited;
}

/**
 * Computa sequenceId para cada nodo en un scope
 * 
 * sequenceId = índice en orden topológico del scope subgraph
 * Basado SOLO en control edges (NO data edges)
 */
export function computeSequence(
  ir: IRGraph,
  scopeEntryId: IRNodeId,
): Map<IRNodeId, number> {
  const sequence = new Map<IRNodeId, number>();
  const scopeNodes = getScopeNodes(ir, scopeEntryId);
  
  // Filtrar edges a solo control edges DENTRO del scope
  const scopeControlEdges = ir.edges.filter(
    e => scopeNodes.has(e.from) && 
         scopeNodes.has(e.to) &&
         CONTROL_EDGE_TYPES.includes(e.type)
  );
  
  // Calcular in-degrees para Kahn's algorithm
  const inDegree = new Map<IRNodeId, number>();
  for (const nodeId of scopeNodes) {
    inDegree.set(nodeId, 0);
  }
  for (const edge of scopeControlEdges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
  }
  
  // Kahn's algorithm para orden topológico
  const queue: IRNodeId[] = [];
  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0) queue.push(nodeId);
  }
  
  let seqIndex = 0;
  while (queue.length > 0) {
    // Orden estable para determinismo
    queue.sort();
    const current = queue.shift()!;
    sequence.set(current, seqIndex++);
    
    // Reducir in-degree de vecinos
    for (const edge of scopeControlEdges) {
      if (edge.from !== current) continue;
      const newDegree = (inDegree.get(edge.to) || 0) - 1;
      inDegree.set(edge.to, newDegree);
      if (newDegree === 0) queue.push(edge.to);
    }
  }
  
  // Si quedan nodos sin visitar, hay ciclo en el grafo
  // (loops intencionales deben ser manejados especialmente)
  for (const nodeId of scopeNodes) {
    if (!sequence.has(nodeId)) {
      // Asignar sequence -1 para indicar "en ciclo"
      sequence.set(nodeId, -1);
    }
  }
  
  return sequence;
}

/**
 * Encuentra todos los ciclos en el grafo (para detectar loops mal formados)
 */
export function findCycles(ir: IRGraph): IRNodeId[][] {
  const cycles: IRNodeId[][] = [];
  const visited = new Set<IRNodeId>();
  const stack: IRNodeId[] = [];
  const inStack = new Set<IRNodeId>();
  
  // Solo considerar control edges para detección de ciclos
  const controlEdges = ir.edges.filter(e => CONTROL_EDGE_TYPES.includes(e.type));
  const adj = new Map<IRNodeId, IRNodeId[]>();
  for (const edge of controlEdges) {
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    adj.get(edge.from)!.push(edge.to);
  }
  
  function dfs(node: IRNodeId) {
    visited.add(node);
    stack.push(node);
    inStack.add(node);
    
    for (const neighbor of adj.get(node) || []) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (inStack.has(neighbor)) {
        // Encontramos un ciclo
        const cycleStart = stack.indexOf(neighbor);
        cycles.push(stack.slice(cycleStart));
      }
    }
    
    stack.pop();
    inStack.delete(node);
  }
  
  for (const nodeId of Object.keys(ir.nodes) as IRNodeId[]) {
    if (!visited.has(nodeId)) dfs(nodeId);
  }
  
  return cycles;
}

/**
 * Verifica si existe path de A a B usando control edges
 */
export function hasControlPath(
  ir: IRGraph,
  from: IRNodeId,
  to: IRNodeId,
): boolean {
  const visited = new Set<IRNodeId>();
  const stack: IRNodeId[] = [from];
  
  const controlEdges = ir.edges.filter(e => CONTROL_EDGE_TYPES.includes(e.type));
  const adj = new Map<IRNodeId, IRNodeId[]>();
  for (const edge of controlEdges) {
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    adj.get(edge.from)!.push(edge.to);
  }
  
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === to) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    
    for (const neighbor of adj.get(current) || []) {
      if (!visited.has(neighbor)) stack.push(neighbor);
    }
  }
  
  return false;
}
