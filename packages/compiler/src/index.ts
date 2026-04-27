// ────────────────────────────────────────────────────────────────────────────
// Compiler v2 — Public API
// ────────────────────────────────────────────────────────────────────────────

export { compileAgent } from "@/compiler";
export { normalizeGraph } from "@/normalize";
export { toHandlerKey } from "@/handler-key";
export {
  validateIR,
  validateIRBindings,
  IRGraphSchema,
  IRNodeSchema,
  IREdgeSchema,
} from "@/validate";
export type { ValidationResult, Severity, ValidationIssue } from "@/validate";
export { analyzeHandler } from "@/analyze";
export type { HandlerAnalysis } from "@/analyze";
export {
  buildAdjacency,
  getReachableNodes,
  getHandlersByModuleRef,
  resolveEntryHandler,
  hasPath,
} from "@/graph";
